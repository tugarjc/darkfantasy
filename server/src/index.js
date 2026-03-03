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
const { startLegionProcessor } = require('./game/legionProcessor');

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

// ── WebSocket ──
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  socket.on('disconnect', () => console.log(`Socket disconnected: ${socket.id}`));
});

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

  // Start legion arrival processor (every 5 seconds)
  startLegionProcessor(5000);

  httpServer.listen(PORT, () => {
    console.log(`Inferno Domini server running on port ${PORT}`);
  });
}

boot().catch((err) => {
  console.error('Boot failed:', err);
  process.exit(1);
});
