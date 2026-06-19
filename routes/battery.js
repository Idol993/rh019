const express = require('express');
const { batteries, generateBatteryId, factoryCodes, modelCodes, batteryTypes } = require('../data/store');
const { authenticateToken } = require('./auth');
const crypto = require('crypto');

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  const { page = 1, pageSize = 20, status, batteryType, factoryCode, keyword } = req.query;
  
  let filtered = [...batteries];
  
  if (status) {
    filtered = filtered.filter(b => b.status === status);
  }
  if (batteryType) {
    filtered = filtered.filter(b => b.batteryType === batteryType);
  }
  if (factoryCode) {
    filtered = filtered.filter(b => b.factoryCode === factoryCode);
  }
  if (keyword) {
    filtered = filtered.filter(b => 
      b.batteryId.includes(keyword) || 
      b.vin?.includes(keyword) ||
      b.vehicleModel?.includes(keyword)
    );
  }
  
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

router.get('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const battery = batteries.find(b => b.batteryId === id || b.id === id);
  
  if (!battery) {
    return res.status(404).json({ code: 404, message: '电池档案不存在' });
  }
  
  const traceability = generateTraceability(battery);
  
  res.json({
    code: 200,
    data: {
      ...battery,
      traceability
    }
  });
});

router.post('/', authenticateToken, (req, res) => {
  const { 
    factoryCode, modelCode, productionDate, 
    batteryType, ratedCapacity, nominalVoltage,
    cellModel, batchNo
  } = req.body;
  
  if (!factoryCode || !modelCode || !productionDate || !batteryType) {
    return res.status(400).json({ code: 400, message: '缺少必要字段' });
  }
  
  const serialNum = String(batteries.length + 1).padStart(8, '0');
  const batteryId = generateBatteryId(factoryCode, modelCode, productionDate.replace(/-/g, '').slice(0, 6), serialNum);
  
  const newBattery = {
    id: batteryId,
    batteryId,
    factoryCode,
    modelCode,
    productionDate,
    batteryType,
    ratedCapacity: ratedCapacity || 280,
    nominalVoltage: nominalVoltage || 3.2,
    cellModel: cellModel || 'LFP-280',
    batchNo: batchNo || `BATCH${productionDate.replace(/-/g, '')}`,
    factorySoh: '100.00',
    currentSoh: '100.00',
    cycles: 0,
    totalCapacity: ratedCapacity || 280,
    vin: null,
    vehicleModel: null,
    owner: null,
    region: '待分配',
    status: 'factory',
    installDate: null,
    lastUpdate: new Date().toISOString(),
    nfcId: `NFC${crypto.randomBytes(8).toString('hex').toUpperCase()}`,
    qrCode: `QR${batteryId}`,
    signature: crypto.createHash('sha256').update(batteryId).digest('hex'),
    insulationResistance: '1000.0',
    maxCellVoltage: '3.650',
    minCellVoltage: '3.645',
    voltageDiff: '0.005',
    maxTemp: '25.0',
    minTemp: '24.5',
    tempDiff: '0.5',
    soc: 100,
    totalCurrent: '0.0',
    totalVoltage: '380.0',
    faultCodes: [],
    hardwareVersion: 'BMS_V2.3.1',
    softwareVersion: 'FW_v3.1.5',
    location: { lat: 39.9, lng: 116.4 }
  };
  
  batteries.unshift(newBattery);
  
  res.json({
    code: 200,
    message: '电池档案创建成功',
    data: newBattery
  });
});

router.post('/:id/bind-vin', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { vin, vehicleModel, owner, region } = req.body;
  
  const battery = batteries.find(b => b.batteryId === id || b.id === id);
  
  if (!battery) {
    return res.status(404).json({ code: 404, message: '电池档案不存在' });
  }
  
  if (battery.status !== 'factory') {
    return res.status(400).json({ code: 400, message: '电池状态不允许装车绑定' });
  }
  
  battery.vin = vin;
  battery.vehicleModel = vehicleModel;
  battery.owner = owner;
  battery.region = region || '北京';
  battery.status = 'idle';
  battery.installDate = new Date().toISOString().split('T')[0];
  battery.lastUpdate = new Date().toISOString();
  
  if (global.broadcastData) {
    global.broadcastData({
      type: 'battery_update',
      data: battery
    });
  }
  
  res.json({
    code: 200,
    message: '装车绑定成功',
    data: battery
  });
});

router.get('/:id/traceability', authenticateToken, (req, res) => {
  const { id } = req.params;
  const battery = batteries.find(b => b.batteryId === id || b.id === id);
  
  if (!battery) {
    return res.status(404).json({ code: 404, message: '电池档案不存在' });
  }
  
  res.json({
    code: 200,
    data: generateTraceability(battery)
  });
});

function generateTraceability(battery) {
  const chain = [];
  
  chain.push({
    id: 1,
    stage: '生产出厂',
    status: 'completed',
    timestamp: battery.productionDate,
    location: battery.factoryCode,
    operator: '生产线',
    description: `电池出厂，型号 ${battery.cellModel}，额定容量 ${battery.ratedCapacity}Ah`,
    data: {
      factorySoh: battery.factorySoh,
      batchNo: battery.batchNo,
      nfcId: battery.nfcId
    },
    blockHash: crypto.createHash('sha256').update(`${battery.batteryId}-factory`).digest('hex'),
    onChain: true
  });
  
  if (battery.installDate) {
    chain.push({
      id: 2,
      stage: '装车绑定',
      status: 'completed',
      timestamp: battery.installDate,
      location: battery.region,
      operator: '整车厂',
      description: `装车绑定 VIN: ${battery.vin}，车型: ${battery.vehicleModel}`,
      data: {
        vin: battery.vin,
        vehicleModel: battery.vehicleModel
      },
      blockHash: crypto.createHash('sha256').update(`${battery.batteryId}-install`).digest('hex'),
      onChain: true
    });
  }
  
  if (battery.status === 'running' || battery.status === 'charging' || battery.status === 'idle') {
    chain.push({
      id: 3,
      stage: '车载运行',
      status: 'in_progress',
      timestamp: new Date().toISOString(),
      location: battery.region,
      operator: '车主',
      description: `当前 SOH: ${battery.currentSoh}%，循环次数: ${battery.cycles}`,
      data: {
        currentSoh: battery.currentSoh,
        cycles: battery.cycles,
        soc: battery.soc
      },
      blockHash: null,
      onChain: false
    });
  }
  
  if (battery.status === 'retired' || battery.status === 'echelon' || battery.status === 'dismantled') {
    chain.push({
      id: 3,
      stage: '车载运行',
      status: 'completed',
      timestamp: '2024-06-15',
      location: battery.region,
      operator: '退役检测',
      description: `退役时 SOH: ${battery.currentSoh}%，循环次数: ${battery.cycles}`,
      data: {
        retiredSoh: battery.currentSoh,
        cycles: battery.cycles
      },
      blockHash: crypto.createHash('sha256').update(`${battery.batteryId}-retire`).digest('hex'),
      onChain: true
    });
  }
  
  if (battery.status === 'echelon') {
    chain.push({
      id: 4,
      stage: '梯次利用',
      status: 'in_progress',
      timestamp: '2024-07-01',
      location: '储能电站',
      operator: '梯次利用企业',
      description: '用于储能备电场景梯次利用',
      data: {
        application: '储能电站',
        echelonSoh: battery.currentSoh
      },
      blockHash: null,
      onChain: false
    });
  }
  
  if (battery.status === 'dismantled') {
    chain.push({
      id: 4,
      stage: '拆解回收',
      status: 'completed',
      timestamp: '2024-08-01',
      location: '回收工厂',
      operator: '拆解回收企业',
      description: '完成拆解，提取锂、钴、镍等有价金属',
      data: {
        lithiumRecovery: '95%',
        cobaltRecovery: '92%',
        nickelRecovery: '90%'
      },
      blockHash: crypto.createHash('sha256').update(`${battery.batteryId}-dismantle`).digest('hex'),
      onChain: true
    });
  }
  
  return chain;
}

module.exports = router;
