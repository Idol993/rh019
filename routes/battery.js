const express = require('express');
const crypto = require('crypto');
const { 
  batteries, 
  generateBatteryId, 
  generateNfcId, 
  generateQrCode, 
  generateSignature,
  generateFormationData,
  generateInspectionReport,
  getNextSerial,
  factoryCodes,
  factoryNames,
  modelCodes,
  modelNames,
  batteryTypes,
  cellFormulas
} = require('../data/store');
const { 
  authenticateToken, 
  requirePermission, 
  filterByFactory,
  canAccessBattery,
  hasPermission
} = require('./auth');

const router = express.Router();

const REQUIRED_FIELDS = [
  'cellModel',
  'ratedCapacity',
  'nominalVoltage',
  'batteryType',
  'cellFormula',
  'batchNo',
  'productionDate'
];

const FIELD_LABELS = {
  cellModel: '电芯型号',
  ratedCapacity: '额定容量',
  nominalVoltage: '标称电压',
  batteryType: '电池类型',
  cellFormula: '电芯配方',
  batchNo: '生产批次',
  productionDate: '生产日期',
  factorySoh: '出厂SOH'
};

router.get('/', authenticateToken, (req, res) => {
  const { page = 1, pageSize = 20, status, batteryType, factoryCode, keyword } = req.query;
  
  let filtered = [...batteries];
  
  filtered = filterByFactory(req, filtered);
  
  if (status) {
    filtered = filtered.filter(b => b.status === status);
  }
  if (batteryType) {
    filtered = filtered.filter(b => b.batteryType === batteryType);
  }
  if (factoryCode && req.user.role !== 'factory') {
    filtered = filtered.filter(b => b.factoryCode === factoryCode);
  }
  if (keyword) {
    filtered = filtered.filter(b => 
      b.batteryId.includes(keyword) || 
      (b.vin && b.vin.includes(keyword)) ||
      (b.vehicleModel && b.vehicleModel.includes(keyword))
    );
  }
  
  filtered.sort((a, b) => new Date(b.productionDate) - new Date(a.productionDate));
  
  const start = (page - 1) * pageSize;
  const paginated = filtered.slice(start, start + parseInt(pageSize));
  
  const canCreate = hasPermission(req.user, 'battery:create');
  const canExport = hasPermission(req.user, 'export:all') || hasPermission(req.user, 'battery:export');
  const canBindVin = hasPermission(req.user, 'battery:bind_vin');
  
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
      canExport,
      canBindVin
    }
  });
});

router.get('/meta', authenticateToken, (req, res) => {
  let availableFactories = factoryCodes;
  if (req.user.role === 'factory') {
    availableFactories = [req.user.tenant];
  }
  
  res.json({
    code: 200,
    data: {
      factories: availableFactories.map(code => ({
        code,
        name: factoryNames[code]
      })),
      models: modelCodes.map(code => ({
        code,
        name: modelNames[code]
      })),
      batteryTypes: batteryTypes,
      cellFormulas: cellFormulas,
      statusOptions: [
        { value: 'factory', label: '出厂待装车' },
        { value: 'running', label: '运行中' },
        { value: 'charging', label: '充电中' },
        { value: 'idle', label: '待机' },
        { value: 'retired', label: '已退役' },
        { value: 'echelon', label: '梯次利用' },
        { value: 'dismantled', label: '已拆解' }
      ]
    }
  });
});

router.get('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const battery = batteries.find(b => b.batteryId === id || b.id === id);
  
  if (!battery) {
    return res.status(404).json({ code: 404, message: '电池档案不存在' });
  }
  
  if (!canAccessBattery(req, battery)) {
    return res.status(403).json({ code: 403, message: '无权限访问该电池档案' });
  }
  
  const traceability = generateTraceability(battery);
  
  const canEdit = hasPermission(req.user, 'battery:update') || 
    (hasPermission(req.user, 'battery:update_own') && battery.factoryCode === req.user.tenant);
  const canBind = hasPermission(req.user, 'battery:bind_vin');
  
  res.json({
    code: 200,
    data: {
      ...battery,
      traceability
    },
    permissions: {
      canEdit,
      canBind,
      canExport: hasPermission(req.user, 'export:all')
    }
  });
});

router.post('/', authenticateToken, requirePermission('battery:create'), (req, res) => {
  const { 
    factoryCode: reqFactoryCode,
    modelCode,
    productionDate,
    batteryType,
    cellFormula,
    cellModel,
    ratedCapacity,
    nominalVoltage,
    batchNo,
    factorySoh,
    productionLine,
    workOrderNo,
    formationData: formationInput,
    inspectionItems
  } = req.body;
  
  let factoryCode = reqFactoryCode;
  if (req.user.role === 'factory') {
    factoryCode = req.user.tenant;
  }
  
  const missingFields = [];
  
  if (!factoryCode) missingFields.push('factoryCode');
  if (!modelCode) missingFields.push('车型代码');
  if (!productionDate) missingFields.push('生产日期');
  if (!batteryType) missingFields.push('电池类型');
  if (!cellFormula) missingFields.push('电芯配方');
  
  REQUIRED_FIELDS.forEach(field => {
    if (!req.body[field]) {
      missingFields.push(FIELD_LABELS[field] || field);
    }
  });
  
  if (missingFields.length > 0) {
    return res.status(400).json({ 
      code: 400, 
      message: '缺少必填字段',
      missingFields 
    });
  }
  
  if (!factoryCodes.includes(factoryCode)) {
    return res.status(400).json({ code: 400, message: '无效的电池厂编码' });
  }
  
  if (!modelCodes.includes(modelCode)) {
    return res.status(400).json({ code: 400, message: '无效的车型代码' });
  }
  
  if (ratedCapacity <= 0) {
    return res.status(400).json({ code: 400, message: '额定容量必须大于0' });
  }
  if (nominalVoltage <= 0) {
    return res.status(400).json({ code: 400, message: '标称电压必须大于0' });
  }
  if (factorySoh !== undefined && (factorySoh < 0 || factorySoh > 100)) {
    return res.status(400).json({ code: 400, message: '出厂SOH必须在0-100之间' });
  }
  
  const dateStr = productionDate.replace(/-/g, '').substring(0, 6);
  if (dateStr.length !== 6 || isNaN(parseInt(dateStr))) {
    return res.status(400).json({ code: 400, message: '生产日期格式不正确' });
  }
  
  const serial = getNextSerial(factoryCode);
  const batteryId = generateBatteryId(factoryCode, modelCode, dateStr, serial);
  
  const nfcId = generateNfcId();
  const qrCode = generateQrCode(batteryId);
  const signature = generateSignature(batteryId, nfcId);
  
  const formationData = generateFormationData(batteryType);
  formationData.formationDate = productionDate;
  if (formationInput) {
    Object.assign(formationData, formationInput);
  }
  
  const inspectionReport = generateInspectionReport();
  inspectionReport.reportNo = `QC-${factoryCode}-${dateStr}-${serial.substring(4)}`;
  inspectionReport.inspectionDate = productionDate;
  if (inspectionItems) {
    inspectionReport.items = inspectionItems;
    const allPassed = inspectionItems.every(i => i.result === 'passed');
    inspectionReport.overallResult = allPassed ? 'passed' : 'failed';
    inspectionReport.conclusion = allPassed ? '出厂检验合格，准予出厂' : '出厂检验不合格，不予出厂';
  }
  
  let soh = factorySoh;
  if (soh === undefined || soh === null) {
    soh = inspectionReport.overallResult === 'passed' ? 100 : 95;
  }
  
  const newBattery = {
    id: batteryId,
    batteryId,
    factoryCode,
    factoryName: factoryNames[factoryCode],
    modelCode,
    modelName: modelNames[modelCode],
    productionDate,
    productionDateStr: dateStr,
    serialNo: serial,
    checkSum: batteryId.substring(26, 32),
    
    batteryType,
    cellFormula,
    cellModel,
    ratedCapacity: parseFloat(ratedCapacity),
    nominalVoltage: parseFloat(nominalVoltage),
    totalCapacity: parseFloat(ratedCapacity) * 0.85,
    cellCount: 96,
    moduleCount: 4,
    packWeight: (parseFloat(ratedCapacity) * 1.5).toFixed(1),
    
    batchNo,
    productionLine: productionLine || 'Line-01',
    workOrderNo: workOrderNo || `WO${dateStr}${serial.substring(2)}`,
    
    factorySoh: parseFloat(soh).toFixed(2),
    currentSoh: parseFloat(soh).toFixed(2),
    factoryCycles: 0,
    cycles: 0,
    
    formationData,
    inspectionReport,
    
    nfcId,
    qrCode,
    signature,
    verifyStatus: 'verified',
    
    vin: null,
    oemCode: null,
    vehicleModel: null,
    owner: null,
    ownerPhone: null,
    region: null,
    dealer: null,
    
    status: 'factory',
    installDate: null,
    firstActivateDate: null,
    lastServiceDate: null,
    
    lastUpdate: new Date().toISOString(),
    
    insulationResistance: '1000.0',
    maxCellVoltage: (parseFloat(nominalVoltage) / 100 + 0.05).toFixed(3),
    minCellVoltage: (parseFloat(nominalVoltage) / 100).toFixed(3),
    voltageDiff: '0.005',
    maxTemp: '25.0',
    minTemp: '24.5',
    tempDiff: '0.5',
    soc: 100,
    totalCurrent: '0.0',
    totalVoltage: (parseFloat(nominalVoltage) * 96 / 100).toFixed(1),
    faultCodes: [],
    faultCount: 0,
    
    bmsHardwareVersion: 'BMS_HW_V2.3.1',
    bmsSoftwareVersion: 'BMS_SW_v3.1.5',
    bmsVendor: 'BOSCH',
    
    location: { lat: 39.9, lng: 116.4 },
    
    dismantleData: null,
    echelonData: null,
    carbonFootprint: null,
    
    blockChainRecords: []
  };
  
  newBattery.blockChainRecords.push({
    id: 'BC001',
    stage: 'production',
    stageName: '生产出厂',
    timestamp: new Date().toISOString(),
    operator: req.user.name,
    dataHash: crypto.createHash('sha256').update(batteryId + 'production' + Date.now()).digest('hex'),
    blockNumber: Math.floor(1000000 + Math.random() * 9000000),
    txHash: '0x' + crypto.randomBytes(32).toString('hex'),
    status: 'confirmed'
  });
  
  batteries.unshift(newBattery);
  
  if (global.broadcastData) {
    global.broadcastData({
      type: 'battery_created',
      data: {
        batteryId: newBattery.batteryId,
        factoryCode: newBattery.factoryCode,
        status: newBattery.status
      }
    });
  }
  
  res.status(201).json({
    code: 200,
    message: '电池档案创建成功，已上链存证',
    data: newBattery
  });
});

router.post('/:id/bind-vin', authenticateToken, requirePermission('battery:bind_vin'), (req, res) => {
  const { id } = req.params;
  const { vin, vehicleModel, owner, region, oemCode } = req.body;
  
  const battery = batteries.find(b => b.batteryId === id || b.id === id);
  
  if (!battery) {
    return res.status(404).json({ code: 404, message: '电池档案不存在' });
  }
  
  if (battery.status !== 'factory') {
    return res.status(400).json({ code: 400, message: `当前状态为"${battery.status}"，不允许装车绑定` });
  }
  
  if (!vin) {
    return res.status(400).json({ code: 400, message: 'VIN码不能为空' });
  }
  
  if (vin.length < 17) {
    return res.status(400).json({ code: 400, message: 'VIN码长度不正确，应为17位' });
  }
  
  const existing = batteries.find(b => b.vin === vin && b.batteryId !== battery.batteryId);
  if (existing) {
    return res.status(400).json({ code: 400, message: '该VIN码已绑定其他电池' });
  }
  
  battery.vin = vin;
  battery.vehicleModel = vehicleModel || '未知车型';
  battery.owner = owner || '未知车主';
  battery.region = region || '北京';
  battery.oemCode = oemCode || req.user.tenant;
  battery.status = 'idle';
  battery.installDate = new Date().toISOString().split('T')[0];
  battery.firstActivateDate = new Date().toISOString().split('T')[0];
  battery.lastUpdate = new Date().toISOString();
  
  battery.blockChainRecords.push({
    id: 'BC002',
    stage: 'installation',
    stageName: '装车绑定',
    timestamp: new Date().toISOString(),
    operator: req.user.name,
    dataHash: crypto.createHash('sha256').update(battery.batteryId + vin + Date.now()).digest('hex'),
    blockNumber: Math.floor(1100000 + Math.random() * 9000000),
    txHash: '0x' + crypto.randomBytes(32).toString('hex'),
    status: 'confirmed'
  });
  
  if (global.broadcastData) {
    global.broadcastData({
      type: 'battery_update',
      data: battery
    });
  }
  
  res.json({
    code: 200,
    message: '装车绑定成功，绑定记录已上链存证',
    data: battery
  });
});

router.get('/:id/traceability', authenticateToken, (req, res) => {
  const { id } = req.params;
  const battery = batteries.find(b => b.batteryId === id || b.id === id);
  
  if (!battery) {
    return res.status(404).json({ code: 404, message: '电池档案不存在' });
  }
  
  if (!canAccessBattery(req, battery)) {
    return res.status(403).json({ code: 403, message: '无权限访问该电池的溯源信息' });
  }
  
  res.json({
    code: 200,
    data: generateTraceability(battery)
  });
});

router.get('/export/csv', authenticateToken, (req, res) => {
  const canExport = hasPermission(req.user, 'export:all') || hasPermission(req.user, 'battery:export');
  if (!canExport) {
    return res.status(403).json({ code: 403, message: '无权限导出数据' });
  }
  
  const { status, batteryType, factoryCode, keyword } = req.query;
  
  let filtered = [...batteries];
  filtered = filterByFactory(req, filtered);
  
  if (status) filtered = filtered.filter(b => b.status === status);
  if (batteryType) filtered = filtered.filter(b => b.batteryType === batteryType);
  if (factoryCode && req.user.role !== 'factory') {
    filtered = filtered.filter(b => b.factoryCode === factoryCode);
  }
  if (keyword) {
    filtered = filtered.filter(b => 
      b.batteryId.includes(keyword) || 
      (b.vin && b.vin.includes(keyword))
    );
  }
  
  const headers = ['电池ID', '电池类型', '电芯配方', '额定容量(Ah)', '标称电压(V)', '出厂SOH(%)', 
                   '当前SOH(%)', '循环次数', 'VIN码', '车型', '生产批次', '生产厂家', 
                   '生产日期', '状态', '所属区域', 'NFC芯片ID', '校验状态'];
  
  const statusMap = {
    factory: '出厂待装车',
    running: '运行中',
    charging: '充电中',
    idle: '待机',
    retired: '已退役',
    echelon: '梯次利用',
    dismantled: '已拆解'
  };
  
  const rows = filtered.map(b => [
    b.batteryId,
    b.batteryType,
    b.cellFormula,
    b.ratedCapacity,
    b.nominalVoltage,
    b.factorySoh,
    b.currentSoh,
    b.cycles,
    b.vin || '',
    b.vehicleModel || '',
    b.batchNo,
    b.factoryName,
    b.productionDate,
    statusMap[b.status] || b.status,
    b.region || '',
    b.nfcId,
    b.verifyStatus === 'verified' ? '已验证' : '未验证'
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  const filename = `电池档案_${new Date().toISOString().split('T')[0]}.csv`;
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.setHeader('Content-Length', Buffer.byteLength('\ufeff' + csvContent, 'utf8'));
  
  res.send('\ufeff' + csvContent);
});

function generateTraceability(battery) {
  const chain = [];
  
  chain.push({
    id: 1,
    stage: '生产出厂',
    stageKey: 'production',
    status: 'completed',
    timestamp: battery.productionDate,
    location: battery.factoryName,
    operator: '生产线系统',
    description: `电池出厂，型号 ${battery.cellModel}，额定容量 ${battery.ratedCapacity}Ah，${battery.inspectionReport?.conclusion || '检验合格'}`,
    data: {
      factorySoh: battery.factorySoh,
      batchNo: battery.batchNo,
      cellFormula: battery.cellFormula,
      productionLine: battery.productionLine
    },
    onChain: true,
    blockRecord: battery.blockChainRecords?.find(r => r.stage === 'production') || null
  });
  
  if (battery.installDate && battery.vin) {
    chain.push({
      id: 2,
      stage: '装车绑定',
      stageKey: 'installation',
      status: 'completed',
      timestamp: battery.installDate,
      location: battery.region,
      operator: battery.oemCode || '整车厂',
      description: `装车绑定 VIN: ${battery.vin}，车型: ${battery.vehicleModel}`,
      data: {
        vin: battery.vin,
        vehicleModel: battery.vehicleModel,
        owner: battery.owner
      },
      onChain: true,
      blockRecord: battery.blockChainRecords?.find(r => r.stage === 'installation') || null
    });
  }
  
  if (['running', 'charging', 'idle'].includes(battery.status)) {
    chain.push({
      id: 3,
      stage: '车载运行',
      stageKey: 'operation',
      status: 'in_progress',
      timestamp: battery.lastUpdate,
      location: battery.region,
      operator: battery.owner || '车主',
      description: `当前状态：${getStatusText(battery.status)}，SOH: ${battery.currentSoh}%，循环次数: ${battery.cycles}`,
      data: {
        currentSoh: battery.currentSoh,
        cycles: battery.cycles,
        soc: battery.soc,
        maxTemp: battery.maxTemp
      },
      onChain: false,
      blockRecord: null
    });
  }
  
  if (battery.status === 'retired' || battery.status === 'echelon' || battery.status === 'dismantled') {
    const retireRecord = battery.blockChainRecords?.find(r => r.stage === 'retirement');
    chain.push({
      id: 3,
      stage: '车载运行',
      stageKey: 'operation',
      status: 'completed',
      timestamp: retireRecord?.timestamp || battery.lastUpdate,
      location: battery.region,
      operator: '退役检测中心',
      description: `退役时 SOH: ${battery.currentSoh}%，循环次数: ${battery.cycles}`,
      data: {
        retiredSoh: battery.currentSoh,
        cycles: battery.cycles
      },
      onChain: !!retireRecord,
      blockRecord: retireRecord || null
    });
    
    if (retireRecord || battery.status !== 'retired') {
      chain.push({
        id: 4,
        stage: '退役评估',
        stageKey: 'retirement',
        status: 'completed',
        timestamp: retireRecord?.timestamp || battery.lastUpdate,
        location: '退役检测中心',
        operator: '退役检测中心',
        description: `残值评估完成，推荐处理路径：${battery.status === 'dismantled' ? '拆解回收' : '梯次利用'}`,
        data: {
          assessmentScore: battery.status === 'dismantled' ? '45分' : '75分',
          recommendation: battery.status === 'dismantled' ? '强制拆解回收' : '优先梯次利用'
        },
        onChain: !!retireRecord,
        blockRecord: retireRecord || null
      });
    }
  }
  
  if (battery.status === 'echelon' && battery.echelonData) {
    const echelonRecord = battery.blockChainRecords?.find(r => r.stage === 'echelon');
    chain.push({
      id: 5,
      stage: '梯次利用',
      stageKey: 'echelon',
      status: 'in_progress',
      timestamp: battery.echelonData.echelonDate,
      location: battery.echelonData.installLocation,
      operator: battery.echelonData.operator,
      description: `${battery.echelonData.projectName} - ${battery.echelonData.application}`,
      data: {
        projectName: battery.echelonData.projectName,
        echelonLevel: battery.echelonData.echelonLevel,
        echelonSoh: battery.echelonData.echelonSoh,
        expectedLife: battery.echelonData.expectedLife
      },
      onChain: !!echelonRecord,
      blockRecord: echelonRecord || null
    });
  }
  
  if (battery.status === 'dismantled' && battery.dismantleData) {
    const dismantleRecord = battery.blockChainRecords?.find(r => r.stage === 'dismantling');
    chain.push({
      id: 6,
      stage: '拆解回收',
      stageKey: 'dismantling',
      status: 'completed',
      timestamp: battery.dismantleData.dismantleDate,
      location: battery.dismantleData.recycler,
      operator: battery.dismantleData.dismantler,
      description: `拆解完成，锂回收率 ${battery.dismantleData.lithiumRecovery}%，碳减排 ${battery.dismantleData.carbonReductionKg}kgCO₂e`,
      data: {
        lithiumRecovery: battery.dismantleData.lithiumRecovery + '%',
        cobaltRecovery: battery.dismantleData.cobaltRecovery + '%',
        nickelRecovery: battery.dismantleData.nickelRecovery + '%',
        manganeseRecovery: battery.dismantleData.manganeseRecovery + '%',
        carbonReduction: battery.dismantleData.carbonReductionKg + ' kgCO₂e',
        environmentalCert: battery.dismantleData.environmentalCert
      },
      onChain: !!dismantleRecord,
      blockRecord: dismantleRecord || null
    });
  }
  
  return chain;
}

function getStatusText(status) {
  const map = {
    factory: '出厂待装车',
    running: '运行中',
    charging: '充电中',
    idle: '待机',
    retired: '已退役',
    echelon: '梯次利用',
    dismantled: '已拆解'
  };
  return map[status] || status;
}

module.exports = router;
