const crypto = require('crypto');

const factoryCodes = ['CATLBJ', 'BYDSZN', 'GOTSHH', 'EVEHZH', 'SVOLTC'];
const factoryNames = {
  'CATLBJ': '宁德时代北京工厂',
  'BYDSZN': '比亚迪深圳工厂',
  'GOTSHH': '国轩高科上海工厂',
  'EVEHZH': '亿纬锂能惠州工厂',
  'SVOLTC': '蜂巢能源科技'
};

const modelCodes = ['MDL001', 'MDL002', 'MDL003', 'MDL004', 'MDL005'];
const modelNames = {
  'MDL001': '乘用车型',
  'MDL002': 'SUV车型',
  'MDL003': '商用车型',
  'MDL004': '物流车型',
  'MDL005': '专用车型'
};

const batteryTypes = ['三元锂', '磷酸铁锂', '锰酸锂'];
const cellFormulas = {
  '三元锂': ['NCM523', 'NCM622', 'NCM811', 'NCA'],
  '磷酸铁锂': ['LFP-1', 'LFP-2', 'LFP-H'],
  '锰酸锂': ['LMO-1', 'LMO-HR']
};

const generateBatteryId = (factoryCode, modelCode, productionDate, serialNum) => {
  if (!factoryCode || factoryCode.length !== 6) {
    throw new Error('电池厂编码必须为6位');
  }
  if (!modelCode || modelCode.length !== 6) {
    throw new Error('车型代码必须为6位');
  }
  if (!productionDate || productionDate.length !== 6) {
    throw new Error('生产年月必须为6位(YYYYMM)');
  }
  if (!serialNum || serialNum.length !== 8) {
    throw new Error('序列号必须为8位');
  }
  
  const base = `${factoryCode}${modelCode}${productionDate}${serialNum}`;
  const checkSum = crypto.createHash('md5').update(base).digest('hex').substring(0, 6).toUpperCase();
  
  return base + checkSum;
};

const validateBatteryId = (batteryId) => {
  if (!batteryId || batteryId.length !== 32) {
    return { valid: false, reason: 'ID长度不正确，应为32位' };
  }
  
  const factoryCode = batteryId.substring(0, 6);
  const modelCode = batteryId.substring(6, 12);
  const productionDate = batteryId.substring(12, 18);
  const serialNum = batteryId.substring(18, 26);
  const checkSum = batteryId.substring(26, 32);
  
  const base = `${factoryCode}${modelCode}${productionDate}${serialNum}`;
  const expectedCheckSum = crypto.createHash('md5').update(base).digest('hex').substring(0, 6).toUpperCase();
  
  if (checkSum !== expectedCheckSum) {
    return { valid: false, reason: '校验位不匹配，ID可能被篡改' };
  }
  
  if (!factoryCodes.includes(factoryCode)) {
    return { valid: false, reason: '电池厂编码不存在' };
  }
  
  return { 
    valid: true, 
    factoryCode, 
    modelCode, 
    productionDate, 
    serialNum,
    factoryName: factoryNames[factoryCode]
  };
};

const generateNfcId = () => {
  return 'NFC' + crypto.randomBytes(10).toString('hex').toUpperCase();
};

const generateQrCode = (batteryId) => {
  return `QR:${batteryId}:${crypto.createHash('sha1').update(batteryId).digest('hex').substring(0, 8).toUpperCase()}`;
};

const generateSignature = (batteryId, nfcId) => {
  return crypto.createHash('sha256').update(`${batteryId}|${nfcId}|battery-secret-key`).digest('hex');
};

const generateFormationData = (batteryType) => {
  return {
    formationDate: null,
    initialCapacity: batteryType === '磷酸铁锂' ? (280 + Math.random() * 5).toFixed(2) : (220 + Math.random() * 5).toFixed(2),
    firstChargeCapacity: (0),
    firstDischargeCapacity: (0),
    firstEfficiency: (95 + Math.random() * 3).toFixed(2),
    cycleFormationCount: Math.floor(2 + Math.random() * 3),
    formationVoltage: batteryType === '磷酸铁锂' ? '3.65' : '4.2',
    formationCurrent: '0.5C',
    highTempStorage: (45 + Math.random() * 5).toFixed(1) + '℃/7天',
    lowTempDischarge: (-20 + Math.random() * 5).toFixed(1) + '℃/' + (0.5 + Math.random() * 0.3).toFixed(2) + 'C',
    acImpedance: (1.5 + Math.random() * 1).toFixed(2) + 'mΩ',
    dcInternalResistance: (2.0 + Math.random() * 1.5).toFixed(2) + 'mΩ',
    selfDischargeRate: (1.5 + Math.random() * 1).toFixed(2) + '%/月',
    formationStatus: 'passed',
    formationOperator: '生产线自动',
    formationEquipment: 'FCM-2000'
  };
};

const generateInspectionReport = () => {
  const items = [
    { name: '外观检查', result: 'passed', standard: '无变形、无漏液、无划痕' },
    { name: '尺寸检查', result: 'passed', standard: '符合图纸要求' },
    { name: '重量检查', result: 'passed', standard: '标称重量±2%' },
    { name: '绝缘耐压', result: 'passed', standard: '≥2000V AC/1min' },
    { name: '绝缘电阻', result: 'passed', standard: '≥100MΩ' },
    { name: '容量检测', result: 'passed', standard: '≥额定容量100%' },
    { name: '内阻检测', result: 'passed', standard: '≤标称内阻105%' },
    { name: 'SOC校准', result: 'passed', standard: '误差≤±2%' },
    { name: 'BMS通信', result: 'passed', standard: 'CAN/UART正常' },
    { name: '温度传感器', result: 'passed', standard: '误差≤±1℃' },
    { name: '电压采样', result: 'passed', standard: '误差≤±5mV' },
    { name: '电流采样', result: 'passed', standard: '误差≤±1%' }
  ];
  
  const allPassed = items.every(i => i.result === 'passed');
  
  return {
    reportNo: '',
    inspectionDate: null,
    inspector: '质检系统自动',
    items,
    overallResult: allPassed ? 'passed' : 'failed',
    conclusion: allPassed ? '出厂检验合格，准予出厂' : '出厂检验不合格，不予出厂',
    qcApproval: 'QC-' + Math.floor(Math.random() * 1000),
    reportStatus: 'issued'
  };
};

let batterySerialCounter = {};
factoryCodes.forEach(fc => {
  batterySerialCounter[fc] = Math.floor(Math.random() * 100) + 1;
});

const getNextSerial = (factoryCode) => {
  if (!batterySerialCounter[factoryCode]) {
    batterySerialCounter[factoryCode] = 1;
  }
  const serial = String(batterySerialCounter[factoryCode]).padStart(8, '0');
  batterySerialCounter[factoryCode]++;
  return serial;
};

const generateMockBatteries = () => {
  const batteries = [];
  const regions = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '西安', '南京', '重庆'];
  const oemCodes = ['BYD', 'TSLA', 'NIO', 'XPENG', 'LI', 'GEELY'];
  
  for (let i = 1; i <= 60; i++) {
    const factoryCode = factoryCodes[i % factoryCodes.length];
    const modelCode = modelCodes[i % modelCodes.length];
    const year = 2022 + Math.floor(i / 20);
    const month = String(((i % 12) + 1)).padStart(2, '0');
    const yearMonth = `${year}${month}`;
    const serial = String(i).padStart(8, '0');
    const batteryId = generateBatteryId(factoryCode, modelCode, yearMonth, serial);
    const batteryType = batteryTypes[i % batteryTypes.length];
    const formula = cellFormulas[batteryType][i % cellFormulas[batteryType].length];
    
    const factorySoh = 100;
    const cycles = Math.floor(Math.random() * 600);
    const currentSoh = Math.max(60, 100 - cycles * 0.04 - Math.random() * 5);
    
    const statuses = ['running', 'charging', 'idle', 'retired', 'echelon', 'dismantled'];
    let status;
    if (i > 55) {
      status = 'dismantled';
    } else if (i > 52) {
      status = 'echelon';
    } else if (i > 49) {
      status = 'retired';
    } else {
      status = statuses[Math.floor(Math.random() * 3)];
    }
    
    const nfcId = generateNfcId();
    const qrCode = generateQrCode(batteryId);
    const signature = generateSignature(batteryId, nfcId);
    
    const formationData = generateFormationData(batteryType);
    formationData.formationDate = `${year}-${month}-10`;
    formationData.firstChargeCapacity = (formationData.initialCapacity * 1.05).toFixed(2);
    formationData.firstDischargeCapacity = formationData.initialCapacity;
    
    const inspectionReport = generateInspectionReport();
    inspectionReport.reportNo = `QC-${factoryCode}-${yearMonth}-${String(i).padStart(4, '0')}`;
    inspectionReport.inspectionDate = `${year}-${month}-14`;
    
    const oemCode = oemCodes[i % oemCodes.length];
    const vin = ['retired', 'echelon', 'dismantled'].includes(status) ? null : `VIN${oemCode}${String(100000 + i).padStart(10, '0')}`;
    const vehicleModel = ['Model 3', '汉EV', '唐DM-i', '蔚来ET5', '小鹏P7', '理想L9', '极氪001'][i % 7];
    
    const battery = {
      id: batteryId,
      batteryId,
      factoryCode,
      factoryName: factoryNames[factoryCode],
      modelCode,
      modelName: modelNames[modelCode],
      productionDate: `${year}-${month}-15`,
      productionDateStr: yearMonth,
      serialNo: serial,
      checkSum: batteryId.substring(26, 32),
      
      batteryType,
      cellFormula: formula,
      cellModel: `${formula}-${batteryType === '磷酸铁锂' ? 'LFP' : 'NCM'}${Math.floor(Math.random() * 100)}`,
      ratedCapacity: parseFloat(batteryType === '磷酸铁锂' ? 280 : 220),
      nominalVoltage: parseFloat(batteryType === '磷酸铁锂' ? 3.2 : 3.7),
      totalCapacity: Math.floor(60 + Math.random() * 80),
      cellCount: Math.floor(96 + Math.random() * 20),
      moduleCount: Math.floor(4 + Math.random() * 4),
      packWeight: (400 + Math.random() * 100).toFixed(1),
      
      batchNo: `BATCH${yearMonth}${String(Math.floor(i / 10)).padStart(3, '0')}`,
      productionBatch: `BATCH${yearMonth}${String(Math.floor(i / 10)).padStart(3, '0')}`,
      productionLine: `Line-${String((i % 3) + 1).padStart(2, '0')}`,
      workOrderNo: `WO${yearMonth}${String(i).padStart(6, '0')}`,
      
      factorySoh: factorySoh.toFixed(2),
      currentSoh: currentSoh.toFixed(2),
      factoryCycles: 0,
      cycles,
      
      formationData,
      inspectionReport,
      
      nfcId,
      qrCode,
      signature,
      digitalSignature: signature,
      verifyStatus: 'verified',
      inspectionStatus: 'qualified',
      
      vin,
      oemCode,
      vehicleModel,
      owner: `车主${i}`,
      ownerPhone: `138${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`,
      region: regions[i % regions.length],
      dealer: `${regions[i % regions.length]}4S店`,
      
      status,
      installDate: vin ? `${year + 1}-${month}-10` : null,
      firstActivateDate: vin ? `${year + 1}-${month}-15` : null,
      lastServiceDate: vin ? `${year + 2}-06-01` : null,
      
      lastUpdate: new Date().toISOString(),
      
      insulationResistance: (500 + Math.random() * 1000).toFixed(1),
      maxCellVoltage: (batteryType === '磷酸铁锂' ? 3.55 : 4.15 + Math.random() * 0.05).toFixed(3),
      minCellVoltage: (batteryType === '磷酸铁锂' ? 3.25 : 3.65 + Math.random() * 0.05).toFixed(3),
      voltageDiff: (0.01 + Math.random() * 0.08).toFixed(3),
      maxTemp: (25 + Math.random() * 15).toFixed(1),
      minTemp: (20 + Math.random() * 10).toFixed(1),
      tempDiff: (2 + Math.random() * 8).toFixed(1),
      soc: Math.floor(20 + Math.random() * 70),
      totalCurrent: status === 'charging' ? -(20 + Math.random() * 100) : (status === 'running' ? (50 + Math.random() * 150) : 0.5),
      totalVoltage: (batteryType === '磷酸铁锂' ? 320 : 380 + Math.random() * 30).toFixed(1),
      faultCodes: [],
      faultCount: 0,
      
      bmsHardwareVersion: 'BMS_HW_V2.3.1',
      bmsSoftwareVersion: 'BMS_SW_v3.1.5',
      bmsVendor: 'BOSCH',
      
      location: {
        lat: 30 + Math.random() * 10,
        lng: 105 + Math.random() * 20
      },
      
      dismantleData: null,
      echelonData: null,
      
      carbonFootprint: null,
      
      blockChainRecords: []
    };
    
    battery.blockChainRecords.push({
      id: 'BC001',
      stage: 'production',
      stageName: '生产出厂',
      timestamp: `${year}-${month}-15T08:00:00.000Z`,
      operator: '生产线系统',
      dataHash: crypto.createHash('sha256').update(batteryId + 'production').digest('hex'),
      blockNumber: 1000000 + i * 3,
      txHash: '0x' + crypto.randomBytes(32).toString('hex'),
      status: 'confirmed'
    });
    
    if (vin) {
      battery.blockChainRecords.push({
        id: 'BC002',
        stage: 'installation',
        stageName: '装车绑定',
        timestamp: `${year + 1}-${month}-10T10:00:00.000Z`,
        operator: oemCode,
        dataHash: crypto.createHash('sha256').update(batteryId + vin).digest('hex'),
        blockNumber: 1100000 + i * 3,
        txHash: '0x' + crypto.randomBytes(32).toString('hex'),
        status: 'confirmed'
      });
    }
    
    if (status === 'dismantled') {
      battery.dismantleData = {
        orderNo: `DM${year + 3}${String(i).padStart(6, '0')}`,
        dismantleDate: `${year + 3}-${month}-01`,
        recycler: '格林美循环科技',
        dismantler: '张工',
        grossWeight: (420 + Math.random() * 50).toFixed(1),
        netWeight: (380 + Math.random() * 40).toFixed(1),
        lithiumRecovery: (93 + Math.random() * 5).toFixed(1),
        cobaltRecovery: (90 + Math.random() * 5).toFixed(1),
        nickelRecovery: (88 + Math.random() * 5).toFixed(1),
        manganeseRecovery: (85 + Math.random() * 5).toFixed(1),
        copperRecovery: (92 + Math.random() * 4).toFixed(1),
        aluminumRecovery: (90 + Math.random() * 5).toFixed(1),
        disposalMethod: '湿法冶金回收',
        wasteWaterTreatment: '达标排放',
        wasteResidue: '危废专业处置',
        environmentalCert: `EP${year + 3}${String(Math.floor(Math.random() * 10000)).padStart(6, '0')}`,
        certIssuer: '生态环境局',
        certValidDate: `${year + 4}-${month}-01`,
        carbonReductionKg: Math.floor(150 + Math.random() * 100),
        remark: '拆解完成，有价金属全部回收'
      };
      
      battery.blockChainRecords.push({
        id: 'BC006',
        stage: 'dismantling',
        stageName: '拆解回收',
        timestamp: `${year + 3}-${month}-01T14:00:00.000Z`,
        operator: '格林美循环科技',
        dataHash: crypto.createHash('sha256').update(batteryId + 'dismantle').digest('hex'),
        blockNumber: 1300000 + i * 3,
        txHash: '0x' + crypto.randomBytes(32).toString('hex'),
        status: 'confirmed'
      });
    }
    
    if (status === 'echelon') {
      battery.echelonData = {
        projectName: '储能电站备电项目',
        projectType: 'energy_storage',
        echelonLevel: 'first',
        application: '电网侧储能',
        installLocation: '张家口储能站',
        echelonDate: `${year + 3}-${month}-01`,
        echelonSoh: currentSoh.toFixed(2),
        expectedLife: '5-8年',
        operator: '梯次利用科技公司',
        projectCapacity: '500kWh',
        remark: '第一梯队，用于储能'
      };
      
      battery.blockChainRecords.push({
        id: 'BC005',
        stage: 'echelon',
        stageName: '梯次利用',
        timestamp: `${year + 3}-${month}-01T10:00:00.000Z`,
        operator: '梯次利用科技公司',
        dataHash: crypto.createHash('sha256').update(batteryId + 'echelon').digest('hex'),
        blockNumber: 1250000 + i * 3,
        txHash: '0x' + crypto.randomBytes(32).toString('hex'),
        status: 'confirmed'
      });
    }
    
    if (status === 'retired') {
      battery.blockChainRecords.push({
        id: 'BC004',
        stage: 'retirement',
        stageName: '退役评估',
        timestamp: `${year + 3}-${month}-01T09:00:00.000Z`,
        operator: '退役检测中心',
        dataHash: crypto.createHash('sha256').update(batteryId + 'retire').digest('hex'),
        blockNumber: 1200000 + i * 3,
        txHash: '0x' + crypto.randomBytes(32).toString('hex'),
        status: 'confirmed'
      });
    }
    
    batteries.push(battery);
  }
  
  return batteries;
};

const generateMockHistoryData = (batteryId, days = 30) => {
  const data = [];
  const now = Date.now();
  const baseSoh = 80 + Math.random() * 15;
  
  for (let i = days * 24; i >= 0; i--) {
    const timestamp = now - i * 3600000;
    const hour = new Date(timestamp).getHours();
    const isRunning = hour >= 7 && hour <= 19 && Math.random() > 0.3;
    const isCharging = (hour >= 20 || hour <= 6) && Math.random() > 0.5;
    
    let soc = 50 + Math.sin(i / 12) * 30 + Math.random() * 10;
    soc = Math.max(10, Math.min(100, soc));
    
    let temp = 25 + Math.sin(hour / 24 * Math.PI * 2) * 8 + Math.random() * 3;
    
    data.push({
      timestamp,
      batteryId,
      totalVoltage: (350 + Math.random() * 30).toFixed(1),
      totalCurrent: isCharging ? -(30 + Math.random() * 50) : (isRunning ? 80 + Math.random() * 100 : 0.5),
      soc: soc.toFixed(1),
      soh: (baseSoh - (days * 24 - i) * 0.001).toFixed(2),
      maxTemp: temp.toFixed(1),
      minTemp: (temp - 3 - Math.random() * 3).toFixed(1),
      tempDiff: (3 + Math.random() * 4).toFixed(1),
      maxCellVoltage: (3.65 + Math.random() * 0.1).toFixed(3),
      minCellVoltage: (3.45 + Math.random() * 0.1).toFixed(3),
      voltageDiff: (0.02 + Math.random() * 0.08).toFixed(3),
      insulationResistance: (800 + Math.random() * 400).toFixed(1),
      status: isCharging ? 'charging' : (isRunning ? 'running' : 'idle'),
      mileage: Math.floor(10000 + i * 2 + Math.random() * 5)
    });
  }
  return data;
};

const users = [
  { 
    id: 1, 
    username: 'admin', 
    password: 'admin123', 
    role: 'admin', 
    name: '系统管理员', 
    tenant: 'system',
    permissions: ['*:*'],
    menus: ['dashboard', 'battery', 'monitor', 'trace', 'warning', 'recycle', 'carbon', 'system']
  },
  { 
    id: 2, 
    username: 'factory1', 
    password: 'factory123', 
    role: 'factory', 
    name: '宁德时代北京工厂', 
    tenant: 'CATLBJ',
    permissions: ['battery:create', 'battery:read_own', 'battery:update_own', 'monitor:read_own', 'warning:read_own', 'trace:read_own', 'dashboard:read'],
    menus: ['dashboard', 'battery', 'monitor', 'trace', 'warning']
  },
  { 
    id: 3, 
    username: 'factory2', 
    password: 'factory123', 
    role: 'factory', 
    name: '比亚迪深圳工厂', 
    tenant: 'BYDSZN',
    permissions: ['battery:create', 'battery:read_own', 'battery:update_own', 'monitor:read_own', 'warning:read_own', 'trace:read_own', 'dashboard:read'],
    menus: ['dashboard', 'battery', 'monitor', 'trace', 'warning']
  },
  { 
    id: 4, 
    username: 'oem1', 
    password: 'oem123', 
    role: 'oem', 
    name: '比亚迪汽车', 
    tenant: 'BYD',
    permissions: ['battery:bind_vin', 'battery:read', 'monitor:read', 'warning:read', 'warning:handle', 'dashboard:read', 'trace:read'],
    menus: ['dashboard', 'battery', 'monitor', 'trace', 'warning']
  },
  { 
    id: 5, 
    username: 'recycle1', 
    password: 'recycle123', 
    role: 'recycler', 
    name: '格林美回收', 
    tenant: 'GEM',
    permissions: ['recycle:read', 'recycle:verify', 'recycle:dismantle', 'recycle:echelon', 'battery:read', 'trace:read', 'dashboard:read'],
    menus: ['dashboard', 'battery', 'trace', 'recycle']
  },
  { 
    id: 6, 
    username: 'regulator', 
    password: 'regulator123', 
    role: 'regulator', 
    name: '监管部门', 
    tenant: 'regulator',
    permissions: ['battery:read', 'monitor:read', 'warning:read', 'recycle:read', 'carbon:read', 'dashboard:read', 'trace:read', 'export:all'],
    menus: ['dashboard', 'battery', 'monitor', 'trace', 'warning', 'recycle', 'carbon']
  }
];

const warnings = [];
const dismantleOrders = [];
const echelonProjects = [
  { id: 'EP001', name: '张家口储能电站项目', type: 'energy_storage', capacity: '5MWh', batteries: 200, status: 'operating', region: '河北张家口' },
  { id: 'EP002', name: '深圳通信基站项目', type: 'base_station', capacity: '200kWh', batteries: 30, status: 'operating', region: '广东深圳' },
  { id: 'EP003', name: '低速电动车示范项目', type: 'low_speed_vehicle', capacity: '500kWh', batteries: 100, status: 'installing', region: '山东济南' },
  { id: 'EP004', name: '家庭储能试点项目', type: 'home_energy', capacity: '100kWh', batteries: 20, status: 'planning', region: '浙江杭州' },
  { id: 'EP005', name: '数据中心UPS项目', type: 'ups', capacity: '1MWh', batteries: 50, status: 'operating', region: '北京' }
];

const carbonReports = [];

const mockBatteries = generateMockBatteries();

mockBatteries.filter(b => b.status === 'dismantled' && b.dismantleData).forEach(b => {
  dismantleOrders.push({
    id: b.dismantleData.orderNo,
    orderNo: b.dismantleData.orderNo,
    batteryId: b.batteryId,
    batteryType: b.batteryType,
    batteryModel: b.cellModel,
    type: 'dismantle',
    status: 'completed',
    createTime: b.dismantleData.dismantleDate + 'T09:00:00.000Z',
    completeTime: b.dismantleData.dismantleDate + 'T17:00:00.000Z',
    recycler: b.dismantleData.recycler,
    recyclerCode: 'GEM',
    operator: b.dismantleData.dismantler,
    batteryInfo: {
      ratedCapacity: b.ratedCapacity,
      currentSoh: b.currentSoh,
      cycles: b.cycles,
      packWeight: b.packWeight
    },
    dismantleData: b.dismantleData
  });
});

module.exports = {
  batteries: mockBatteries,
  users,
  warnings,
  historyData: {},
  dismantleOrders,
  echelonProjects,
  carbonReports,
  batterySerialCounter,
  
  generateBatteryId,
  validateBatteryId,
  generateNfcId,
  generateQrCode,
  generateSignature,
  generateFormationData,
  generateInspectionReport,
  generateMockBatteries,
  generateMockHistoryData,
  getNextSerial,
  
  factoryCodes,
  factoryNames,
  modelCodes,
  modelNames,
  batteryTypes,
  cellFormulas
};
