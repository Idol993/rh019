const express = require('express');
const { batteries, warnings } = require('../data/store');
const { authenticateToken } = require('./auth');

const router = express.Router();

router.get('/overview', authenticateToken, (req, res) => {
  const totalBatteries = batteries.length;
  const activeBatteries = batteries.filter(b => 
    b.status === 'running' || b.status === 'charging' || b.status === 'idle'
  ).length;
  const onlineRate = ((activeBatteries / totalBatteries) * 100).toFixed(1);
  const retiredBatteries = batteries.filter(b => b.status === 'retired').length;
  const echelonBatteries = batteries.filter(b => b.status === 'echelon').length;
  const dismantledBatteries = batteries.filter(b => b.status === 'dismantled').length;
  
  const todayWarnings = warnings.filter(w => {
    const today = new Date().toDateString();
    return new Date(w.timestamp).toDateString() === today;
  });
  
  const avgSoh = batteries.reduce((sum, b) => sum + parseFloat(b.currentSoh), 0) / totalBatteries;
  
  const totalCarbonReduction = batteries
    .filter(b => b.dismantleData)
    .reduce((sum, b) => sum + (b.dismantleData.carbonReductionKg || 0), 0);
  
  const totalLithiumRecovered = batteries
    .filter(b => b.dismantleData)
    .reduce((sum, b) => {
      const weight = parseFloat(b.dismantleData.netWeight || 0);
      const rate = parseFloat(b.dismantleData.lithiumRecovery || 0) / 100;
      return sum + weight * rate * 0.05;
    }, 0);
  
  const echelonCarbonReduction = echelonBatteries * 150;
  const totalCarbonReductionAll = totalCarbonReduction + echelonCarbonReduction;
  
  const data = {
    totalBatteries,
    onlineBatteries: activeBatteries,
    onlineRate: onlineRate + '%',
    runningBatteries: batteries.filter(b => b.status === 'running').length,
    chargingBatteries: batteries.filter(b => b.status === 'charging').length,
    idleBatteries: batteries.filter(b => b.status === 'idle').length,
    retiredBatteries,
    echelonBatteries,
    dismantledBatteries,
    echelonUtilizationRate: ((echelonBatteries / Math.max(1, retiredBatteries + echelonBatteries + dismantledBatteries)) * 100).toFixed(1) + '%',
    todayWarnings: todayWarnings.length,
    criticalWarnings: warnings.filter(w => w.level === 'critical' && w.status === 'pending').length,
    avgSoh: avgSoh.toFixed(2) + '%',
    totalCycles: batteries.reduce((sum, b) => sum + b.cycles, 0),
    carbonReduction: totalCarbonReductionAll.toFixed(0) + ' kgCO₂e',
    recyclingCarbonReduction: totalCarbonReduction.toFixed(0) + ' kgCO₂e',
    echelonCarbonReduction: echelonCarbonReduction.toFixed(0) + ' kgCO₂e',
    totalLithiumRecovered: totalLithiumRecovered.toFixed(2) + ' kg',
    recyclingRate: ((dismantledBatteries / Math.max(1, retiredBatteries + echelonBatteries + dismantledBatteries)) * 100).toFixed(1) + '%'
  };
  
  res.json({
    code: 200,
    data
  });
});

router.get('/soh-distribution', authenticateToken, (req, res) => {
  const ranges = [
    { name: '90%以上', min: 90, max: 100, count: 0 },
    { name: '80%-90%', min: 80, max: 90, count: 0 },
    { name: '70%-80%', min: 70, max: 80, count: 0 },
    { name: '60%-70%', min: 60, max: 70, count: 0 },
    { name: '60%以下', min: 0, max: 60, count: 0 }
  ];
  
  batteries.forEach(b => {
    const soh = parseFloat(b.currentSoh);
    for (const range of ranges) {
      if (soh >= range.min && soh < range.max) {
        range.count++;
        break;
      }
    }
  });
  
  res.json({
    code: 200,
    data: ranges
  });
});

router.get('/type-distribution', authenticateToken, (req, res) => {
  const typeMap = {};
  
  batteries.forEach(b => {
    if (!typeMap[b.batteryType]) {
      typeMap[b.batteryType] = 0;
    }
    typeMap[b.batteryType]++;
  });
  
  const data = Object.keys(typeMap).map(name => ({
    name,
    value: typeMap[name]
  }));
  
  res.json({
    code: 200,
    data
  });
});

router.get('/region-distribution', authenticateToken, (req, res) => {
  const regionMap = {};
  
  batteries.forEach(b => {
    if (!regionMap[b.region]) {
      regionMap[b.region] = 0;
    }
    regionMap[b.region]++;
  });
  
  const data = Object.keys(regionMap)
    .map(name => ({ name, value: regionMap[name] }))
    .sort((a, b) => b.value - a.value);
  
  res.json({
    code: 200,
    data
  });
});

router.get('/factory-ranking', authenticateToken, (req, res) => {
  const factoryMap = {};
  
  batteries.forEach(b => {
    if (!factoryMap[b.factoryCode]) {
      factoryMap[b.factoryCode] = { total: 0, avgSoh: 0, faults: 0 };
    }
    factoryMap[b.factoryCode].total++;
    factoryMap[b.factoryCode].avgSoh += parseFloat(b.currentSoh);
    factoryMap[b.factoryCode].faults += b.faultCodes.length;
  });
  
  const data = Object.keys(factoryMap).map(factory => {
    const item = factoryMap[factory];
    return {
      factory,
      total: item.total,
      avgSoh: (item.avgSoh / item.total).toFixed(2),
      faultRate: ((item.faults / item.total) * 100).toFixed(2) + '%'
    };
  }).sort((a, b) => b.total - a.total);
  
  res.json({
    code: 200,
    data
  });
});

router.get('/realtime-trend', authenticateToken, (req, res) => {
  const { hours = 24 } = req.query;
  const trend = [];
  const now = Date.now();
  
  for (let i = parseInt(hours); i >= 0; i--) {
    const timestamp = now - i * 3600000;
    const onlineCount = Math.floor(25 + Math.sin(i / 4) * 10 + Math.random() * 5);
    const chargingCount = Math.floor(5 + Math.sin(i / 6) * 3 + Math.random() * 2);
    
    trend.push({
      timestamp,
      time: new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      online: onlineCount,
      charging: chargingCount,
      running: onlineCount - chargingCount - Math.floor(onlineCount * 0.2),
      avgSoh: (85 + Math.sin(i / 10) * 2).toFixed(2)
    });
  }
  
  res.json({
    code: 200,
    data: trend
  });
});

router.get('/warning-trend', authenticateToken, (req, res) => {
  const { days = 7 } = req.query;
  const trend = [];
  const now = new Date();
  
  for (let i = parseInt(days); i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    trend.push({
      date: dateStr,
      normal: Math.floor(5 + Math.random() * 10),
      urgent: Math.floor(2 + Math.random() * 5),
      critical: Math.floor(Math.random() * 2),
      total: 0
    });
    const last = trend[trend.length - 1];
    last.total = last.normal + last.urgent + last.critical;
  }
  
  res.json({
    code: 200,
    data: trend
  });
});

router.get('/heatmap', authenticateToken, (req, res) => {
  const regions = [
    { name: '北京', value: 116.407, lat: 39.904, count: 8 },
    { name: '上海', value: 121.473, lat: 31.230, count: 12 },
    { name: '广州', value: 113.264, lat: 23.129, count: 9 },
    { name: '深圳', value: 114.057, lat: 22.543, count: 11 },
    { name: '杭州', value: 120.155, lat: 30.274, count: 7 },
    { name: '成都', value: 104.066, lat: 30.572, count: 6 },
    { name: '武汉', value: 114.305, lat: 30.592, count: 5 },
    { name: '西安', value: 108.939, lat: 34.341, count: 4 },
    { name: '南京', value: 118.796, lat: 32.060, count: 6 },
    { name: '重庆', value: 106.551, lat: 29.563, count: 3 }
  ];
  
  res.json({
    code: 200,
    data: regions
  });
});

module.exports = router;
