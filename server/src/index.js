const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
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
const leaderboardRoutes = require('./routes/leaderboard');
const notificationRoutes = require('./routes/notifications');
const storeRoutes = require('./routes/store');
const playerRoutes = require('./routes/player');
const seasonRoutes = require('./routes/seasons');
const { startLegionProcessor } = require('./game/legionProcessor');
const { startEventProcessor } = require('./game/eventProcessor');
const { startSeasonProcessor } = require('./game/seasonProcessor');
const { setupChat } = require('./chat');

const app = express();
const httpServer = createServer(app);
const corsOrigin = process.env.NODE_ENV === 'production'
  ? process.env.CLIENT_ORIGIN || 'https://infernodominigame.com'
  : true;
const io = new Server(httpServer, { cors: { origin: corsOrigin } });

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: corsOrigin }));

// Rate limiters
const apiLimiter = rateLimit({ windowMs: 60000, max: 100, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests' } });
const authLimiter = rateLimit({ windowMs: 900000, max: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts, try again later' } });
app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Stripe webhook needs raw body — mount BEFORE express.json()
app.use('/api/store/webhook', express.raw({ type: 'application/json' }));
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
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/player', playerRoutes);
app.use('/api/seasons', seasonRoutes);

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

  // Phase 15 tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS legendary_activations (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      research_type VARCHAR(64) NOT NULL,
      activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      cooldown_end TIMESTAMPTZ,
      data JSONB DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS idx_leg_act_player ON legendary_activations(player_id, research_type);

    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      type VARCHAR(32) NOT NULL,
      data JSONB DEFAULT '{}',
      read BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_notif_player ON notifications(player_id, read);
  `);

  // Phase 17 tables (monetization)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS relic_transactions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      amount INT NOT NULL,
      type VARCHAR(32) NOT NULL,
      source VARCHAR(128),
      stripe_session_id VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_relic_trans_player ON relic_transactions(player_id);

    CREATE TABLE IF NOT EXISTS player_cosmetics (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      cosmetic_id VARCHAR(64) NOT NULL,
      equipped BOOLEAN DEFAULT false,
      acquired_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(player_id, cosmetic_id)
    );

    CREATE TABLE IF NOT EXISTS stripe_customers (
      player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
      stripe_customer_id VARCHAR(255) UNIQUE,
      subscription_id VARCHAR(255),
      subscription_status VARCHAR(32) DEFAULT 'inactive',
      subscription_end TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Phase 20 tables (seasons & prestige)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS seasons (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      server_id UUID NOT NULL REFERENCES servers(id),
      name VARCHAR(128) NOT NULL,
      start_date TIMESTAMPTZ NOT NULL,
      end_date TIMESTAMPTZ NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'upcoming'
        CHECK (status IN ('upcoming', 'active', 'ended')),
      rewards_config JSONB NOT NULL DEFAULT '{"1":5000,"2":3000,"3":2000,"top10":1000,"top25":500,"top50":200,"participant":100}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_seasons_server ON seasons(server_id, status);

    CREATE TABLE IF NOT EXISTS season_scores (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
      player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      score BIGINT NOT NULL DEFAULT 0,
      rank INT,
      relics_earned INT DEFAULT 0,
      UNIQUE (season_id, player_id)
    );
    CREATE INDEX IF NOT EXISTS idx_season_scores ON season_scores(season_id, score DESC);

    CREATE TABLE IF NOT EXISTS prestige (
      player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
      level INT NOT NULL DEFAULT 0,
      total_xp BIGINT NOT NULL DEFAULT 0,
      bonuses JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Start legion arrival processor (every 5 seconds)
  startLegionProcessor(5000);

  // Start event processor (every 60 seconds)
  startEventProcessor(60000);

  // Start season processor (every 60 seconds)
  startSeasonProcessor(60000);

  httpServer.listen(PORT, () => {
    console.log(`Inferno Domini server running on port ${PORT}`);
  });
}

boot().catch((err) => {
  console.error('Boot failed:', err);
  process.exit(1);
});
