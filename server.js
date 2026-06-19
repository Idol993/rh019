const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const authRoutes = require('./routes/auth');
const batteryRoutes = require('./routes/battery');
const monitorRoutes = require('./routes/monitor');
const warningRoutes = require('./routes/warning');
const recycleRoutes = require('./routes/recycle');
const carbonRoutes = require('./routes/carbon');
const dashboardRoutes = require('./routes/dashboard');

const mqttSimulator = require('./services/mqttSimulator');
const warningService = require('./services/warningService');
const sohService = require('./services/sohService');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/battery', batteryRoutes);
app.use('/api/monitor', monitorRoutes);
app.use('/api/warning', warningRoutes);
app.use('/api/recycle', recycleRoutes);
app.use('/api/carbon', carbonRoutes);
app.use('/api/dashboard', dashboardRoutes);

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  ws.send(JSON.stringify({ type: 'connection', status: 'connected' }));
});

const broadcast = (data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
};

global.broadcastData = broadcast;

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  动力电池全生命周期溯源平台`);
  console.log(`  服务已启动: http://localhost:${PORT}`);
  console.log(`  WebSocket: ws://localhost:${PORT}`);
  console.log(`========================================\n`);
  
  mqttSimulator.start();
  warningService.start();
  sohService.start();
});

module.exports = { app, server, wss };
