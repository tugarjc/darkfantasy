const jwt = require('jsonwebtoken');
const { pool } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const MAX_MSG_LENGTH = 500;
const RATE_LIMIT_MS = 1500; // 1 message per 1.5s

// Track last message time per socket
const lastMessageTime = new Map();

/**
 * Generates a consistent DM channel key (sorted IDs).
 */
function dmChannel(id1, id2) {
  return id1 < id2 ? `dm:${id1}:${id2}` : `dm:${id2}:${id1}`;
}

/**
 * Set up chat handlers on the Socket.io server.
 */
function setupChat(io) {
  // Auth middleware — verify JWT on connection
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Token requis'));
    try {
      socket.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch {
      next(new Error('Token invalide'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user.id;

    // Join global channel
    socket.join('global');

    // Join alliance channel if player is in one
    try {
      const res = await pool.query('SELECT alliance_id FROM players WHERE id = $1', [userId]);
      const allianceId = res.rows[0]?.alliance_id;
      if (allianceId) {
        socket.join(`alliance:${allianceId}`);
        socket.allianceId = allianceId;
      }
    } catch { /* silent */ }

    // ── Send message ──
    socket.on('chat:send', async (data) => {
      const { channel, content, targetUsername } = data || {};

      // Rate limit
      const now = Date.now();
      const last = lastMessageTime.get(socket.id) || 0;
      if (now - last < RATE_LIMIT_MS) {
        return socket.emit('chat:error', 'Attendez avant d\'envoyer un autre message');
      }
      lastMessageTime.set(socket.id, now);

      // Validate content
      if (!content || typeof content !== 'string') return;
      const trimmed = content.trim();
      if (trimmed.length === 0 || trimmed.length > MAX_MSG_LENGTH) {
        return socket.emit('chat:error', `Message entre 1 et ${MAX_MSG_LENGTH} caracteres`);
      }

      try {
        // Get sender info
        const senderRes = await pool.query('SELECT username, faction FROM players WHERE id = $1', [userId]);
        const sender = senderRes.rows[0];
        if (!sender) return;

        let resolvedChannel = channel;

        // Resolve DM channel
        if (channel === 'dm' && targetUsername) {
          const targetRes = await pool.query('SELECT id FROM players WHERE username = $1', [targetUsername]);
          if (targetRes.rows.length === 0) {
            return socket.emit('chat:error', 'Joueur non trouve');
          }
          const targetId = targetRes.rows[0].id;
          if (targetId === userId) {
            return socket.emit('chat:error', 'Impossible de s\'envoyer un message');
          }
          resolvedChannel = dmChannel(userId, targetId);

          // Ensure target is in the DM room
          const targetSockets = await io.fetchSockets();
          for (const s of targetSockets) {
            if (s.user?.id === targetId) {
              s.join(resolvedChannel);
            }
          }
          socket.join(resolvedChannel);
        }

        // Resolve alliance channel shorthand
        if (resolvedChannel?.startsWith('alliance:')) {
          if (!socket.allianceId) {
            return socket.emit('chat:error', 'Vous n\'etes pas dans une alliance');
          }
          resolvedChannel = `alliance:${socket.allianceId}`;
        }

        // Validate channel
        if (resolvedChannel === 'global') {
          // OK
        } else if (resolvedChannel?.startsWith('alliance:')) {
          // OK — resolved above
        } else if (resolvedChannel?.startsWith('dm:')) {
          // OK — already validated
        } else {
          return socket.emit('chat:error', 'Canal invalide');
        }

        // Save to DB
        const msgRes = await pool.query(
          'INSERT INTO chat_messages (channel, sender_id, content) VALUES ($1, $2, $3) RETURNING id, created_at',
          [resolvedChannel, userId, trimmed]
        );

        const message = {
          id: msgRes.rows[0].id,
          channel: resolvedChannel,
          senderId: userId,
          senderName: sender.username,
          senderFaction: sender.faction,
          content: trimmed,
          createdAt: msgRes.rows[0].created_at,
        };

        // Broadcast to channel room
        io.to(resolvedChannel).emit('chat:message', message);
      } catch (err) {
        console.error('Chat send error:', err);
        socket.emit('chat:error', 'Erreur interne');
      }
    });

    // ── Load history ──
    socket.on('chat:history', async (data) => {
      const { channel, targetUsername, before, limit = 30 } = data || {};
      let resolvedChannel = channel;

      // Resolve DM
      if (channel === 'dm' && targetUsername) {
        const targetRes = await pool.query('SELECT id FROM players WHERE username = $1', [targetUsername]);
        if (targetRes.rows.length === 0) return;
        resolvedChannel = dmChannel(userId, targetRes.rows[0].id);
        socket.join(resolvedChannel);
      }

      // Resolve alliance
      if (channel === 'alliance' || channel?.startsWith('alliance:')) {
        if (!socket.allianceId) return;
        resolvedChannel = `alliance:${socket.allianceId}`;
      }

      if (!resolvedChannel) return;

      try {
        const params = [resolvedChannel, Math.min(limit, 50)];
        let query = `SELECT cm.id, cm.channel, cm.sender_id, cm.content, cm.created_at, p.username as sender_name, p.faction as sender_faction
                     FROM chat_messages cm
                     JOIN players p ON cm.sender_id = p.id
                     WHERE cm.channel = $1`;
        if (before) {
          query += ' AND cm.created_at < $3';
          params.push(before);
        }
        query += ' ORDER BY cm.created_at DESC LIMIT $2';

        const result = await pool.query(query, params);

        socket.emit('chat:history', {
          channel: resolvedChannel,
          messages: result.rows.reverse().map((m) => ({
            id: m.id,
            channel: m.channel,
            senderId: m.sender_id,
            senderName: m.sender_name,
            senderFaction: m.sender_faction,
            content: m.content,
            createdAt: m.created_at,
          })),
        });
      } catch (err) {
        console.error('Chat history error:', err);
      }
    });

    // ── Join alliance channel on alliance change ──
    socket.on('chat:joinAlliance', async () => {
      try {
        const res = await pool.query('SELECT alliance_id FROM players WHERE id = $1', [userId]);
        const allianceId = res.rows[0]?.alliance_id;
        if (socket.allianceId) socket.leave(`alliance:${socket.allianceId}`);
        if (allianceId) {
          socket.join(`alliance:${allianceId}`);
          socket.allianceId = allianceId;
        } else {
          socket.allianceId = null;
        }
      } catch { /* silent */ }
    });

    socket.on('disconnect', () => {
      lastMessageTime.delete(socket.id);
    });
  });
}

module.exports = { setupChat };
