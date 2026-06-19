const crypto = require('crypto');

const generateBatteryId = (factoryCode, modelCode, productionDate, serialNum) => {
  const yearMonth = productionDate || '202401';
  const serial = serialNum || '00000001';
  const base = `${factoryCode}${modelCode}${yearMonth}${serial}`;
  const hash = crypto.createHash('md5').update(base).digest('hex').substring(0, 2).toUpperCase();
  return `${factoryCode}${modelCode}${yearMonth}${serial}${hash}`;
};

const batteryTypes = ['三元锂', '磷酸铁锂', '锰酸锂'];
const factoryCodes = ['CATLBJ', 'BYDSZ', 'GOTSHH', 'EVEHZ', 'SVOLT'];
const modelCodes = ['MDL001', 'MDL002', 'MDL003', 'MDL004', 'MDL005'];

const generateMockBatteries = () => {
  const batteries = [];
  const regions = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '西安', '南京', '重庆'];
  
  for (let i = 1; i <= 50; i++) {
    const factoryCode = factoryCodes[i % factoryCodes.length];
    const modelCode = modelCodes[i % modelCodes.length];
    const year = 2022 + Math.floor(Math.random() * 3);
    const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    const serial = String(i).padStart(8, '0');
    const batteryId = generateBatteryId(factoryCode, modelCode, `${year}${month}`, serial);
    const batteryType = batteryTypes[i % batteryTypes.length];
    const initialSoh = 95 + Math.random() * 5;
    const cycles = Math.floor(Math.random() * 800);
    const soh = Math.max(60, initialSoh - cycles * 0.03 - Math.random() * 5);
    const statuses = ['running', 'charging', 'idle', 'retired', 'echelon', 'dismantled'];
    const status = i > 45 ? statuses[3 + (i % 3)] : statuses[Math.floor(Math.random() * 3)];
    
    batteries.push({
      id: batteryId,
      batteryId,
      factoryCode,
      modelCode,
      productionDate: `${year}-${month}-15`,
      batteryType,
      ratedCapacity: batteryType === '磷酸铁锂' ? 280 : 220,
      nominalVoltage: batteryType === '磷酸铁锂' ? 3.2 : 3.7,
      cellModel: `${batteryType}-${batteryType === '磷酸铁锂' ? 'LFP' : 'NCM'}${Math.floor(Math.random() * 100)}`,
      batchNo: `BATCH${year}${month}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
      factorySoh: initialSoh.toFixed(2),
      currentSoh: soh.toFixed(2),
      cycles,
      totalCapacity: Math.floor(50 + Math.random() * 100),
      vin: status !== 'retired' && status !== 'echelon' && status !== 'dismantled' 
        ? `VIN${String(100000 + i).padStart(10, '0')}` 
        : null,
      vehicleModel: ['Model S', 'Model 3', '汉EV', '唐DM', '蔚来ET5', '小鹏P7', '理想L9'][i % 7],
      owner: `用户${i}`,
      region: regions[i % regions.length],
      status,
      installDate: status !== 'retired' && status !== 'echelon' && status !== 'dismantled' 
        ? `${year + 1}-${month}-10` 
        : null,
      lastUpdate: new Date().toISOString(),
      nfcId: `NFC${crypto.randomBytes(8).toString('hex').toUpperCase()}`,
      qrCode: `QR${batteryId}`,
      signature: crypto.createHash('sha256').update(batteryId).digest('hex'),
      insulationResistance: (500 + Math.random() * 1000).toFixed(1),
      maxCellVoltage: (3.6 + Math.random() * 0.2).toFixed(3),
      minCellVoltage: (3.4 + Math.random() * 0.2).toFixed(3),
      voltageDiff: (0.01 + Math.random() * 0.1).toFixed(3),
      maxTemp: (25 + Math.random() * 15).toFixed(1),
      minTemp: (20 + Math.random() * 10).toFixed(1),
      tempDiff: (2 + Math.random() * 8).toFixed(1),
      soc: Math.floor(20 + Math.random() * 70),
      totalCurrent: status === 'charging' ? -(20 + Math.random() * 100) : (status === 'running' ? (50 + Math.random() * 150) : 0.5),
      totalVoltage: (350 + Math.random() * 50).toFixed(1),
      faultCodes: [],
      hardwareVersion: 'BMS_V2.3.1',
      softwareVersion: 'FW_v3.1.5',
      location: {
        lat: 30 + Math.random() * 10,
        lng: 105 + Math.random() * 20
      }
    });
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
      status: isCharging ? 'charging' : (isRunning ? 'running' : 'idle')
    });
  }
  return data;
};

const users = [
  { id: 1, username: 'admin', password: 'admin123', role: 'admin', name: '系统管理员', tenant: 'system' },
  { id: 2, username: 'factory1', password: 'factory123', role: 'factory', name: '宁德时代北京', tenant: 'CATLBJ' },
  { id: 3, username: 'oem1', password: 'oem123', role: 'oem', name: '比亚迪汽车', tenant: 'BYD' },
  { id: 4, username: 'recycle1', password: 'recycle123', role: 'recycler', name: '格林美回收', tenant: 'GEM' },
  { id: 5, username: 'regulator', password: 'regulator123', role: 'regulator', name: '监管部门', tenant: 'regulator' }
];

const warnings = [];

const mockBatteries = generateMockBatteries();

module.exports = {
  batteries: mockBatteries,
  users,
  warnings,
  historyData: {},
  generateBatteryId,
  generateMockHistoryData,
  factoryCodes,
  modelCodes,
  batteryTypes
};
