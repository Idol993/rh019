let carbonCharts = {};
let carbonInited = false;

function loadCarbonSummary() {
  const period = document.getElementById('carbon-period').value;
  
  api.carbon.summary({ period }).then(result => {
    if (result && result.code === 200) {
      updateCarbonStats(result.data);
      renderCarbonTrend(result.data.trend);
    }
  });
  
  if (!carbonInited) {
    initCarbonCharts();
    carbonInited = true;
  }
  
  renderCarbonStageChart();
}

function updateCarbonStats(data) {
  document.getElementById('cc-total').textContent = formatNumber(data.carbon?.totalEmission || 0);
  document.getElementById('cc-reduction').textContent = formatNumber(data.carbon?.reduction || 0);
  document.getElementById('cc-net').textContent = formatNumber(data.carbon?.netEmission || 0);
}

function initCarbonCharts() {
  const trendChart = echarts.init(document.getElementById('chart-carbon-trend'));
  const stageChart = echarts.init(document.getElementById('chart-carbon-stage'));
  
  carbonCharts = { trend: trendChart, stage: stageChart };
  
  window.addEventListener('resize', () => {
    Object.values(carbonCharts).forEach(chart => chart.resize());
  });
}

function renderCarbonTrend(data) {
  if (!carbonCharts.trend) return;
  
  const dates = data.map(d => d.date);
  
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 33, 66, 0.95)',
      borderColor: 'rgba(0, 212, 255, 0.3)',
      textStyle: { color: '#e0f0ff' }
    },
    legend: {
      data: ['碳排放', '碳减排'],
      textStyle: { color: '#8ab4d8' },
      top: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '12%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.2)' } },
      axisLabel: { color: '#5a7a9a', fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.2)' } },
      axisLabel: { color: '#5a7a9a', fontSize: 11 },
      splitLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.08)' } }
    },
    series: [
      {
        name: '碳排放',
        type: 'line',
        smooth: true,
        data: data.map(d => d.emission),
        lineStyle: { color: '#ff8844', width: 2 },
        itemStyle: { color: '#ff8844' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(255, 136, 68, 0.3)' },
            { offset: 1, color: 'rgba(255, 136, 68, 0.02)' }
          ])
        }
      },
      {
        name: '碳减排',
        type: 'line',
        smooth: true,
        data: data.map(d => d.reduction),
        lineStyle: { color: '#00ff88', width: 2 },
        itemStyle: { color: '#00ff88' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(0, 255, 136, 0.3)' },
            { offset: 1, color: 'rgba(0, 255, 136, 0.02)' }
          ])
        }
      }
    ]
  };
  
  carbonCharts.trend.setOption(option);
}

function renderCarbonStageChart() {
  const stageData = [
    { name: '生产制造', value: 45, color: '#00d4ff' },
    { name: '运输物流', value: 8, color: '#6688ff' },
    { name: '使用阶段', value: 35, color: '#ffaa00' },
    { name: '充电损耗', value: 7, color: '#ff8844' },
    { name: '回收减排', value: -5, color: '#00ff88' }
  ];
  
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(15, 33, 66, 0.95)',
      borderColor: 'rgba(0, 212, 255, 0.3)',
      textStyle: { color: '#e0f0ff' },
      formatter: '{b}: {c}%'
    },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['50%', '55%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 4,
        borderColor: '#0a1628',
        borderWidth: 2
      },
      label: {
        show: true,
        color: '#8ab4d8',
        fontSize: 11,
        formatter: '{b}\n{d}%'
      },
      labelLine: {
        show: true,
        lineStyle: { color: 'rgba(0, 212, 255, 0.3)' }
      },
      data: stageData.map(d => ({
        value: Math.abs(d.value),
        name: d.name,
        itemStyle: { color: d.color }
      }))
    }]
  };
  
  if (carbonCharts.stage) {
    carbonCharts.stage.setOption(option);
  }
}

function queryBatteryCarbon() {
  const batteryId = document.getElementById('carbon-battery-id').value.trim();
  
  if (!batteryId) {
    showToast('请输入电池ID', 'error');
    return;
  }
  
  api.carbon.footprint(batteryId).then(result => {
    if (result && result.code === 200) {
      renderBatteryCarbonDetail(result.data);
    } else {
      showToast('未找到该电池的碳足迹数据', 'error');
    }
  });
}

function renderBatteryCarbonDetail(data) {
  const detailEl = document.getElementById('carbon-battery-detail');
  detailEl.classList.remove('hidden');
  
  const stages = data.stages || {};
  
  detailEl.innerHTML = `
    <h5>电池 ${data.batteryId} 碳足迹</h5>
    <div class="cbd-item">
      <span>核算标准</span>
      <span>${data.calculationStandard}</span>
    </div>
    <div class="cbd-item">
      <span>总碳排放</span>
      <span style="color: var(--accent-warning);">${data.totalEmission} ${data.unit}</span>
    </div>
    ${stages.production ? `
      <div class="cbd-item">
        <span>生产阶段</span>
        <span>${stages.production.emission} ${data.unit}</span>
      </div>
    ` : ''}
    ${stages.transport ? `
      <div class="cbd-item">
        <span>运输阶段</span>
        <span>${stages.transport.emission} ${data.unit}</span>
      </div>
    ` : ''}
    ${stages.use ? `
      <div class="cbd-item">
        <span>使用阶段</span>
        <span>${stages.use.emission} ${data.unit}</span>
      </div>
    ` : ''}
    ${stages.chargingLoss ? `
      <div class="cbd-item">
        <span>充电损耗</span>
        <span>${stages.chargingLoss.emission} ${data.unit}</span>
      </div>
    ` : ''}
    ${stages.recycle ? `
      <div class="cbd-item">
        <span>回收减排</span>
        <span style="color: var(--accent-success);">-${stages.recycle.emission} ${data.unit}</span>
      </div>
    ` : ''}
    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(0,212,255,0.1);">
      <div class="cbd-item">
        <span>材料回收率</span>
        <span>${data.carbonReduction?.recyclingRate || '--'}</span>
      </div>
    </div>
  `;
}

function formatNumber(num) {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + '万';
  }
  return Number(num).toLocaleString();
}
