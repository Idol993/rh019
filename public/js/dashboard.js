let dashboardCharts = {};
let dashboardInited = false;

function initDashboard() {
  if (dashboardInited) {
    refreshDashboard();
    return;
  }
  
  initCharts();
  loadDashboardData();
  dashboardInited = true;
  
  setInterval(() => {
    if (currentPage === 'dashboard') {
      refreshDashboard();
    }
  }, 5000);
}

function initCharts() {
  const onlineTrendChart = echarts.init(document.getElementById('chart-online-trend'));
  const sohDistributionChart = echarts.init(document.getElementById('chart-soh-distribution'));
  const typeDistributionChart = echarts.init(document.getElementById('chart-type-distribution'));
  const regionHeatmapChart = echarts.init(document.getElementById('chart-region-heatmap'));
  const factoryRankingChart = echarts.init(document.getElementById('chart-factory-ranking'));
  const warningTrendChart = echarts.init(document.getElementById('chart-warning-trend'));
  
  dashboardCharts = {
    onlineTrend: onlineTrendChart,
    sohDistribution: sohDistributionChart,
    typeDistribution: typeDistributionChart,
    regionHeatmap: regionHeatmapChart,
    factoryRanking: factoryRankingChart,
    warningTrend: warningTrendChart
  };
  
  window.addEventListener('resize', () => {
    Object.values(dashboardCharts).forEach(chart => {
      if (chart && chart.resize) chart.resize();
    });
  });
}

function loadDashboardData() {
  api.dashboard.overview().then(result => {
    if (result && result.code === 200) {
      updateStats(result.data);
    }
  });
  
  api.dashboard.realtimeTrend(24).then(result => {
    if (result && result.code === 200) {
      renderOnlineTrend(result.data);
    }
  });
  
  api.dashboard.sohDistribution().then(result => {
    if (result && result.code === 200) {
      renderSohDistribution(result.data);
    }
  });
  
  api.dashboard.typeDistribution().then(result => {
    if (result && result.code === 200) {
      renderTypeDistribution(result.data);
    }
  });
  
  api.dashboard.regionDistribution().then(result => {
    if (result && result.code === 200) {
      renderRegionHeatmap(result.data);
    }
  });
  
  api.dashboard.factoryRanking().then(result => {
    if (result && result.code === 200) {
      renderFactoryRanking(result.data);
    }
  });
  
  api.dashboard.warningTrend(7).then(result => {
    if (result && result.code === 200) {
      renderWarningTrend(result.data);
    }
  });
  
  api.monitor.realtime().then(result => {
    if (result && result.code === 200) {
      renderRealtimeBatteries(result.data);
    }
  });
  
  updateWarningBadge();
}

function refreshDashboard() {
  api.dashboard.overview().then(result => {
    if (result && result.code === 200) {
      updateStats(result.data);
    }
  });
}

function updateStats(data) {
  document.getElementById('stat-total').textContent = data.totalBatteries || 0;
  document.getElementById('stat-online').textContent = data.onlineBatteries || 0;
  document.getElementById('stat-rate').textContent = data.onlineRate || '0%';
  document.getElementById('stat-warning').textContent = data.todayWarnings || 0;
  document.getElementById('stat-critical').textContent = data.criticalWarnings || 0;
  document.getElementById('stat-carbon').textContent = data.carbonReduction?.replace(' kgCO₂e', '') || 0;
  document.getElementById('stat-soh').textContent = data.avgSoh || '0%';
  document.getElementById('stat-echelon').textContent = data.echelonUtilizationRate || '0%';
}

function renderOnlineTrend(data) {
  const times = data.map(d => d.time);
  const onlineData = data.map(d => d.online);
  const chargingData = data.map(d => d.charging);
  const runningData = data.map(d => d.running);
  
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 33, 66, 0.95)',
      borderColor: 'rgba(0, 212, 255, 0.3)',
      textStyle: { color: '#e0f0ff' }
    },
    legend: {
      data: ['在线', '充电中', '运行中'],
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
      boundaryGap: false,
      data: times,
      axisLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.2)' } },
      axisLabel: { color: '#5a7a9a', fontSize: 10 }
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.2)' } },
      axisLabel: { color: '#5a7a9a', fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.08)' } }
    },
    series: [
      {
        name: '在线',
        type: 'line',
        smooth: true,
        data: onlineData,
        lineStyle: { color: '#00d4ff', width: 2 },
        itemStyle: { color: '#00d4ff' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(0, 212, 255, 0.3)' },
            { offset: 1, color: 'rgba(0, 212, 255, 0.02)' }
          ])
        }
      },
      {
        name: '充电中',
        type: 'line',
        smooth: true,
        data: chargingData,
        lineStyle: { color: '#00ff88', width: 2 },
        itemStyle: { color: '#00ff88' }
      },
      {
        name: '运行中',
        type: 'line',
        smooth: true,
        data: runningData,
        lineStyle: { color: '#ffaa00', width: 2 },
        itemStyle: { color: '#ffaa00' }
      }
    ]
  };
  
  dashboardCharts.onlineTrend.setOption(option);
}

function renderSohDistribution(data) {
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(15, 33, 66, 0.95)',
      borderColor: 'rgba(0, 212, 255, 0.3)',
      textStyle: { color: '#e0f0ff' }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: data.map(d => d.name),
      axisLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.2)' } },
      axisLabel: { color: '#5a7a9a', fontSize: 10, rotate: 0 }
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.2)' } },
      axisLabel: { color: '#5a7a9a', fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.08)' } }
    },
    series: [{
      data: data.map((d, i) => ({
        value: d.count,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: ['#00d4ff', '#00ff88', '#ffaa00', '#ff8844', '#ff4466'][i] },
            { offset: 1, color: 'rgba(0, 212, 255, 0.1)' }
          ])
        }
      })),
      type: 'bar',
      barWidth: '50%',
      itemStyle: {
        borderRadius: [4, 4, 0, 0]
      }
    }]
  };
  
  dashboardCharts.sohDistribution.setOption(option);
}

function renderTypeDistribution(data) {
  const colors = ['#00d4ff', '#00ff88', '#ffaa00', '#ff8844', '#aa66ff'];
  
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(15, 33, 66, 0.95)',
      borderColor: 'rgba(0, 212, 255, 0.3)',
      textStyle: { color: '#e0f0ff' },
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'center',
      textStyle: { color: '#8ab4d8', fontSize: 12 }
    },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['35%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 4,
        borderColor: '#0a1628',
        borderWidth: 2
      },
      label: {
        show: false
      },
      emphasis: {
        label: {
          show: true,
          fontSize: 14,
          fontWeight: 'bold',
          color: '#e0f0ff'
        }
      },
      labelLine: {
        show: false
      },
      data: data.map((d, i) => ({
        value: d.value,
        name: d.name,
        itemStyle: { color: colors[i % colors.length] }
      }))
    }]
  };
  
  dashboardCharts.typeDistribution.setOption(option);
}

function renderRegionHeatmap(data) {
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 33, 66, 0.95)',
      borderColor: 'rgba(0, 212, 255, 0.3)',
      textStyle: { color: '#e0f0ff' }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.2)' } },
      axisLabel: { color: '#5a7a9a', fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.08)' } }
    },
    yAxis: {
      type: 'category',
      data: data.map(d => d.name).reverse(),
      axisLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.2)' } },
      axisLabel: { color: '#5a7a9a', fontSize: 11 }
    },
    series: [{
      type: 'bar',
      data: data.map(d => d.value).reverse(),
      barWidth: '50%',
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: 'rgba(0, 212, 255, 0.3)' },
          { offset: 1, color: '#00d4ff' }
        ]),
        borderRadius: [0, 4, 4, 0]
      }
    }]
  };
  
  dashboardCharts.regionHeatmap.setOption(option);
}

function renderFactoryRanking(data) {
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 33, 66, 0.95)',
      borderColor: 'rgba(0, 212, 255, 0.3)',
      textStyle: { color: '#e0f0ff' }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.2)' } },
      axisLabel: { color: '#5a7a9a', fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.08)' } }
    },
    yAxis: {
      type: 'category',
      data: data.map(d => d.factory).reverse(),
      axisLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.2)' } },
      axisLabel: { color: '#5a7a9a', fontSize: 10 }
    },
    series: [{
      type: 'bar',
      data: data.map(d => d.total).reverse(),
      barWidth: '50%',
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: 'rgba(0, 255, 136, 0.3)' },
          { offset: 1, color: '#00ff88' }
        ]),
        borderRadius: [0, 4, 4, 0]
      }
    }]
  };
  
  dashboardCharts.factoryRanking.setOption(option);
}

function renderWarningTrend(data) {
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
      data: ['一般', '紧急', '特级'],
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
      data: dates,
      axisLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.2)' } },
      axisLabel: { color: '#5a7a9a', fontSize: 10 }
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.2)' } },
      axisLabel: { color: '#5a7a9a', fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.08)' } }
    },
    series: [
      {
        name: '一般',
        type: 'bar',
        stack: 'total',
        data: data.map(d => d.normal),
        itemStyle: { color: '#6688ff' }
      },
      {
        name: '紧急',
        type: 'bar',
        stack: 'total',
        data: data.map(d => d.urgent),
        itemStyle: { color: '#ffaa00' }
      },
      {
        name: '特级',
        type: 'bar',
        stack: 'total',
        data: data.map(d => d.critical),
        itemStyle: { color: '#ff4466' }
      }
    ]
  };
  
  dashboardCharts.warningTrend.setOption(option);
}

function renderRealtimeBatteries(batteries) {
  const grid = document.getElementById('realtime-battery-grid');
  if (!grid) return;
  
  grid.innerHTML = batteries.map(b => `
    <div class="battery-mini ${b.status}" onclick="viewBatteryDetail('${b.batteryId}')">
      <div class="bm-id">${b.batteryId.substring(0, 10)}...</div>
      <div class="bm-soc">
        <div class="bm-soc-fill" style="width: ${b.soc}%"></div>
      </div>
      <span class="bm-status">${getStatusText(b.status)}</span>
      <div class="bm-temp">${b.maxTemp}℃</div>
    </div>
  `).join('');
}

function updateRealtimeBatteries(batteries) {
  const grid = document.getElementById('realtime-battery-grid');
  if (!grid || grid.children.length === 0) {
    renderRealtimeBatteries(batteries);
    return;
  }
  
  batteries.forEach(b => {
    const item = grid.querySelector(`[onclick*="${b.batteryId}"]`);
    if (item) {
      const socFill = item.querySelector('.bm-soc-fill');
      if (socFill) socFill.style.width = b.soc + '%';
      const tempEl = item.querySelector('.bm-temp');
      if (tempEl) tempEl.textContent = b.maxTemp + '℃';
    }
  });
}

function getStatusText(status) {
  const map = {
    running: '运行中',
    charging: '充电中',
    idle: '待机',
    retired: '退役',
    echelon: '梯次利用',
    dismantled: '已拆解',
    factory: '出厂'
  };
  return map[status] || status;
}

function viewBatteryDetail(batteryId) {
  switchPage('monitor');
  setTimeout(() => {
    selectMonitorBattery(batteryId);
  }, 100);
}
