const { batteries, historyData } = require('../data/store');

class SohService {
  constructor() {
    this.running = false;
    this.interval = null;
  }
  
  start() {
    if (this.running) return;
    this.running = true;
    
    console.log('[SOH] SOH计算与校准服务启动...');
    
    this.interval = setInterval(() => {
      this.calculateSoh();
    }, 60000);
  }
  
  stop() {
    this.running = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
  
  calculateSoh() {
    const activeBatteries = batteries.filter(b => 
      b.status === 'running' || b.status === 'charging' || b.status === 'idle'
    );
    
    activeBatteries.forEach(battery => {
      const currentSoh = parseFloat(battery.currentSoh);
      
      const decayRate = this.calculateDecayRate(battery);
      const newSoh = Math.max(60, currentSoh - decayRate);
      
      if (newSoh !== currentSoh) {
        battery.currentSoh = newSoh.toFixed(2);
      }
      
      if (battery.status === 'charging' && battery.soc > 95) {
        this.calibrateSoh(battery);
      }
    });
  }
  
  calculateDecayRate(battery) {
    const baseDecay = 0.0001;
    
    const tempFactor = this.getTemperatureFactor(parseFloat(battery.maxTemp));
    const socFactor = this.getSocFactor(battery.soc);
    const currentFactor = this.getCurrentFactor(Math.abs(parseFloat(battery.totalCurrent)));
    
    const totalFactor = tempFactor * socFactor * currentFactor;
    
    return baseDecay * totalFactor;
  }
  
  getTemperatureFactor(temp) {
    if (temp < 0) return 1.5 + Math.abs(temp) * 0.05;
    if (temp < 25) return 1.0;
    if (temp < 40) return 1.0 + (temp - 25) * 0.05;
    return 1.75 + (temp - 40) * 0.1;
  }
  
  getSocFactor(soc) {
    if (soc > 90) return 1.5;
    if (soc > 70) return 1.2;
    if (soc > 30) return 1.0;
    return 1.1;
  }
  
  getCurrentFactor(current) {
    if (current < 50) return 1.0;
    if (current < 100) return 1.1;
    if (current < 150) return 1.3;
    return 1.6;
  }
  
  calibrateSoh(battery) {
    const history = historyData[battery.batteryId] || [];
    if (history.length < 100) return;
    
    const recentCharges = history.filter(h => h.status === 'charging');
    if (recentCharges.length < 10) return;
    
    const totalCapacity = battery.totalCapacity;
    const chargedCapacity = this.calculateChargedCapacity(recentCharges);
    
    if (chargedCapacity > 0) {
      const calibratedSoh = (chargedCapacity / totalCapacity) * 100;
      const currentSoh = parseFloat(battery.currentSoh);
      
      const diff = Math.abs(calibratedSoh - currentSoh);
      if (diff > 1 && diff < 10) {
        battery.currentSoh = ((currentSoh + calibratedSoh) / 2).toFixed(2);
        console.log(`[SOH] 校准 ${battery.batteryId}: ${currentSoh}% → ${battery.currentSoh}%`);
      } else if (diff >= 10) {
        console.log(`[SOH] 异常跳变检测 ${battery.batteryId}: 差值 ${diff.toFixed(2)}%，需人工复核`);
      }
    }
  }
  
  calculateChargedCapacity(chargeHistory) {
    let totalAh = 0;
    for (let i = 1; i < chargeHistory.length; i++) {
      const current = Math.abs(parseFloat(chargeHistory[i].totalCurrent));
      const timeDiff = (chargeHistory[i].timestamp - chargeHistory[i-1].timestamp) / 3600000;
      totalAh += current * timeDiff;
    }
    return totalAh;
  }
  
  predictSoh(batteryId, days = 365) {
    const battery = batteries.find(b => b.batteryId === batteryId);
    if (!battery) return null;
    
    const predictions = [];
    let currentSoh = parseFloat(battery.currentSoh);
    const dailyDecay = 0.01 + Math.random() * 0.005;
    
    for (let i = 0; i <= days; i++) {
      const decayVariation = (Math.random() - 0.5) * 0.005;
      currentSoh = Math.max(60, currentSoh - (dailyDecay + decayVariation));
      
      if (i % 30 === 0 || i === days) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        predictions.push({
          date: date.toISOString().split('T')[0],
          days: i,
          predictedSoh: currentSoh.toFixed(2),
          confidence: Math.max(0.5, 0.95 - i / days * 0.5).toFixed(2)
        });
      }
    }
    
    return predictions;
  }
  
  calculateRemainingLife(batteryId) {
    const battery = batteries.find(b => b.batteryId === batteryId);
    if (!battery) return null;
    
    const currentSoh = parseFloat(battery.currentSoh);
    const endOfLifeSoh = 80;
    
    if (currentSoh <= endOfLifeSoh) {
      return { remainingDays: 0, status: 'expired' };
    }
    
    const dailyDecay = 0.012;
    const remainingDays = Math.floor((currentSoh - endOfLifeSoh) / dailyDecay);
    
    return {
      remainingDays,
      endOfLifeDate: (() => {
        const date = new Date();
        date.setDate(date.getDate() + remainingDays);
        return date.toISOString().split('T')[0];
      })(),
      status: remainingDays > 365 ? 'healthy' : remainingDays > 180 ? 'warning' : 'critical'
    };
  }
}

module.exports = new SohService();
