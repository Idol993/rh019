const express = require('express');
const { batteries, historyData, generateMockHistoryData } = require('../data/store');
const { authenticateToken } = require('./auth');

const router = express.Router();

router.get('/realtime', authenticateToken, (req, res) => {
  const { batteryIds } = req.query;
  
  let targetBatteries = batteries;
  if (batteryIds) {
    const ids = batteryIds.split(',');
    targetBatteries = batteries.filter(b => ids.includes(b.batteryId));
  }
  
  const realtimeData = targetBatteries
    .filter(b => b.status === 'running' || b.status === 'charging' || b.status === 'idle')
    .map(b => ({
      batteryId: b.batteryId,
      vin: b.vin,
      status: b.status,
      soc: b.soc,
      soh: b.currentSoh,
      totalVoltage: b.totalVoltage,
      totalCurrent: b.totalCurrent,
      maxTemp: b.maxTemp,
      minTemp: b.minTemp,
      tempDiff: b.tempDiff,
      maxCellVoltage: b.maxCellVoltage,
      minCellVoltage: b.minCellVoltage,
      voltageDiff: b.voltageDiff,
      insulationResistance: b.insulationResistance,
      cycles: b.cycles,
      location: b.location,
      timestamp: new Date().toISOString()
    }));
  
  res.json({
    code: 200,
    data: realtimeData
  });
});

router.get('/:batteryId/history', authenticateToken, (req, res) => {
  const { batteryId } = req.params;
  const { days = 7, type = 'hourly' } = req.query;
  
  const battery = batteries.find(b => b.batteryId === batteryId);
  if (!battery) {
    return res.status(404).json({ code: 404, message: '电池不存在' });
  }
  
  if (!historyData[batteryId]) {
    historyData[batteryId] = generateMockHistoryData(batteryId, parseInt(days));
  }
  
  let data = historyData[batteryId];
  if (type === 'daily') {
    const dailyData = [];
    const dayMap = {};
    data.forEach(d => {
      const day = new Date(d.timestamp).toDateString();
      if (!dayMap[day]) {
        dayMap[day] = [];
      }
      dayMap[day].push(d);
    });
    Object.keys(dayMap).forEach(day => {
      const dayData = dayMap[day];
      dailyData.push({
        timestamp: new Date(day).getTime(),
        batteryId,
        avgSoc: (dayData.reduce((sum, d) => sum + parseFloat(d.soc), 0) / dayData.length).toFixed(1),
        avgSoh: (dayData.reduce((sum, d) => sum + parseFloat(d.soh), 0) / dayData.length).toFixed(2),
        maxTemp: Math.max(...dayData.map(d => parseFloat(d.maxTemp))).toFixed(1),
        minTemp: Math.min(...dayData.map(d => parseFloat(d.minTemp))).toFixed(1),
        chargingCount: dayData.filter(d => d.status === 'charging').length,
        runningHours: (dayData.filter(d => d.status === 'running').length).toFixed(1)
      });
    });
    data = dailyData;
  }
  
  res.json({
    code: 200,
    data: data.slice(-parseInt(days) * 24),
    total: data.length
  });
});

router.get('/:batteryId/latest', authenticateToken, (req, res) => {
  const { batteryId } = req.params;
  const battery = batteries.find(b => b.batteryId === batteryId);
  
  if (!battery) {
    return res.status(404).json({ code: 404, message: '电池不存在' });
  }
  
  res.json({
    code: 200,
    data: {
      batteryId: b.batteryId,
      vin: b.vin,
      status: b.status,
      soc: b.soc,
      soh: b.currentSoh,
      totalVoltage: b.totalVoltage,
      totalCurrent: b.totalCurrent,
      maxTemp: b.maxTemp,
      minTemp: b.minTemp,
      tempDiff: b.tempDiff,
      maxCellVoltage: b.maxCellVoltage,
      minCellVoltage: b.minCellVoltage,
      voltageDiff: b.voltageDiff,
      insulationResistance: b.insulationResistance,
      cycles: b.cycles,
      faultCodes: b.faultCodes,
      location: b.location,
      timestamp: new Date().toISOString()
    }
  });
});

module.exports = router;
