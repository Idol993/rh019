let carbonCharts = {};
let carbonInited = false;

function loadCarbonSummary() {
  if (!carbonInited) {
    initCarbonCharts();
    carbonInited = true;
  }
  
  api.carbon.summary().then(result => {
    if (result && result.code === 200) {
      updateCarbonStats(result.data);
    }
  });
  
  api.carbon.trend().then(result => {
    if (result && result.code === 200) {
      renderCarbonTrend(result.data);
    }
  });
  
  renderCarbonStageChart();
  loadCarbonReports();
}

function updateCarbonStats(data) {
  document.getElementById('cc-total').textContent = formatNumber(data.totalEmission || 0);
  document.getElementById('cc-reduction').textContent = formatNumber(data.totalRecyclingReduction || 0);
  document.getElementById('cc-net').textContent = formatNumber(data.netEmission || 0);
  document.getElementById('cc-intensity').textContent = data.avgCarbonIntensity || '0';
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
  
  const months = data.map(d => d.month);
  
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 33, 66, 0.95)',
      borderColor: 'rgba(0, 212, 255, 0.3)',
      textStyle: { color: '#e0f0ff' }
    },
    legend: {
      data: ['总碳排放', '回收减排', '净排放'],
      textStyle: { color: '#8ab4d8' },
      top: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: months,
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
        name: '总碳排放',
        type: 'line',
        smooth: true,
        data: data.map(d => parseFloat(d.totalEmission)),
        lineStyle: { color: '#ff8844', width: 2 },
        itemStyle: { color: '#ff8844' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(255, 136, 68, 0.25)' },
            { offset: 1, color: 'rgba(255, 136, 68, 0.02)' }
          ])
        }
      },
      {
        name: '回收减排',
        type: 'line',
        smooth: true,
        data: data.map(d => parseFloat(d.recyclingReduction)),
        lineStyle: { color: '#00ff88', width: 2 },
        itemStyle: { color: '#00ff88' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(0, 255, 136, 0.25)' },
            { offset: 1, color: 'rgba(0, 255, 136, 0.02)' }
          ])
        }
      },
      {
        name: '净排放',
        type: 'line',
        smooth: true,
        data: data.map(d => parseFloat(d.netEmission)),
        lineStyle: { color: '#00d4ff', width: 2 },
        itemStyle: { color: '#00d4ff' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(0, 212, 255, 0.2)' },
            { offset: 1, color: 'rgba(0, 212, 255, 0.02)' }
          ])
        }
      }
    ]
  };
  
  carbonCharts.trend.setOption(option);
}

function renderCarbonStageChart() {
  const stageData = [
    { name: '生产制造', value: 42, color: '#00d4ff' },
    { name: '运输物流', value: 5, color: '#6688ff' },
    { name: '使用阶段', value: 22, color: '#ffaa00' },
    { name: '电池组装', value: 8, color: '#ff8844' },
    { name: '回收处理', value: 5, color: '#00ff88' }
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
        fontSize: 10,
        formatter: '{b}\n{d}%'
      },
      labelLine: {
        show: true,
        lineStyle: { color: 'rgba(0, 212, 255, 0.3)' }
      },
      data: stageData.map(d => ({
        value: d.value,
        name: d.name,
        itemStyle: { color: d.color }
      }))
    }]
  };
  
  if (carbonCharts.stage) {
    carbonCharts.stage.setOption(option);
  }
}

function loadCarbonReports() {
  api.carbon.reports().then(result => {
    if (result && result.code === 200) {
      renderCarbonReports(result.data);
    }
  });
}

function renderCarbonReports(reports) {
  const listEl = document.getElementById('carbon-reports-list');
  if (!listEl) return;
  
  if (!reports || reports.length === 0) {
    listEl.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 30px; grid-column: 1 / -1;">暂无报告</div>';
    return;
  }
  
  const typeLabels = {
    annual: '年度报告',
    quarterly: '季度报告',
    recycling: '回收专项',
    monthly: '月度报告'
  };
  
  listEl.innerHTML = reports.map(r => `
    <div style="background: rgba(0, 212, 255, 0.05); border: 1px solid rgba(0, 212, 255, 0.15); border-radius: 8px; padding: 16px; transition: all 0.3s;" 
         onmouseover="this.style.borderColor='rgba(0,212,255,0.4)'" 
         onmouseout="this.style.borderColor='rgba(0,212,255,0.15)'">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
        <h4 style="margin: 0; font-size: 14px; color: var(--text-primary);">${r.title}</h4>
        <span style="font-size: 11px; padding: 2px 8px; background: rgba(0, 255, 136, 0.1); color: #00ff88; border-radius: 10px;">${typeLabels[r.type] || r.type}</span>
      </div>
      <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px; line-height: 1.8;">
        <div>报告编号: <span style="font-family: monospace;">${r.id}</span></div>
        <div>报告日期: ${r.reportDate || '-'}</div>
        <div>核算范围: ${r.scope || '-'}</div>
        <div>涉及电池: ${r.batteriesCount || '-'} 块</div>
        <div>总排放: ${r.totalEmission || '-'} kgCO₂e</div>
        <div>核算标准: ${r.standard || 'ISO 14067'}</div>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-primary btn-sm" onclick="viewCarbonReport('${r.id}')" style="flex: 1;">查看报告</button>
        <button class="btn btn-secondary btn-sm" onclick="downloadCarbonReport('${r.id}')" style="flex: 1;">下载</button>
      </div>
    </div>
  `).join('');
}

function viewCarbonReport(reportId) {
  const url = api.carbon.reportHtmlUrl(reportId);
  window.open(url, '_blank');
  showToast('正在打开报告...');
}

function downloadCarbonReport(reportId) {
  const url = api.carbon.reportHtmlUrl(reportId);
  const a = document.createElement('a');
  a.href = url;
  a.download = `carbon-report-${reportId}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('报告已开始下载');
}

function queryBatteryCarbon() {
  const batteryId = document.getElementById('carbon-battery-id').value.trim();
  
  if (!batteryId) {
    showToast('请输入电池ID', 'error');
    return;
  }
  
  api.carbon.battery(batteryId).then(result => {
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
  
  const stages = data.stages || [];
  
  let stagesHtml = stages.map(s => `
    <div class="cbd-item">
      <span>${s.stage}</span>
      <span>${s.emission} kgCO₂e</span>
    </div>
  `).join('');
  
  detailEl.innerHTML = `
    <h5 style="margin-bottom: 10px;">电池 ${data.batteryId} 碳足迹</h5>
    <div class="cbd-item">
      <span>核算标准</span>
      <span>${data.standard || 'ISO 14067'}</span>
    </div>
    <div class="cbd-item">
      <span>总碳排放</span>
      <span style="color: var(--accent-warning);">${data.totalEmission} kgCO₂e</span>
    </div>
    ${stagesHtml}
    <div class="cbd-item">
      <span>回收减排</span>
      <span style="color: var(--accent-success);">-${data.recyclingReduction} kgCO₂e</span>
    </div>
    <div class="cbd-item" style="border-top: 1px solid rgba(0,212,255,0.15); padding-top: 8px; margin-top: 8px;">
      <span style="font-weight: bold;">净碳排放</span>
      <span style="font-weight: bold; color: var(--accent-primary);">${data.netEmission} kgCO₂e</span>
    </div>
    <div class="cbd-item">
      <span>碳强度</span>
      <span>${data.carbonIntensity} ${data.unit || 'kgCO₂e/kWh'}</span>
    </div>
  `;
}

function formatNumber(num) {
  const n = parseFloat(num);
  if (isNaN(n)) return '0';
  if (n >= 10000) {
    return (n / 10000).toFixed(1) + '万';
  }
  return Math.floor(n).toLocaleString();
}
