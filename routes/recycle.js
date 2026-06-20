const express = require('express');
const crypto = require('crypto');
const { 
  batteries, 
  dismantleOrders, 
  echelonProjects,
  validateBatteryId,
  generateNfcId
} = require('../data/store');
const { 
  authenticateToken, 
  requirePermission,
  hasPermission,
  filterByRecycler,
  canAccessBattery
} = require('./auth');

const router = express.Router();

let dismantleOrderCounter = 1000;

const generateDismantleOrderNo = () => {
  const date = new Date().toISOString().slice(0, 7).replace(/-/g, '');
  dismantleOrderCounter++;
  return `DM${date}${String(dismantleOrderCounter).padStart(6, '0')}`;
};

router.get('/orders', authenticateToken, (req, res) => {
  const { page = 1, pageSize = 20, status, type, batteryId } = req.query;
  
  let filtered = [...dismantleOrders];
  
  filtered = filterByRecycler(req, filtered);
  
  if (status) {
    filtered = filtered.filter(o => o.status === status);
  }
  if (batteryId) {
    filtered = filtered.filter(o => o.batteryId === batteryId);
  }
  
  filtered.sort((a, b) => new Date(b.createTime) - new Date(a.createTime));
  
  const start = (page - 1) * pageSize;
  const paginated = filtered.slice(start, start + parseInt(pageSize));
  
  const canCreate = hasPermission(req.user, 'recycle:dismantle');
  const canVerify = hasPermission(req.user, 'recycle:verify');
  
  res.json({
    code: 200,
    data: {
      list: paginated,
      total: filtered.length,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    },
    permissions: {
      canCreate,
      canVerify
    }
  });
});

router.post('/verify', authenticateToken, requirePermission('recycle:verify'), (req, res) => {
  const { batteryId, nfcId, qrCode } = req.body;
  
  if (!batteryId) {
    return res.status(400).json({ code: 400, message: '电池ID不能为空' });
  }
  
  const idValidation = validateBatteryId(batteryId);
  if (!idValidation.valid) {
    return res.json({
      code: 200,
      data: {
        valid: false,
        reasons: [idValidation.reason],
        battery: null,
        verificationTime: new Date().toISOString()
      }
    });
  }
  
  const battery = batteries.find(b => b.batteryId === batteryId);
  
  if (!battery) {
    return res.json({
      code: 200,
      data: {
        valid: false,
        reasons: ['电池档案不存在，可能为伪造电池'],
        battery: null,
        verificationTime: new Date().toISOString()
      }
    });
  }
  
  if (!canAccessBattery(req, battery)) {
    return res.status(403).json({ code: 403, message: '无权限访问该电池数据' });
  }
  
  let valid = true;
  let reasons = [];
  
  if (nfcId) {
    if (battery.nfcId !== nfcId) {
      valid = false;
      reasons.push('NFC芯片ID不匹配');
    }
  }
  
  if (qrCode) {
    if (battery.qrCode !== qrCode) {
      valid = false;
      reasons.push('二维码内容不匹配');
    }
  }
  
  const expectedSignature = crypto.createHash('sha256').update(`${batteryId}|${battery.nfcId}|battery-secret-key`).digest('hex');
  if (battery.signature !== expectedSignature) {
    valid = false;
    reasons.push('数字签名验证失败');
  }
  
  if (battery.verifyStatus !== 'verified') {
    valid = false;
    reasons.push('电池未通过出厂校验');
  }
  
  if (valid && reasons.length === 0) {
    reasons.push('ID校验通过');
    if (nfcId) reasons.push('NFC芯片验证通过');
    if (qrCode) reasons.push('二维码验证通过');
    reasons.push('数字签名验证通过');
  }
  
  res.json({
    code: 200,
    data: {
      valid,
      reasons,
      battery: valid ? {
        batteryId: battery.batteryId,
        batteryType: battery.batteryType,
        cellFormula: battery.cellFormula,
        cellModel: battery.cellModel,
        ratedCapacity: battery.ratedCapacity,
        nominalVoltage: battery.nominalVoltage,
        factoryName: battery.factoryName,
        productionDate: battery.productionDate,
        currentSoh: battery.currentSoh,
        cycles: battery.cycles,
        status: battery.status,
        vin: battery.vin,
        nfcId: battery.nfcId,
        verifyStatus: battery.verifyStatus,
        dismantleData: battery.dismantleData,
        blockChainRecords: battery.blockChainRecords
      } : null,
      verificationTime: new Date().toISOString(),
      canDismantle: valid && !battery.dismantleData && ['retired', 'echelon', 'idle'].includes(battery.status)
    }
  });
});

router.post('/dismantle-order', authenticateToken, requirePermission('recycle:dismantle'), (req, res) => {
  const { batteryId, type = 'dismantle' } = req.body;
  
  if (!batteryId) {
    return res.status(400).json({ code: 400, message: '电池ID不能为空' });
  }
  
  const battery = batteries.find(b => b.batteryId === batteryId);
  if (!battery) {
    return res.status(404).json({ code: 404, message: '电池不存在' });
  }
  
  if (battery.dismantleData) {
    return res.status(400).json({ code: 400, message: '该电池已有拆解记录，不可重复拆解' });
  }
  
  const idValidation = validateBatteryId(batteryId);
  if (!idValidation.valid) {
    return res.status(400).json({ code: 400, message: '电池ID校验失败，无法创建拆解工单' });
  }
  
  const orderNo = generateDismantleOrderNo();
  const now = new Date().toISOString();
  
  const order = {
    id: orderNo,
    orderNo,
    batteryId,
    batteryType: battery.batteryType,
    batteryModel: battery.cellModel,
    type,
    status: 'pending',
    createTime: now,
    updateTime: now,
    recycler: req.user.name,
    recyclerCode: req.user.tenant,
    operator: req.user.name,
    batteryInfo: {
      ratedCapacity: battery.ratedCapacity,
      currentSoh: battery.currentSoh,
      cycles: battery.cycles,
      packWeight: battery.packWeight
    },
    dismantleData: null
  };
  
  dismantleOrders.unshift(order);
  
  res.status(201).json({
    code: 200,
    message: '拆解工单创建成功',
    data: order
  });
});

router.post('/dismantle', authenticateToken, requirePermission('recycle:dismantle'), (req, res) => {
  const { 
    batteryId, 
    orderNo,
    grossWeight,
    netWeight,
    lithiumRecovery,
    cobaltRecovery,
    nickelRecovery,
    manganeseRecovery,
    copperRecovery,
    aluminumRecovery,
    disposalMethod,
    wasteWaterTreatment,
    wasteResidue,
    environmentalCert,
    certIssuer,
    certValidDate,
    dismantler,
    remark
  } = req.body;
  
  if (!batteryId) {
    return res.status(400).json({ code: 400, message: '电池ID不能为空' });
  }
  
  const battery = batteries.find(b => b.batteryId === batteryId);
  if (!battery) {
    return res.status(404).json({ code: 404, message: '电池不存在' });
  }
  
  if (battery.dismantleData) {
    return res.status(400).json({ code: 400, message: '该电池已拆解，不可重复提交' });
  }
  
  if (!grossWeight || !lithiumRecovery || !environmentalCert) {
    return res.status(400).json({ 
      code: 400, 
      message: '缺少必填项：毛重、锂回收率、环保凭证编号为必填项' 
    });
  }
  
  const baseCarbon = parseFloat(grossWeight) * 0.8;
  const lithiumCarbon = parseFloat(lithiumRecovery) * 2.5;
  const cobaltCarbon = parseFloat(cobaltRecovery || 0) * 3.0;
  const nickelCarbon = parseFloat(nickelRecovery || 0) * 2.8;
  const totalCarbonReduction = Math.floor(baseCarbon + lithiumCarbon + cobaltCarbon + nickelCarbon);
  
  const dismantleData = {
    orderNo: orderNo || generateDismantleOrderNo(),
    dismantleDate: new Date().toISOString().split('T')[0],
    recycler: req.user.name,
    recyclerCode: req.user.tenant,
    dismantler: dismantler || req.user.name,
    grossWeight: parseFloat(grossWeight).toFixed(1),
    netWeight: parseFloat(netWeight || grossWeight * 0.95).toFixed(1),
    lithiumRecovery: parseFloat(lithiumRecovery).toFixed(1),
    cobaltRecovery: parseFloat(cobaltRecovery || 0).toFixed(1),
    nickelRecovery: parseFloat(nickelRecovery || 0).toFixed(1),
    manganeseRecovery: parseFloat(manganeseRecovery || 0).toFixed(1),
    copperRecovery: parseFloat(copperRecovery || 0).toFixed(1),
    aluminumRecovery: parseFloat(aluminumRecovery || 0).toFixed(1),
    disposalMethod: disposalMethod || '湿法冶金回收',
    wasteWaterTreatment: wasteWaterTreatment || '达标排放',
    wasteResidue: wasteResidue || '危废专业处置',
    environmentalCert,
    certIssuer: certIssuer || '当地生态环境局',
    certValidDate: certValidDate || (new Date().getFullYear() + 1) + '-12-31',
    carbonReductionKg: totalCarbonReduction,
    remark: remark || '拆解完成，有价金属全部回收',
    submitTime: new Date().toISOString(),
    operator: req.user.name
  };
  
  battery.dismantleData = dismantleData;
  battery.status = 'dismantled';
  battery.lastUpdate = new Date().toISOString();
  
  const blockRecord = {
    id: 'BC006',
    stage: 'dismantling',
    stageName: '拆解回收',
    timestamp: new Date().toISOString(),
    operator: req.user.name,
    dataHash: crypto.createHash('sha256').update(battery.batteryId + 'dismantle' + Date.now()).digest('hex'),
    blockNumber: Math.floor(1300000 + Math.random() * 9000000),
    txHash: '0x' + crypto.randomBytes(32).toString('hex'),
    status: 'confirmed'
  };
  
  if (!battery.blockChainRecords.find(r => r.stage === 'retirement')) {
    battery.blockChainRecords.push({
      id: 'BC004',
      stage: 'retirement',
      stageName: '退役评估',
      timestamp: new Date().toISOString(),
      operator: '退役检测中心',
      dataHash: crypto.createHash('sha256').update(battery.batteryId + 'retire' + Date.now()).digest('hex'),
      blockNumber: Math.floor(1200000 + Math.random() * 9000000),
      txHash: '0x' + crypto.randomBytes(32).toString('hex'),
      status: 'confirmed'
    });
  }
  
  battery.blockChainRecords.push(blockRecord);
  
  const existingOrder = dismantleOrders.find(o => o.orderNo === orderNo);
  if (existingOrder) {
    existingOrder.status = 'completed';
    existingOrder.completeTime = new Date().toISOString();
    existingOrder.dismantleData = dismantleData;
  } else {
    dismantleOrders.unshift({
      id: dismantleData.orderNo,
      orderNo: dismantleData.orderNo,
      batteryId,
      batteryType: battery.batteryType,
      status: 'completed',
      createTime: new Date().toISOString(),
      completeTime: new Date().toISOString(),
      recycler: req.user.name,
      data: dismantleData
    });
  }
  
  if (global.broadcastData) {
    global.broadcastData({
      type: 'battery_dismantled',
      data: {
        batteryId: battery.batteryId,
        carbonReduction: totalCarbonReduction,
        lithiumRecovery: dismantleData.lithiumRecovery
      }
    });
  }
  
  res.status(201).json({
    code: 200,
    message: '拆解记录提交成功，数据已上链存证',
    data: dismantleData
  });
});

router.get('/dismantle/:orderNo', authenticateToken, (req, res) => {
  const { orderNo } = req.params;
  const order = dismantleOrders.find(o => o.orderNo === orderNo);
  
  if (!order) {
    return res.status(404).json({ code: 404, message: '拆解工单不存在' });
  }
  
  const battery = batteries.find(b => b.batteryId === order.batteryId);
  if (!canAccessBattery(req, battery)) {
    return res.status(403).json({ code: 403, message: '无权限访问该工单' });
  }
  
  res.json({
    code: 200,
    data: order
  });
});

router.post('/retire-assess', authenticateToken, (req, res) => {
  const { batteryId } = req.body;
  
  if (!batteryId) {
    return res.status(400).json({ code: 400, message: '电池ID不能为空' });
  }
  
  const battery = batteries.find(b => b.batteryId === batteryId);
  
  if (!battery) {
    return res.status(404).json({ code: 404, message: '电池不存在' });
  }
  
  if (!canAccessBattery(req, battery)) {
    return res.status(403).json({ code: 403, message: '无权限访问该电池数据' });
  }
  
  const soh = parseFloat(battery.currentSoh);
  const cycles = battery.cycles;
  const ageYears = (new Date() - new Date(battery.productionDate)) / (365 * 24 * 3600 * 1000);
  
  const sohScore = Math.max(0, ((soh - 60) / 40) * 40);
  const cycleScore = Math.max(0, (1 - cycles / 2000)) * 20;
  const faultScore = battery.faultCount === 0 ? 20 : Math.max(0, 20 - battery.faultCount * 3);
  const ageScore = Math.max(0, (8 - ageYears) / 8) * 10;
  const resistanceScore = parseFloat(battery.voltageDiff) < 0.05 ? 10 : (parseFloat(battery.voltageDiff) < 0.1 ? 5 : 0);
  
  const totalScore = sohScore + cycleScore + faultScore + ageScore + resistanceScore;
  
  let recommendation, recommendedPath, canEchelon;
  if (soh >= 80) {
    recommendation = '优先梯次利用（储能/备电场景）';
    recommendedPath = 'echelon_high';
    canEchelon = true;
  } else if (soh >= 60) {
    recommendation = '低速车/基站/二轮车梯次利用';
    recommendedPath = 'echelon_low';
    canEchelon = true;
  } else {
    recommendation = '强制拆解回收';
    recommendedPath = 'dismantle';
    canEchelon = false;
  }
  
  const assessment = {
    batteryId,
    assessmentTime: new Date().toISOString(),
    assessor: req.user.name,
    scores: {
      soh: sohScore.toFixed(1),
      cycles: cycleScore.toFixed(1),
      faultHistory: faultScore.toFixed(1),
      age: ageScore.toFixed(1),
      resistance: resistanceScore.toFixed(1)
    },
    totalScore: totalScore.toFixed(1),
    maxScore: 100,
    recommendation,
    recommendedPath,
    canEchelon,
    canDismantle: true,
    details: {
      soh: soh + '%',
      cycles: cycles + '次',
      age: ageYears.toFixed(1) + '年',
      voltageDiff: battery.voltageDiff + 'V',
      faultCount: battery.faultCount + '次'
    },
    echelonSuggestion: canEchelon ? [
      { level: '第一梯队', scenario: '电网侧储能', soh: '≥80%', suitable: soh >= 80 },
      { level: '第二梯队', scenario: '通信基站/备电', soh: '60%-80%', suitable: soh >= 60 && soh < 80 },
      { level: '第三梯队', scenario: '低速电动车', soh: '60%-70%', suitable: soh >= 60 }
    ] : [],
    dismantleSuggestion: !canEchelon ? [
      { material: '锂', recoveryRate: '95%+', method: '湿法冶金' },
      { material: '钴', recoveryRate: '92%+', method: '萃取分离' },
      { material: '镍', recoveryRate: '90%+', method: '萃取分离' },
      { material: '铜铝', recoveryRate: '98%+', method: '物理分选' }
    ] : []
  };
  
  res.json({
    code: 200,
    data: assessment
  });
});

router.get('/echelon-projects', authenticateToken, (req, res) => {
  const { status, type } = req.query;
  
  let filtered = [...echelonProjects];
  
  if (status) {
    filtered = filtered.filter(p => p.status === status);
  }
  if (type) {
    filtered = filtered.filter(p => p.type === type);
  }
  
  const canCreate = hasPermission(req.user, 'recycle:echelon');
  
  res.json({
    code: 200,
    data: filtered,
    permissions: {
      canCreate
    }
  });
});

router.get('/stats', authenticateToken, (req, res) => {
  const total = batteries.length;
  const dismantled = batteries.filter(b => b.status === 'dismantled').length;
  const echelon = batteries.filter(b => b.status === 'echelon').length;
  const retired = batteries.filter(b => b.status === 'retired').length;
  
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
  
  const completedOrders = dismantleOrders.filter(o => o.status === 'completed').length;
  const pendingOrders = dismantleOrders.filter(o => o.status === 'pending').length;
  
  res.json({
    code: 200,
    data: {
      totalBatteries: total,
      dismantledCount: dismantled,
      echelonCount: echelon,
      retiredCount: retired,
      echelonUtilizationRate: ((echelon / Math.max(1, retired + echelon + dismantled)) * 100).toFixed(1) + '%',
      recyclingRate: ((dismantled / Math.max(1, retired + echelon + dismantled)) * 100).toFixed(1) + '%',
      totalCarbonReduction: totalCarbonReduction.toFixed(0) + ' kgCO₂e',
      totalLithiumRecovered: totalLithiumRecovered.toFixed(2) + ' kg',
      completedOrders,
      pendingOrders,
      totalOrders: dismantleOrders.length
    }
  });
});

module.exports = router;
