const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', game: 'Inferno Domini', version: '0.1.0' });
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  socket.on('disconnect', () => console.log(`Socket disconnected: ${socket.id}`));
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Inferno Domini server running on port ${PORT}`);
});
