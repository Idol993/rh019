const express = require('express');
const { batteries } = require('../data/store');
const { authenticateToken } = require('./auth');

const router = express.Router();

router.get('/footprint/:batteryId', authenticateToken, (req, res) => {
  const { batteryId } = req.params;
  const battery = batteries.find(b => b.batteryId === batteryId);
  
  if (!battery) {
    return res.status(404).json({ code: 404, message: '电池不存在' });
  }
  
  const productionCarbon = 500 + Math.random() * 200;
  const transportCarbon = 50 + Math.random() * 30;
  const cycles = battery.cycles;
  const capacity = battery.totalCapacity;
  const useCarbon = cycles * capacity * 0.15 * 0.5;
  const chargingLoss = useCarbon * 0.1;
  const recycleReduction = battery.status === 'dismantled' ? 150 + Math.random() * 100 : 0;
  
  const totalEmission = productionCarbon + transportCarbon + useCarbon + chargingLoss - recycleReduction;
  
  const footprint = {
    batteryId,
    calculationStandard: 'ISO14067 + 中国汽车碳核算标准',
    totalEmission: totalEmission.toFixed(2),
    unit: 'kgCO₂e',
    stages: {
      production: {
        emission: productionCarbon.toFixed(2),
        description: '原材料开采、电芯制造、PACK组装',
        dataSource: '工厂MES系统'
      },
      transport: {
        emission: transportCarbon.toFixed(2),
        description: '电池厂到整车厂运输',
        dataSource: '物流系统'
      },
      use: {
        emission: useCarbon.toFixed(2),
        description: '车辆运行充电耗电',
        dataSource: 'BMS运行数据',
        details: {
          totalCycles: cycles,
          totalCapacity: capacity * cycles,
          gridCarbonFactor: '0.5 kgCO₂e/kWh'
        }
      },
      chargingLoss: {
        emission: chargingLoss.toFixed(2),
        description: '充电过程损耗',
        dataSource: '充电桩数据'
      },
      recycle: {
        emission: recycleReduction.toFixed(2),
        description: '回收减排量',
        dataSource: battery.status === 'dismantled' ? '拆解系统' : '预计值',
        isNegative: true
      }
    },
    carbonReduction: {
      totalReduction: recycleReduction.toFixed(2),
      recyclingRate: (battery.status === 'dismantled' ? 85 + Math.random() * 10 : 0).toFixed(1),
      materialsRecovered: {
        lithium: '95%',
        cobalt: '92%',
        nickel: '90%',
        manganese: '88%'
      }
    }
  };
  
  res.json({
    code: 200,
    data: footprint
  });
});

router.get('/summary', authenticateToken, (req, res) => {
  const { period = 'month' } = req.query;
  
  const totalBatteries = batteries.length;
  const activeBatteries = batteries.filter(b => 
    b.status === 'running' || b.status === 'charging' || b.status === 'idle'
  ).length;
  const retiredBatteries = batteries.filter(b => 
    b.status === 'retired' || b.status === 'echelon' || b.status === 'dismantled'
  ).length;
  const echelonBatteries = batteries.filter(b => b.status === 'echelon').length;
  const dismantledBatteries = batteries.filter(b => b.status === 'dismantled').length;
  
  const totalCarbon = totalBatteries * 600;
  const carbonReduction = dismantledBatteries * 200 + echelonBatteries * 150;
  const netCarbon = totalCarbon - carbonReduction;
  
  const summary = {
    period,
    totalBatteries,
    activeBatteries,
    retiredBatteries,
    echelonBatteries,
    dismantledBatteries,
    echelonUtilizationRate: ((echelonBatteries / Math.max(1, retiredBatteries)) * 100).toFixed(1) + '%',
    recyclingRate: ((dismantledBatteries / Math.max(1, retiredBatteries)) * 100).toFixed(1) + '%',
    carbon: {
      totalEmission: totalCarbon.toFixed(0),
      reduction: carbonReduction.toFixed(0),
      netEmission: netCarbon.toFixed(0),
      unit: 'kgCO₂e',
      perKwh: (netCarbon / (activeBatteries * 500)).toFixed(3)
    },
    trend: generateCarbonTrend(period)
  };
  
  res.json({
    code: 200,
    data: summary
  });
});

function generateCarbonTrend(period) {
  const trend = [];
  const now = new Date();
  let count = period === 'month' ? 30 : period === 'quarter' ? 12 : 12;
  
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(now);
    if (period === 'month') {
      date.setDate(date.getDate() - i);
    } else {
      date.setMonth(date.getMonth() - i);
    }
    
    const base = 5000 + Math.sin(i / 3) * 500;
    trend.push({
      date: period === 'month' ? date.toISOString().split('T')[0] : date.getFullYear() + '-' + (date.getMonth() + 1),
      emission: (base + Math.random() * 200).toFixed(0),
      reduction: (base * 0.15 + Math.random() * 100).toFixed(0)
    });
  }
  
  return trend;
}

router.get('/report/:batteryId', authenticateToken, (req, res) => {
  const { batteryId } = req.params;
  
  res.json({
    code: 200,
    data: {
      reportId: `CR-${batteryId}-${Date.now()}`,
      batteryId,
      reportDate: new Date().toISOString().split('T')[0],
      standard: 'ISO14067:2018 / GB/T 38775',
      scope: '全生命周期（摇篮到坟墓）',
      status: 'generated',
      downloadUrl: `/api/carbon/report/${batteryId}/download`
    }
  });
});

module.exports = router;
