import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';

const CHANNELS = {
  global: { label: 'Global', color: 'text-parchment' },
  alliance: { label: 'Alliance', color: 'text-essence' },
  dm: { label: 'Prive', color: 'text-gold' },
};

const FACTION_COLORS = {
  demons: '#8B1A1A',
  morts_vivants: '#6B2FA0',
  elementaires: '#B0592A',
};

let socketInstance = null;

function getSocket() {
  if (!socketInstance) {
    const token = localStorage.getItem('accessToken');
    socketInstance = io(window.location.origin, {
      auth: { token },
      transports: ['websocket'],
    });
  }
  return socketInstance;
}

export function disconnectChat() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

export default function ChatPanel() {
  const player = useAuthStore((s) => s.player);
  const [channel, setChannel] = useState('global');
  const [dmTarget, setDmTarget] = useState('');
  const [activeDm, setActiveDm] = useState(null);
  const [messages, setMessages] = useState({ global: [], alliance: [] });
  const [dmMessages, setDmMessages] = useState({});
  const [input, setInput] = useState('');
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  // Connect socket
  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('chat:message', (msg) => {
      if (msg.channel === 'global' || msg.channel.startsWith('alliance:')) {
        const key = msg.channel === 'global' ? 'global' : 'alliance';
        setMessages((prev) => ({
          ...prev,
          [key]: [...prev[key].slice(-99), msg],
        }));
      } else if (msg.channel.startsWith('dm:')) {
        setDmMessages((prev) => ({
          ...prev,
          [msg.channel]: [...(prev[msg.channel] || []).slice(-99), msg],
        }));
      }
    });

    socket.on('chat:history', (data) => {
      if (data.channel === 'global') {
        setMessages((prev) => ({ ...prev, global: data.messages }));
      } else if (data.channel.startsWith('alliance:')) {
        setMessages((prev) => ({ ...prev, alliance: data.messages }));
      } else if (data.channel.startsWith('dm:')) {
        setDmMessages((prev) => ({ ...prev, [data.channel]: data.messages }));
      }
    });

    socket.on('chat:error', (err) => {
      setError(err);
      setTimeout(() => setError(null), 3000);
    });

    // Load history
    socket.emit('chat:history', { channel: 'global' });
    socket.emit('chat:history', { channel: 'alliance' });
    socket.emit('chat:joinAlliance');

    return () => {
      socket.off('chat:message');
      socket.off('chat:history');
      socket.off('chat:error');
      socket.off('connect');
      socket.off('disconnect');
    };
  }, []);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, dmMessages, channel, activeDm]);

  const sendMsg = useCallback((e) => {
    e.preventDefault();
    if (!input.trim() || !socketRef.current) return;

    const socket = socketRef.current;
    const payload = { content: input.trim() };

    if (channel === 'dm' && activeDm) {
      payload.channel = 'dm';
      payload.targetUsername = activeDm;
    } else if (channel === 'alliance') {
      payload.channel = `alliance:${player?.alliance_id || 'none'}`;
    } else {
      payload.channel = 'global';
    }

    socket.emit('chat:send', payload);
    setInput('');
  }, [input, channel, activeDm, player]);

  const startDm = useCallback(() => {
    if (!dmTarget.trim()) return;
    setActiveDm(dmTarget.trim());
    setChannel('dm');
    // Load DM history
    socketRef.current?.emit('chat:history', {
      channel: 'dm',
      targetUsername: dmTarget.trim(),
    });
    setDmTarget('');
  }, [dmTarget]);

  // Get current messages
  let currentMessages = [];
  if (channel === 'global') {
    currentMessages = messages.global;
  } else if (channel === 'alliance') {
    currentMessages = messages.alliance;
  } else if (channel === 'dm' && activeDm) {
    // Find DM channel key
    const dmKey = Object.keys(dmMessages).find((k) => k.startsWith('dm:'));
    currentMessages = dmMessages[dmKey] || [];
  }

  return (
    <div className="flex flex-col" style={{ height: 500 }}>
      {/* Channel tabs */}
      <div className="flex gap-1 mb-2 items-center">
        {Object.entries(CHANNELS).map(([key, meta]) => (
          <button
            key={key}
            onClick={() => setChannel(key)}
            className={`px-3 py-1.5 text-xs rounded border transition-colors ${
              channel === key
                ? 'border-gold text-gold bg-gold/10'
                : 'border-border text-muted hover:text-parchment hover:border-gold/30'
            }`}
          >
            {meta.label}
          </button>
        ))}
        <span className={`ml-auto text-[10px] ${connected ? 'text-green-400' : 'text-blood-glow'}`}>
          {connected ? 'Connecte' : 'Deconnecte'}
        </span>
      </div>

      {/* DM target input */}
      {channel === 'dm' && !activeDm && (
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={dmTarget}
            onChange={(e) => setDmTarget(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && startDm()}
            className="flex-1 bg-base border border-border rounded px-3 py-1.5 text-sm text-parchment focus:border-gold focus:outline-none"
            placeholder="Nom du joueur..."
          />
          <button onClick={startDm}
            className="px-3 py-1.5 text-xs bg-surface border border-border rounded text-parchment hover:border-gold transition-colors">
            Ouvrir
          </button>
        </div>
      )}

      {channel === 'dm' && activeDm && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-gold">Conversation avec {activeDm}</span>
          <button onClick={() => setActiveDm(null)}
            className="text-xs text-muted hover:text-parchment">&times; Fermer</button>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-blood-glow text-xs mb-2">{error}</p>
      )}

      {/* Messages */}
      <div className="flex-1 bg-base border border-border rounded-lg p-3 overflow-y-auto mb-2">
        {currentMessages.length === 0 && (
          <p className="text-muted text-xs text-center mt-4">Aucun message</p>
        )}
        {currentMessages.map((msg) => (
          <div key={msg.id} className="mb-1.5">
            <span className="text-[10px] text-muted mr-2">
              {new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="text-xs font-medium mr-1"
              style={{ color: FACTION_COLORS[msg.senderFaction] || '#C9A84C' }}>
              {msg.senderName}
            </span>
            <span className="text-xs text-parchment">{msg.content}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMsg} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={500}
          disabled={!connected || (channel === 'dm' && !activeDm)}
          className="flex-1 bg-base border border-border rounded px-3 py-2 text-sm text-parchment focus:border-gold focus:outline-none disabled:opacity-50"
          placeholder={channel === 'dm' && !activeDm ? 'Selectionnez un joueur...' : 'Votre message...'}
        />
        <button type="submit"
          disabled={!connected || !input.trim() || (channel === 'dm' && !activeDm)}
          className="px-4 py-2 text-sm bg-blood border border-gold rounded text-parchment hover:bg-blood-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          Envoyer
        </button>
      </form>
    </div>
  );
}
