const express = require('express');
const { batteries } = require('../data/store');
const { authenticateToken } = require('./auth');
const crypto = require('crypto');

const router = express.Router();

const recycleOrders = [];
const echelonProjects = [
  { id: 1, name: '储能电站备电项目', type: 'energy_storage', capacity: '500kWh', batteries: 20, status: 'operating' },
  { id: 2, name: '低速电动车梯次利用', type: 'low_speed_vehicle', capacity: '200kWh', batteries: 15, status: 'operating' },
  { id: 3, name: '通信基站备用电源', type: 'base_station', capacity: '300kWh', batteries: 30, status: 'installing' },
  { id: 4, name: '家庭储能系统', type: 'home_energy', capacity: '50kWh', batteries: 5, status: 'planning' }
];

router.get('/orders', authenticateToken, (req, res) => {
  const { page = 1, pageSize = 20, status, type } = req.query;
  
  let filtered = [...recycleOrders];
  
  if (status) {
    filtered = filtered.filter(o => o.status === status);
  }
  if (type) {
    filtered = filtered.filter(o => o.type === type);
  }
  
  filtered.sort((a, b) => new Date(b.createTime) - new Date(a.createTime));
  
  const start = (page - 1) * pageSize;
  const paginated = filtered.slice(start, start + parseInt(pageSize));
  
  res.json({
    code: 200,
    data: {
      list: paginated,
      total: filtered.length,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    }
  });
});

router.post('/verify', authenticateToken, (req, res) => {
  const { batteryId, nfcId, qrCode } = req.body;
  
  const battery = batteries.find(b => b.batteryId === batteryId);
  
  if (!battery) {
    return res.status(404).json({ code: 404, message: '电池ID不存在', valid: false });
  }
  
  let valid = true;
  let reasons = [];
  
  if (nfcId && battery.nfcId !== nfcId) {
    valid = false;
    reasons.push('NFC芯片不匹配');
  }
  if (qrCode && battery.qrCode !== qrCode) {
    valid = false;
    reasons.push('二维码不匹配');
  }
  
  const signatureValid = battery.signature === crypto.createHash('sha256').update(batteryId).digest('hex');
  if (!signatureValid) {
    valid = false;
    reasons.push('数字签名验证失败');
  }
  
  res.json({
    code: 200,
    data: {
      valid,
      reasons,
      battery: valid ? battery : null,
      verificationTime: new Date().toISOString()
    }
  });
});

router.post('/retire-assess', authenticateToken, (req, res) => {
  const { batteryId } = req.body;
  
  const battery = batteries.find(b => b.batteryId === batteryId);
  
  if (!battery) {
    return res.status(404).json({ code: 404, message: '电池不存在' });
  }
  
  const soh = parseFloat(battery.currentSoh);
  const cycles = battery.cycles;
  const ageYears = (new Date() - new Date(battery.productionDate)) / (365 * 24 * 3600 * 1000);
  
  const sohScore = Math.max(0, (soh - 60) / 40) * 40;
  const cycleScore = Math.max(0, (1 - cycles / 2000)) * 20;
  const faultScore = battery.faultCodes.length === 0 ? 20 : Math.max(0, 20 - battery.faultCodes.length * 5);
  const ageScore = Math.max(0, (8 - ageYears) / 8) * 10;
  const resistanceScore = parseFloat(battery.voltageDiff) < 0.05 ? 10 : (parseFloat(battery.voltageDiff) < 0.1 ? 5 : 0);
  
  const totalScore = sohScore + cycleScore + faultScore + ageScore + resistanceScore;
  
  let recommendation, recommendedPath;
  if (soh >= 80) {
    recommendation = '优先梯次利用';
    recommendedPath = 'echelon_high';
  } else if (soh >= 60) {
    recommendation = '低速/基站梯次';
    recommendedPath = 'echelon_low';
  } else {
    recommendation = '强制拆解回收';
    recommendedPath = 'dismantle';
  }
  
  const assessment = {
    batteryId,
    assessmentTime: new Date().toISOString(),
    scores: {
      soh: sohScore.toFixed(1),
      cycles: cycleScore.toFixed(1),
      faultHistory: faultScore.toFixed(1),
      age: ageScore.toFixed(1),
      resistance: resistanceScore.toFixed(1)
    },
    totalScore: totalScore.toFixed(1),
    recommendation,
    recommendedPath,
    details: {
      soh: soh + '%',
      cycles: cycles + '次',
      age: ageYears.toFixed(1) + '年',
      voltageDiff: battery.voltageDiff + 'V'
    }
  };
  
  res.json({
    code: 200,
    data: assessment
  });
});

router.get('/echelon-projects', authenticateToken, (req, res) => {
  res.json({
    code: 200,
    data: echelonProjects
  });
});

router.post('/dismantle', authenticateToken, (req, res) => {
  const { batteryId, weight, lithiumRecovery, cobaltRecovery, nickelRecovery, manganeseRecovery, disposalMethod, environmentalCert } = req.body;
  
  const battery = batteries.find(b => b.batteryId === batteryId);
  
  if (!battery) {
    return res.status(404).json({ code: 404, message: '电池不存在' });
  }
  
  battery.status = 'dismantled';
  
  const dismantleRecord = {
    id: `DM${Date.now()}`,
    batteryId,
    weight,
    lithiumRecovery,
    cobaltRecovery,
    nickelRecovery,
    manganeseRecovery,
    disposalMethod,
    environmentalCert,
    operator: req.user.username,
    dismantleTime: new Date().toISOString(),
    blockHash: crypto.createHash('sha256').update(`${batteryId}-dismantle-${Date.now()}`).digest('hex')
  };
  
  res.json({
    code: 200,
    message: '拆解记录已录入',
    data: dismantleRecord
  });
});

module.exports = router;
