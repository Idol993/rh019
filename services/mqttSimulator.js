const { batteries, historyData } = require('../data/store');

class MqttSimulator {
  constructor() {
    this.running = false;
    this.interval = null;
    this.faultyBatteries = new Set();
  }
  
  start() {
    if (this.running) return;
    this.running = true;
    
    console.log('[MQTT] 模拟器启动，模拟 BMS 数据上报...');
    
    this.interval = setInterval(() => {
      this.simulateBmsData();
    }, 3000);
    
    setTimeout(() => {
      this.simulateRandomFault();
    }, 10000);
  }
  
  stop() {
    this.running = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    console.log('[MQTT] 模拟器停止');
  }
  
  simulateBmsData() {
    const activeBatteries = batteries.filter(b => 
      b.status === 'running' || b.status === 'charging' || b.status === 'idle'
    );
    
    activeBatteries.forEach(battery => {
      this.updateBatteryData(battery);
    });
    
    if (global.broadcastData) {
      global.broadcastData({
        type: 'realtime_update',
        timestamp: Date.now(),
        data: activeBatteries.slice(0, 20).map(b => ({
          batteryId: b.batteryId,
          status: b.status,
          soc: b.soc,
          soh: b.currentSoh,
          totalVoltage: b.totalVoltage,
          totalCurrent: b.totalCurrent,
          maxTemp: b.maxTemp,
          location: b.location
        }))
      });
    }
  }
  
  updateBatteryData(battery) {
    const isFaulty = this.faultyBatteries.has(battery.batteryId);
    const variation = 0.02;
    
    let totalCurrent = parseFloat(battery.totalCurrent);
    let soc = battery.soc;
    let maxTemp = parseFloat(battery.maxTemp);
    let minTemp = parseFloat(battery.minTemp);
    
    if (battery.status === 'running') {
      totalCurrent = 80 + Math.random() * 120;
      soc = Math.max(10, soc - Math.random() * 0.5);
      maxTemp = Math.min(60, maxTemp + (Math.random() - 0.3) * 0.5);
    } else if (battery.status === 'charging') {
      totalCurrent = -(20 + Math.random() * 80);
      soc = Math.min(100, soc + Math.random() * 0.3);
      maxTemp = Math.min(55, maxTemp + (Math.random() - 0.4) * 0.3);
    } else {
      totalCurrent = 0.5 + (Math.random() - 0.5) * 0.2;
      maxTemp = 25 + (Math.random() - 0.5) * 2;
    }
    
    if (isFaulty) {
      maxTemp = 55 + Math.random() * 10;
      const voltageDiff = 0.15 + Math.random() * 0.1;
      battery.voltageDiff = voltageDiff.toFixed(3);
    }
    
    battery.totalCurrent = totalCurrent.toFixed(2);
    battery.soc = Math.round(soc);
    battery.totalVoltage = (350 + Math.random() * 30).toFixed(1);
    battery.maxTemp = maxTemp.toFixed(1);
    battery.minTemp = (maxTemp - 3 - Math.random() * 5).toFixed(1);
    battery.tempDiff = (maxTemp - parseFloat(battery.minTemp)).toFixed(1);
    battery.maxCellVoltage = (3.6 + Math.random() * 0.2).toFixed(3);
    battery.minCellVoltage = (3.4 + Math.random() * 0.2).toFixed(3);
    battery.insulationResistance = (800 + Math.random() * 400).toFixed(1);
    battery.lastUpdate = new Date().toISOString();
    
    if (Math.random() < 0.3) {
      const statuses = ['running', 'charging', 'idle'];
      battery.status = statuses[Math.floor(Math.random() * 3)];
    }
    
    if (!historyData[battery.batteryId]) {
      historyData[battery.batteryId] = [];
    }
    historyData[battery.batteryId].push({
      timestamp: Date.now(),
      batteryId: battery.batteryId,
      totalVoltage: battery.totalVoltage,
      totalCurrent: battery.totalCurrent,
      soc: battery.soc,
      soh: battery.currentSoh,
      maxTemp: battery.maxTemp,
      minTemp: battery.minTemp,
      tempDiff: battery.tempDiff,
      maxCellVoltage: battery.maxCellVoltage,
      minCellVoltage: battery.minCellVoltage,
      voltageDiff: battery.voltageDiff,
      insulationResistance: battery.insulationResistance,
      status: battery.status
    });
    
    if (historyData[battery.batteryId].length > 1000) {
      historyData[battery.batteryId] = historyData[battery.batteryId].slice(-1000);
    }
  }
  
  simulateRandomFault() {
    const activeBatteries = batteries.filter(b => 
      b.status === 'running' || b.status === 'charging'
    );
    
    if (activeBatteries.length > 0) {
      const randomIndex = Math.floor(Math.random() * activeBatteries.length);
      const faultyBattery = activeBatteries[randomIndex];
      this.faultyBatteries.add(faultyBattery.batteryId);
      
      console.log(`[MQTT] 模拟故障电池: ${faultyBattery.batteryId}`);
      
      setTimeout(() => {
        this.faultyBatteries.delete(faultyBattery.batteryId);
      }, 60000);
    }
    
    setTimeout(() => {
      this.simulateRandomFault();
    }, 30000 + Math.random() * 30000);
  }
}

module.exports = new MqttSimulator();
