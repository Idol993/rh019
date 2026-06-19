const { warnings, batteries } = require('../data/store');
const crypto = require('crypto');

class WarningService {
  constructor() {
    this.running = false;
    this.interval = null;
    this.lastTempMap = {};
  }
  
  start() {
    if (this.running) return;
    this.running = true;
    
    console.log('[预警] 异常检测服务启动...');
    
    this.interval = setInterval(() => {
      this.detectAnomalies();
    }, 5000);
  }
  
  stop() {
    this.running = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
  
  detectAnomalies() {
    const activeBatteries = batteries.filter(b => 
      b.status === 'running' || b.status === 'charging'
    );
    
    activeBatteries.forEach(battery => {
      this.checkTemperatureRise(battery);
      this.checkVoltageDiff(battery);
      this.checkInsulation(battery);
      this.checkOverTemperature(battery);
    });
  }
  
  checkTemperatureRise(battery) {
    const currentTemp = parseFloat(battery.maxTemp);
    const lastTemp = this.lastTempMap[battery.batteryId];
    
    if (lastTemp !== undefined) {
      const tempRise = currentTemp - lastTemp;
      const risePerMin = tempRise * 12;
      
      if (risePerMin > 3) {
        this.createWarning({
          batteryId: battery.batteryId,
          type: 'temperature_rise',
          name: '温度突升',
          level: 'critical',
          description: `温度上升速度 ${risePerMin.toFixed(1)}℃/min，超过阈值 3℃/min`,
          value: risePerMin.toFixed(1),
          threshold: '3',
          unit: '℃/min'
        });
      }
    }
    
    this.lastTempMap[battery.batteryId] = currentTemp;
  }
  
  checkVoltageDiff(battery) {
    const voltageDiff = parseFloat(battery.voltageDiff);
    
    if (voltageDiff > 0.1) {
      this.createWarning({
        batteryId: battery.batteryId,
        type: 'voltage_diff',
        name: '单体压差过大',
        level: 'urgent',
        description: `单体压差 ${voltageDiff.toFixed(3)}V，超过阈值 0.1V`,
        value: voltageDiff.toFixed(3),
        threshold: '0.1',
        unit: 'V'
      });
    }
  }
  
  checkInsulation(battery) {
    const insulation = parseFloat(battery.insulationResistance);
    
    if (insulation < 500) {
      this.createWarning({
        batteryId: battery.batteryId,
        type: 'insulation_low',
        name: '绝缘电阻过低',
        level: 'critical',
        description: `绝缘电阻 ${insulation.toFixed(1)}kΩ，低于阈值 500kΩ`,
        value: insulation.toFixed(1),
        threshold: '500',
        unit: 'kΩ'
      });
    }
  }
  
  checkOverTemperature(battery) {
    const maxTemp = parseFloat(battery.maxTemp);
    
    if (maxTemp > 55) {
      this.createWarning({
        batteryId: battery.batteryId,
        type: 'over_temperature',
        name: '过温保护',
        level: 'critical',
        description: `最高温度 ${maxTemp.toFixed(1)}℃，超过阈值 55℃`,
        value: maxTemp.toFixed(1),
        threshold: '55',
        unit: '℃'
      });
    }
  }
  
  createWarning(warningData) {
    const recentWarning = warnings.find(w => 
      w.batteryId === warningData.batteryId && 
      w.type === warningData.type &&
      w.status === 'pending'
    );
    
    if (recentWarning) {
      recentWarning.count = (recentWarning.count || 1) + 1;
      recentWarning.lastUpdate = new Date().toISOString();
      return;
    }
    
    const warning = {
      id: `W${Date.now()}${Math.random().toString(36).substr(2, 4)}`,
      ...warningData,
      status: 'pending',
      count: 1,
      timestamp: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
      blockHash: crypto.createHash('sha256').update(`${warningData.batteryId}-${warningData.type}-${Date.now()}`).digest('hex')
    };
    
    warnings.unshift(warning);
    
    if (warning.level === 'critical' && global.broadcastData) {
      global.broadcastData({
        type: 'warning_alert',
        level: 'critical',
        data: warning
      });
    }
    
    console.log(`[预警] ${warning.level} - ${warning.name} - ${warning.batteryId}`);
  }
}

module.exports = new WarningService();
