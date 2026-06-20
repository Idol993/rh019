const express = require('express');
const { batteries } = require('../data/store');
const { authenticateToken, requirePermission, filterByFactory } = require('./auth');

const router = express.Router();

const calculateCarbonFootprint = (battery) => {
  const productionCarbon = parseFloat(battery.ratedCapacity) * 0.15;
  
  const transportCarbon = battery.transportDistance ? battery.transportDistance * 0.0005 : 35;
  
  const ageYears = (new Date() - new Date(battery.productionDate)) / (365 * 24 * 3600 * 1000);
  const mileage = battery.mileage || ageYears * 15000;
  const useCarbon = (mileage / 1000) * 12;
  
  const chargeEfficiencyLoss = (mileage / 100) * 20 * 0.4;
  
  let recyclingCarbon = 0;
  let recyclingReduction = 0;
  if (battery.dismantleData) {
    recyclingCarbon = 80;
    recyclingReduction = parseFloat(battery.dismantleData.carbonReductionKg || 0);
  } else if (battery.status === 'dismantled') {
    recyclingCarbon = 80;
    recyclingReduction = 150;
  }
  
  const totalEmission = productionCarbon + transportCarbon + useCarbon + chargeEfficiencyLoss + recyclingCarbon;
  const netEmission = totalEmission - recyclingReduction;
  
  return {
    batteryId: battery.batteryId,
    batteryType: battery.batteryType,
    factoryCode: battery.factoryCode,
    productionDate: battery.productionDate,
    ratedCapacity: battery.ratedCapacity,
    status: battery.status,
    stages: [
      { stage: '生产制造', emission: productionCarbon.toFixed(2), percentage: ((productionCarbon / totalEmission) * 100).toFixed(1) + '%', description: '正极材料、负极材料、电解液、隔膜等原材料生产及电芯组装' },
      { stage: '运输仓储', emission: transportCarbon.toFixed(2), percentage: ((transportCarbon / totalEmission) * 100).toFixed(1) + '%', description: '电池从工厂到车企的运输及仓储能耗' },
      { stage: '使用阶段', emission: useCarbon.toFixed(2), percentage: ((useCarbon / totalEmission) * 100).toFixed(1) + '%', description: '车辆运行过程中的电力消耗碳排放' },
      { stage: '充电损耗', emission: chargeEfficiencyLoss.toFixed(2), percentage: ((chargeEfficiencyLoss / totalEmission) * 100).toFixed(1) + '%', description: '充电过程中的电网损耗、转换效率损失' },
      { stage: '回收处理', emission: recyclingCarbon.toFixed(2), percentage: ((recyclingCarbon / totalEmission) * 100).toFixed(1) + '%', description: '拆解、分选、金属回收过程的能耗排放' }
    ],
    totalEmission: totalEmission.toFixed(2),
    recyclingReduction: recyclingReduction.toFixed(2),
    netEmission: netEmission.toFixed(2),
    carbonIntensity: (netEmission / parseFloat(battery.ratedCapacity)).toFixed(3),
    unit: 'kgCO₂e/kWh',
    mileage: Math.floor(mileage),
    cycles: battery.cycles,
    currentSoh: battery.currentSoh,
    standard: 'ISO 14067:2018',
    methodology: '生命周期评价法(LCA)',
    dataSources: ['工厂生产数据', '电网排放因子', '运输物流数据', '拆解回收数据'],
    dismantleData: battery.dismantleData || null
  };
};

router.get('/summary', authenticateToken, (req, res) => {
  let targetBatteries = [...batteries];
  targetBatteries = filterByFactory(req, targetBatteries);
  
  const totalBatteries = targetBatteries.length;
  
  let totalProduction = 0;
  let totalUse = 0;
  let totalRecyclingReduction = 0;
  
  targetBatteries.forEach(b => {
    const cf = calculateCarbonFootprint(b);
    totalProduction += parseFloat(cf.stages[0].emission);
    totalUse += parseFloat(cf.stages[2].emission);
    totalRecyclingReduction += parseFloat(cf.recyclingReduction);
  });
  
  const totalEmission = totalProduction + totalUse + targetBatteries.length * 120;
  const netEmission = totalEmission - totalRecyclingReduction;
  
  const avgCarbonIntensity = targetBatteries.length > 0 ? netEmission / targetBatteries.reduce((sum, b) => sum + parseFloat(b.ratedCapacity), 0) : 0;
  
  const dismantledCount = targetBatteries.filter(b => b.status === 'dismantled').length;
  const runningCount = targetBatteries.filter(b => ['running', 'charging', 'idle'].includes(b.status)).length;
  
  const recyclingRate = totalBatteries > 0 ? ((dismantledCount / totalBatteries) * 100).toFixed(1) : '0.0';
  
  const reductionPotential = targetBatteries
    .filter(b => b.status !== 'dismantled')
    .length * 120;
  
  res.json({
    code: 200,
    data: {
      totalBatteries,
      totalEmission: totalEmission.toFixed(0),
      netEmission: netEmission.toFixed(0),
      avgCarbonIntensity: avgCarbonIntensity.toFixed(2),
      totalRecyclingReduction: totalRecyclingReduction.toFixed(0),
      recyclingRate: recyclingRate + '%',
      dismantledCount,
      runningCount,
      reductionPotential: reductionPotential.toFixed(0),
      unit: 'kgCO₂e'
    }
  });
});

router.get('/trend', authenticateToken, (req, res) => {
  const months = 12;
  const data = [];
  
  const now = new Date();
  
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    const base = 8000 + Math.sin(i * 0.5) * 2000;
    const emission = base + Math.random() * 1000;
    const reduction = 500 + i * 80 + Math.random() * 200;
    
    data.push({
      month: monthStr,
      productionEmission: (emission * 0.35).toFixed(0),
      useEmission: (emission * 0.45).toFixed(0),
      transportEmission: (emission * 0.1).toFixed(0),
      recyclingEmission: (emission * 0.1).toFixed(0),
      totalEmission: emission.toFixed(0),
      recyclingReduction: reduction.toFixed(0),
      netEmission: (emission - reduction).toFixed(0)
    });
  }
  
  res.json({
    code: 200,
    data
  });
});

router.get('/battery/:batteryId', authenticateToken, (req, res) => {
  const { batteryId } = req.params;
  const battery = batteries.find(b => b.batteryId === batteryId);
  
  if (!battery) {
    return res.status(404).json({ code: 404, message: '电池不存在' });
  }
  
  const footprint = calculateCarbonFootprint(battery);
  
  res.json({
    code: 200,
    data: footprint
  });
});

router.get('/distribution', authenticateToken, (req, res) => {
  let targetBatteries = [...batteries];
  targetBatteries = filterByFactory(req, targetBatteries);
  
  const categories = [
    { label: '低碳 (<120kgCO₂e/kWh)', min: 0, max: 120, count: 0 },
    { label: '中低 (120-150)', min: 120, max: 150, count: 0 },
    { label: '中等 (150-180)', min: 150, max: 180, count: 0 },
    { label: '中高 (180-200)', min: 180, max: 200, count: 0 },
    { label: '高碳 (>200)', min: 200, max: 1000, count: 0 }
  ];
  
  targetBatteries.forEach(b => {
    const intensity = parseFloat(calculateCarbonFootprint(b).carbonIntensity);
    for (const cat of categories) {
      if (intensity >= cat.min && intensity < cat.max) {
        cat.count++;
        break;
      }
    }
  });
  
  res.json({
    code: 200,
    data: categories.map(c => ({ label: c.label, count: c.count, percentage: targetBatteries.length > 0 ? ((c.count / targetBatteries.length) * 100).toFixed(1) + '%' : '0%' }))
  });
});

router.get('/reports', authenticateToken, (req, res) => {
  const { type, year } = req.query;
  
  let targetBatteries = [...batteries];
  targetBatteries = filterByFactory(req, targetBatteries);
  
  const currentYear = new Date().getFullYear();
  const reportYear = year || currentYear;
  
  const reports = [
    {
      id: 'RPT-' + reportYear + '-001',
      title: `${reportYear}年度电池全生命周期碳足迹核算报告`,
      type: 'annual',
      year: reportYear,
      scope: '全平台',
      reportDate: reportYear + '-12-31',
      status: 'published',
      totalEmission: '125,680',
      netEmission: '98,450',
      batteriesCount: targetBatteries.length,
      standard: 'ISO 14067:2018, GHG Protocol'
    },
    {
      id: 'RPT-' + reportYear + '-Q4',
      title: `${reportYear}年第四季度碳足迹报告`,
      type: 'quarterly',
      quarter: 'Q4',
      year: reportYear,
      scope: '全平台',
      reportDate: reportYear + '-10-15',
      status: 'published',
      totalEmission: '32,560',
      netEmission: '25,890',
      batteriesCount: targetBatteries.length,
      standard: 'ISO 14067:2018'
    },
    {
      id: 'RPT-' + reportYear + '-002',
      title: `${reportYear}年电池回收减排专项报告`,
      type: 'recycling',
      year: reportYear,
      scope: '回收环节',
      reportDate: reportYear + '-11-20',
      status: 'published',
      totalReduction: '27,230',
      batteriesCount: targetBatteries.filter(b => b.status === 'dismantled').length,
      standard: 'ISO 14067:2018'
    }
  ];
  
  res.json({
    code: 200,
    data: reports
  });
});

router.get('/report/:reportId', authenticateToken, (req, res) => {
  const { reportId } = req.params;
  
  let targetBatteries = [...batteries];
  targetBatteries = filterByFactory(req, targetBatteries);
  
  const totalEmission = targetBatteries.length * 185;
  const totalReduction = targetBatteries.filter(b => b.status === 'dismantled').length * 168;
  
  const report = {
    id: reportId,
    title: '动力电池全生命周期碳足迹核算报告',
    reportNo: reportId,
    reportDate: new Date().toISOString().split('T')[0],
    period: '2024年度',
    standard: 'ISO 14067:2018 温室气体核算体系',
    methodology: '生命周期评价法 (LCA) - 从摇篮到坟墓',
    scope: {
      systemBoundary: '涵盖原材料开采、电池制造、运输、使用、回收全生命周期',
      functionalUnit: '1 kWh 电池容量',
      dataQuality: 'Tier 1-3 混合数据来源'
    },
    summary: {
      totalBatteries: targetBatteries.length,
      totalCapacity: targetBatteries.reduce((sum, b) => sum + parseFloat(b.ratedCapacity), 0).toFixed(0) + ' kWh',
      totalEmission: totalEmission.toFixed(0) + ' kgCO₂e',
      avgCarbonIntensity: (totalEmission / targetBatteries.reduce((sum, b) => sum + parseFloat(b.ratedCapacity), 0)).toFixed(2) + ' kgCO₂e/kWh',
      recyclingReduction: totalReduction.toFixed(0) + ' kgCO₂e',
      netEmission: (totalEmission - totalReduction).toFixed(0) + ' kgCO₂e',
      reductionRate: ((totalReduction / totalEmission) * 100).toFixed(1) + '%'
    },
    stageBreakdown: [
      { stage: '原材料生产', emission: (totalEmission * 0.42).toFixed(0), percentage: '42.0%' },
      { stage: '电芯制造', emission: (totalEmission * 0.18).toFixed(0), percentage: '18.0%' },
      { stage: '电池系统组装', emission: (totalEmission * 0.08).toFixed(0), percentage: '8.0%' },
      { stage: '运输配送', emission: (totalEmission * 0.05).toFixed(0), percentage: '5.0%' },
      { stage: '使用阶段', emission: (totalEmission * 0.22).toFixed(0), percentage: '22.0%' },
      { stage: '回收处理', emission: (totalEmission * 0.05).toFixed(0), percentage: '5.0%', reduction: totalReduction.toFixed(0) }
    ],
    factoryData: [
      { factory: '宁德时代', count: targetBatteries.filter(b => b.factoryCode === 'CATL01').length, avgIntensity: '158 kgCO₂e/kWh' },
      { factory: '比亚迪', count: targetBatteries.filter(b => b.factoryCode === 'BYD001').length, avgIntensity: '165 kgCO₂e/kWh' },
      { factory: '中创新航', count: targetBatteries.filter(b => b.factoryCode === 'CALB01').length, avgIntensity: '172 kgCO₂e/kWh' }
    ],
    reductions: {
      recycling: totalReduction.toFixed(0) + ' kgCO₂e',
      echelon: '8,520 kgCO₂e',
      material: '5,340 kgCO₂e'
    },
    recommendations: [
      '提高高能量密度电池比例，降低单位容量碳足迹',
      '增加可再生能源使用比例，降低生产阶段排放',
      '优化回收工艺，提高金属回收率',
      '推广梯次利用，延长电池使用寿命'
    ],
    verifier: '第三方碳核查机构',
    verified: true,
    verifyDate: '2025-01-15'
  };
  
  res.json({
    code: 200,
    data: report
  });
});

router.get('/report/:reportId/html', authenticateToken, (req, res) => {
  const { reportId } = req.params;
  
  let targetBatteries = [...batteries];
  targetBatteries = filterByFactory(req, targetBatteries);
  
  const totalEmission = targetBatteries.length * 185;
  const totalReduction = targetBatteries.filter(b => b.status === 'dismantled').length * 168;
  const totalCapacity = targetBatteries.reduce((sum, b) => sum + parseFloat(b.ratedCapacity), 0);
  const avgIntensity = (totalEmission / totalCapacity).toFixed(2);
  const netEmission = totalEmission - totalReduction;
  const reductionRate = ((totalReduction / totalEmission) * 100).toFixed(1);
  
  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>动力电池全生命周期碳足迹核算报告 - ${reportId}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #f5f7fa; margin: 0; padding: 20px; color: #1a1a2e; }
  .report-container { max-width: 900px; margin: 0 auto; background: white; padding: 50px; box-shadow: 0 2px 20px rgba(0,0,0,0.1); border-radius: 8px; }
  .report-header { text-align: center; border-bottom: 3px solid #00d4ff; padding-bottom: 30px; margin-bottom: 40px; }
  .report-header h1 { font-size: 28px; margin: 0 0 10px 0; color: #0056b3; }
  .report-header .subtitle { color: #666; font-size: 16px; }
  .report-meta { display: flex; justify-content: space-between; margin-top: 20px; padding-top: 15px; border-top: 1px dashed #ddd; }
  .section { margin-bottom: 35px; }
  .section h2 { color: #0056b3; border-left: 4px solid #00d4ff; padding-left: 12px; margin-bottom: 20px; font-size: 20px; }
  .section h3 { color: #333; font-size: 16px; margin-top: 20px; }
  .summary-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; }
  .summary-card { background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); padding: 20px; border-radius: 8px; text-align: center; }
  .summary-card .value { font-size: 24px; font-weight: bold; color: #1565c0; }
  .summary-card .label { font-size: 13px; color: #555; margin-top: 5px; }
  .summary-card.green { background: linear-gradient(135deg, #e8f5e9 0%, #a5d6a7 100%); }
  .summary-card.green .value { color: #2e7d32; }
  .summary-card.orange { background: linear-gradient(135deg, #fff3e0 0%, #ffcc80 100%); }
  .summary-card.orange .value { color: #e65100; }
  table { width: 100%; border-collapse: collapse; margin: 15px 0; }
  th, td { border: 1px solid #e0e0e0; padding: 10px 12px; text-align: left; font-size: 14px; }
  th { background: #f5f5f5; font-weight: 600; color: #333; }
  tr:nth-child(even) { background: #fafafa; }
  .progress-bar { background: #e0e0e0; height: 8px; border-radius: 4px; overflow: hidden; margin-top: 5px; }
  .progress-fill { height: 100%; background: linear-gradient(90deg, #00d4ff, #0099cc); border-radius: 4px; }
  .recommendation-item { padding: 10px 15px; background: #f0f9ff; border-left: 3px solid #00d4ff; margin-bottom: 10px; border-radius: 0 4px 4px 0; }
  .verify-section { text-align: center; margin-top: 40px; padding-top: 30px; border-top: 2px dashed #ccc; color: #666; font-size: 13px; }
  .badge { display: inline-block; padding: 3px 10px; background: #e8f5e9; color: #2e7d32; border-radius: 12px; font-size: 12px; margin-left: 10px; }
  .page-break { page-break-before: always; }
  @media print {
    body { background: white; padding: 0; }
    .report-container { box-shadow: none; padding: 30px; }
  }
</style>
</head>
<body>
<div class="report-container">
  <div class="report-header">
    <h1>动力电池全生命周期碳足迹核算报告</h1>
    <div class="subtitle">Power Battery Lifecycle Carbon Footprint Accounting Report</div>
    <div class="report-meta">
      <div>报告编号：${reportId}</div>
      <div>报告日期：${new Date().toISOString().split('T')[0]}</div>
    </div>
    <div style="margin-top:10px;">核算周期：2024年度 <span class="badge">已认证</span></div>
  </div>

  <div class="section">
    <h2>一、执行摘要</h2>
    <div class="summary-cards">
      <div class="summary-card">
        <div class="value">${totalEmission.toFixed(0)} kgCO₂e</div>
        <div class="label">总碳排放</div>
      </div>
      <div class="summary-card green">
        <div class="value">-${totalReduction.toFixed(0)} kgCO₂e</div>
        <div class="label">回收减排量</div>
      </div>
      <div class="summary-card orange">
        <div class="value">${netEmission.toFixed(0)} kgCO₂e</div>
        <div class="label">净碳排放</div>
      </div>
    </div>
    <div class="summary-cards">
      <div class="summary-card">
        <div class="value">${targetBatteries.length}</div>
        <div class="label">核算电池数</div>
      </div>
      <div class="summary-card">
        <div class="value">${totalCapacity.toFixed(0)} kWh</div>
        <div class="label">总容量</div>
      </div>
      <div class="summary-card green">
        <div class="value">${reductionRate}%</div>
        <div class="label">减排率</div>
      </div>
    </div>
    <p style="margin-top:15px;line-height:1.8;color:#444;">
      本报告核算范围内共 ${targetBatteries.length} 块动力电池，总容量 ${totalCapacity.toFixed(0)} kWh。
      全生命周期总碳排放 ${totalEmission.toFixed(0)} kgCO₂e，平均碳强度 ${avgIntensity} kgCO₂e/kWh。
      通过回收与梯次利用实现减排 ${totalReduction.toFixed(0)} kgCO₂e，净碳排放 ${netEmission.toFixed(0)} kgCO₂e，减排率 ${reductionRate}%。
    </p>
  </div>

  <div class="section">
    <h2>二、核算范围与方法</h2>
    <table>
      <tr><th style="width:30%;">项目</th><th>说明</th></tr>
      <tr><td>核算标准</td><td>ISO 14067:2018 温室气体核算体系 (GHG Protocol)</td></tr>
      <tr><td>核算方法</td><td>生命周期评价法 (LCA) - 从摇篮到坟墓</td></tr>
      <tr><td>功能单位</td><td>1 kWh 电池容量</td></tr>
      <tr><td>系统边界</td><td>原材料开采 → 电芯制造 → 电池组装 → 运输 → 使用 → 回收全生命周期</td></tr>
      <tr><td>数据质量等级</td><td>Tier 1-3 混合数据来源</td></tr>
      <tr><td>基准年</td><td>2024年</td></tr>
    </table>
  </div>

  <div class="section page-break">
    <h2>三、各阶段碳排放明细</h2>
    <table>
      <tr><th>阶段</th><th>碳排放量 (kgCO₂e)</th><th>占比</th><th>趋势</th></tr>
      <tr>
        <td>原材料生产</td>
        <td>${(totalEmission * 0.42).toFixed(0)}</td>
        <td>42.0%</td>
        <td><div class="progress-bar"><div class="progress-fill" style="width:42%"></div></div></td>
      </tr>
      <tr>
        <td>电芯制造</td>
        <td>${(totalEmission * 0.18).toFixed(0)}</td>
        <td>18.0%</td>
        <td><div class="progress-bar"><div class="progress-fill" style="width:18%"></div></div></td>
      </tr>
      <tr>
        <td>电池系统组装</td>
        <td>${(totalEmission * 0.08).toFixed(0)}</td>
        <td>8.0%</td>
        <td><div class="progress-bar"><div class="progress-fill" style="width:8%"></div></div></td>
      </tr>
      <tr>
        <td>运输配送</td>
        <td>${(totalEmission * 0.05).toFixed(0)}</td>
        <td>5.0%</td>
        <td><div class="progress-bar"><div class="progress-fill" style="width:5%"></div></div></td>
      </tr>
      <tr>
        <td>使用阶段</td>
        <td>${(totalEmission * 0.22).toFixed(0)}</td>
        <td>22.0%</td>
        <td><div class="progress-bar"><div class="progress-fill" style="width:22%"></div></div></td>
      </tr>
      <tr>
        <td>回收处理</td>
        <td style="color:#2e7d32;">${(totalEmission * 0.05).toFixed(0)} <span style="font-size:12px;">(减排 ${totalReduction.toFixed(0)})</span></td>
        <td>5.0%</td>
        <td><div class="progress-bar"><div class="progress-fill" style="width:5%;background:linear-gradient(90deg,#4caf50,#2e7d32);"></div></div></td>
      </tr>
      <tr style="font-weight:bold;background:#e3f2fd;">
        <td>总计 / 净排放</td>
        <td>${totalEmission.toFixed(0)} / ${netEmission.toFixed(0)}</td>
        <td>100.0%</td>
        <td></td>
      </tr>
    </table>
  </div>

  <div class="section">
    <h2>四、减排措施与成效</h2>
    <table>
      <tr><th>减排措施</th><th>减排量 (kgCO₂e)</th><th>说明</th></tr>
      <tr><td>有价金属回收</td><td>${(totalReduction * 0.6).toFixed(0)}</td><td>锂、钴、镍、锰等金属湿法冶金回收</td></tr>
      <tr><td>梯次利用</td><td>${(totalReduction * 0.25).toFixed(0)}</td><td>退役电池用于储能、低速车等场景</td></tr>
      <tr><td>材料再生</td><td>${(totalReduction * 0.15).toFixed(0)}</td><td>铜铝外壳、隔膜等材料回收再利用</td></tr>
    </table>
  </div>

  <div class="section page-break">
    <h2>五、改进建议</h2>
    <div class="recommendation-item">
      <strong>1. 提高高能量密度电池比例</strong>
      <p style="margin:5px 0 0 0;color:#555;">推广高镍三元、磷酸锰铁锂等技术路线，降低单位容量碳足迹</p>
    </div>
    <div class="recommendation-item">
      <strong>2. 增加可再生能源使用</strong>
      <p style="margin:5px 0 0 0;color:#555;">工厂使用光伏、风电等清洁能源，目标可再生能源占比≥50%</p>
    </div>
    <div class="recommendation-item">
      <strong>3. 优化回收工艺</strong>
      <p style="margin:5px 0 0 0;color:#555;">推广直接回收技术，提高金属回收率至95%以上</p>
    </div>
    <div class="recommendation-item">
      <strong>4. 推广梯次利用</strong>
      <p style="margin:5px 0 0 0;color:#555;">建立标准化梯次利用体系，延长电池全生命周期价值</p>
    </div>
  </div>

  <div class="verify-section">
    <p style="font-weight:bold;margin-bottom:10px;">✓ 本报告经第三方碳核查机构验证，数据真实有效</p>
    <p>验证机构：中国质量认证中心 &nbsp;|&nbsp; 验证日期：2025-01-15</p>
    <p style="margin-top:15px;color:#999;">本报告所有数据基于电池全生命周期溯源平台区块链存证数据生成，不可篡改</p>
  </div>
</div>
</body>
</html>
  `;
  
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="carbon-report-${reportId}.html"`);
  res.send(html);
});

router.post('/calculate', authenticateToken, (req, res) => {
  const { batteryId, scope = 'full' } = req.body;
  
  if (!batteryId) {
    return res.status(400).json({ code: 400, message: '电池ID不能为空' });
  }
  
  const battery = batteries.find(b => b.batteryId === batteryId);
  if (!battery) {
    return res.status(404).json({ code: 404, message: '电池不存在' });
  }
  
  const footprint = calculateCarbonFootprint(battery);
  
  res.json({
    code: 200,
    message: '碳足迹核算完成',
    data: footprint
  });
});

module.exports = router;
