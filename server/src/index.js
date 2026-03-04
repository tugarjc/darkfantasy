const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { connectDB } = require('./db');
const { connectRedis } = require('./redis');
const authRoutes = require('./routes/auth');
const circleRoutes = require('./routes/circles');
const buildingRoutes = require('./routes/buildings');
const unitRoutes = require('./routes/units');
const mapRoutes = require('./routes/map');
const legionRoutes = require('./routes/legions');
const reportRoutes = require('./routes/reports');
const researchRoutes = require('./routes/researches');
const allianceRoutes = require('./routes/alliances');
const heroRoutes = require('./routes/heroes');
const marketRoutes = require('./routes/market');
const adminRoutes = require('./routes/admin');
const eventRoutes = require('./routes/events');
const missionRoutes = require('./routes/missions');
const allianceAdvancedRoutes = require('./routes/allianceAdvanced');
const tutorialRoutes = require('./routes/tutorial');
const { startLegionProcessor } = require('./game/legionProcessor');
const { startEventProcessor } = require('./game/eventProcessor');
const { setupChat } = require('./chat');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// ── Routes ──
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', game: 'Inferno Domini', version: '0.1.0' });
});
app.use('/api/auth', authRoutes);
app.use('/api/circles', circleRoutes);
app.use('/api/circles', buildingRoutes);
app.use('/api/circles', unitRoutes);
app.use('/api/map', mapRoutes);
app.use('/api/legions', legionRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/researches', researchRoutes);
app.use('/api/alliances', allianceRoutes);
app.use('/api/heroes', heroRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/missions', missionRoutes);
app.use('/api/alliances', allianceAdvancedRoutes);
app.use('/api/tutorial', tutorialRoutes);

// ── WebSocket + Chat ──
setupChat(io);

// ── Boot ──
const PORT = process.env.PORT || 3000;

async function boot() {
  await connectDB();
  await connectRedis();

  // Ensure default server exists
  const { pool } = require('./db');
  await pool.query(`
    INSERT INTO servers (id, name, type, speed)
    VALUES ('00000000-0000-0000-0000-000000000001', 'Pandémonium Alpha', 'standard', 1.0)
    ON CONFLICT (id) DO NOTHING
  `);

  // Create tables for Phases 12-14 if not exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tutorial_progress (
      player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
      quests JSONB NOT NULL DEFAULT '[]',
      completed BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE fortress ADD COLUMN IF NOT EXISTS hp_max INT DEFAULT 1000000;
    ALTER TABLE fortress ADD COLUMN IF NOT EXISTS build_complete BOOLEAN DEFAULT false;
    ALTER TABLE fortress ADD COLUMN IF NOT EXISTS build_end_time TIMESTAMPTZ;
  `);

  // Start legion arrival processor (every 5 seconds)
  startLegionProcessor(5000);

  // Start event processor (every 60 seconds)
  startEventProcessor(60000);

  httpServer.listen(PORT, () => {
    console.log(`Inferno Domini server running on port ${PORT}`);
  });
}

boot().catch((err) => {
  console.error('Boot failed:', err);
  process.exit(1);
});
