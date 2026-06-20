const express = require('express');
const { batteries, historyData, generateMockHistoryData } = require('../data/store');
const { 
  authenticateToken, 
  requirePermission,
  hasPermission,
  filterByFactory,
  canAccessBattery
} = require('./auth');

const router = express.Router();

router.get('/realtime', authenticateToken, (req, res) => {
  if (!hasPermission(req.user, 'monitor:read') && !hasPermission(req.user, 'monitor:read_own')) {
    return res.status(403).json({ code: 403, message: '权限不足，需要监控数据读取权限' });
  }
  
  const { batteryIds } = req.query;
  
  let targetBatteries = [...batteries];
  
  targetBatteries = filterByFactory(req, targetBatteries);
  
  if (batteryIds) {
    const ids = batteryIds.split(',');
    targetBatteries = targetBatteries.filter(b => ids.includes(b.batteryId));
  }
  
  const realtimeData = targetBatteries
    .filter(b => ['running', 'charging', 'idle', 'factory'].includes(b.status))
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
      factoryCode: b.factoryCode,
      vehicleModel: b.vehicleModel,
      timestamp: new Date().toISOString()
    }));
  
  res.json({
    code: 200,
    data: realtimeData
  });
});

router.get('/:batteryId/latest', authenticateToken, (req, res) => {
  if (!hasPermission(req.user, 'monitor:read') && !hasPermission(req.user, 'monitor:read_own')) {
    return res.status(403).json({ code: 403, message: '权限不足，需要监控数据读取权限' });
  }
  
  const { batteryId } = req.params;
  const battery = batteries.find(b => b.batteryId === batteryId);
  
  if (!battery) {
    return res.status(404).json({ code: 404, message: '电池不存在' });
  }
  
  if (!canAccessBattery(req, battery)) {
    return res.status(403).json({ code: 403, message: '无权限访问该电池数据' });
  }
  
  const latestData = {
    batteryId: battery.batteryId,
    vin: battery.vin,
    vehicleModel: battery.vehicleModel,
    status: battery.status,
    soc: battery.soc,
    soh: battery.currentSoh,
    voltage: battery.totalVoltage,
    totalVoltage: battery.totalVoltage,
    current: battery.totalCurrent,
    totalCurrent: battery.totalCurrent,
    temperature: battery.maxTemp,
    maxTemp: battery.maxTemp,
    minTemp: battery.minTemp,
    tempDiff: battery.tempDiff,
    maxCellVoltage: battery.maxCellVoltage,
    minCellVoltage: battery.minCellVoltage,
    voltageDiff: battery.voltageDiff,
    insulationResistance: battery.insulationResistance,
    cycles: battery.cycles,
    faultCodes: battery.faultCodes,
    faultCount: battery.faultCount,
    location: battery.location,
    bmsHardwareVersion: battery.bmsHardwareVersion,
    bmsSoftwareVersion: battery.bmsSoftwareVersion,
    factoryCode: battery.factoryCode,
    factoryName: battery.factoryName,
    cellModel: battery.cellModel,
    cellFormula: battery.cellFormula,
    ratedCapacity: battery.ratedCapacity,
    packWeight: battery.packWeight,
    timestamp: new Date().toISOString()
  };
  
  res.json({
    code: 200,
    data: latestData
  });
});

router.get('/:batteryId/history', authenticateToken, (req, res) => {
  if (!hasPermission(req.user, 'monitor:read') && !hasPermission(req.user, 'monitor:read_own')) {
    return res.status(403).json({ code: 403, message: '权限不足，需要监控数据读取权限' });
  }
  
  const { batteryId } = req.params;
  const { days = 7, type = 'hourly' } = req.query;
  
  const battery = batteries.find(b => b.batteryId === batteryId);
  if (!battery) {
    return res.status(404).json({ code: 404, message: '电池不存在' });
  }
  
  if (!canAccessBattery(req, battery)) {
    return res.status(403).json({ code: 403, message: '无权限访问该电池数据' });
  }
  
  if (!historyData[batteryId]) {
    historyData[batteryId] = generateMockHistoryData(batteryId, parseInt(days));
  }
  
  let data = historyData[batteryId];
  
  if (type === 'daily') {
    const dayMap = {};
    data.forEach(d => {
      const day = new Date(d.timestamp).toDateString();
      if (!dayMap[day]) {
        dayMap[day] = [];
      }
      dayMap[day].push(d);
    });
    
    const dailyData = Object.keys(dayMap).map(day => {
      const dayData = dayMap[day];
      return {
        timestamp: new Date(day).getTime(),
        date: day,
        batteryId,
        avgSoc: (dayData.reduce((sum, d) => sum + parseFloat(d.soc), 0) / dayData.length).toFixed(1),
        avgSoh: (dayData.reduce((sum, d) => sum + parseFloat(d.soh), 0) / dayData.length).toFixed(2),
        maxTemp: Math.max(...dayData.map(d => parseFloat(d.maxTemp))).toFixed(1),
        minTemp: Math.min(...dayData.map(d => parseFloat(d.minTemp))).toFixed(1),
        avgVoltage: (dayData.reduce((sum, d) => sum + parseFloat(d.totalVoltage), 0) / dayData.length).toFixed(1),
        chargingHours: (dayData.filter(d => d.status === 'charging').length / 6).toFixed(1),
        runningHours: (dayData.filter(d => d.status === 'running').length / 6).toFixed(1),
        avgMileage: dayData.length > 0 ? dayData[dayData.length - 1].mileage : 0
      };
    });
    
    data = dailyData;
  }
  
  const limit = parseInt(days) * 24;
  const resultData = data.slice(-limit);
  
  res.json({
    code: 200,
    data: resultData,
    total: resultData.length
  });
});

router.get('/:batteryId/alarms', authenticateToken, (req, res) => {
  if (!hasPermission(req.user, 'monitor:read') && !hasPermission(req.user, 'monitor:read_own') &&
      !hasPermission(req.user, 'warning:read') && !hasPermission(req.user, 'warning:read_own')) {
    return res.status(403).json({ code: 403, message: '权限不足，需要监控或预警读取权限' });
  }
  
  const { batteryId } = req.params;
  const { warnings } = require('../data/store');
  
  const battery = batteries.find(b => b.batteryId === batteryId);
  if (!battery) {
    return res.status(404).json({ code: 404, message: '电池不存在' });
  }
  
  if (!canAccessBattery(req, battery)) {
    return res.status(403).json({ code: 403, message: '无权限访问该电池数据' });
  }
  
  const batteryWarnings = warnings.filter(w => w.batteryId === batteryId);
  
  res.json({
    code: 200,
    data: batteryWarnings,
    total: batteryWarnings.length
  });
});

module.exports = router;
