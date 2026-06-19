let monitorBatteries = [];
let selectedBatteryId = null;
let detailCharts = {};
let monitorInited = false;

function initMonitor() {
  if (monitorInited) return;
  
  loadMonitorBatteries();
  initDetailCharts();
  monitorInited = true;
  
  setInterval(() => {
    if (currentPage === 'monitor') {
      refreshMonitorData();
    }
  }, 3000);
}

function loadMonitorBatteries() {
  api.monitor.realtime().then(result => {
    if (result && result.code === 200) {
      monitorBatteries = result.data;
      renderMonitorList(monitorBatteries);
      updateMonitorStats();
    }
  });
}

function refreshMonitorData() {
  api.monitor.realtime().then(result => {
    if (result && result.code === 200) {
      monitorBatteries = result.data;
      updateMonitorList(monitorBatteries);
      updateMonitorStats();
      
      if (selectedBatteryId) {
        const battery = monitorBatteries.find(b => b.batteryId === selectedBatteryId);
        if (battery) {
          updateDetailView(battery);
        }
      }
    }
  });
}

function updateMonitorStats() {
  const running = monitorBatteries.filter(b => b.status === 'running').length;
  const charging = monitorBatteries.filter(b => b.status === 'charging').length;
  const idle = monitorBatteries.filter(b => b.status === 'idle').length;
  
  document.getElementById('mini-running').textContent = running;
  document.getElementById('mini-charging').textContent = charging;
  document.getElementById('mini-idle').textContent = idle;
}

function renderMonitorList(batteries) {
  const list = document.getElementById('monitor-battery-list');
  if (!list) return;
  
  list.innerHTML = batteries.map(b => `
    <div class="battery-list-item ${b.batteryId === selectedBatteryId ? 'selected' : ''}" 
         data-id="${b.batteryId}"
         onclick="selectMonitorBattery('${b.batteryId}')">
      <div class="bli-header">
        <span class="bli-id">${b.batteryId.substring(0, 12)}...</span>
        <span class="status-badge status-${b.status}" style="font-size: 10px;">${getStatusText(b.status)}</span>
      </div>
      <div class="bli-vin">${b.vin || '未装车'}</div>
      <div class="bli-info">
        <span>SOC: ${b.soc}%</span>
        <span>${b.maxTemp}℃</span>
      </div>
    </div>
  `).join('');
}

function updateMonitorList(batteries) {
  const list = document.getElementById('monitor-battery-list');
  if (!list) return;
  
  batteries.forEach(b => {
    const item = list.querySelector(`[data-id="${b.batteryId}"]`);
    if (item) {
      const statusBadge = item.querySelector('.status-badge');
      if (statusBadge) {
        statusBadge.className = `status-badge status-${b.status}`;
        statusBadge.textContent = getStatusText(b.status);
      }
      
      const infoSpans = item.querySelectorAll('.bli-info span');
      if (infoSpans.length >= 2) {
        infoSpans[0].textContent = `SOC: ${b.soc}%`;
        infoSpans[1].textContent = `${b.maxTemp}℃`;
      }
    }
  });
}

function filterMonitorList() {
  const keyword = document.getElementById('monitor-search').value.toLowerCase();
  const filtered = monitorBatteries.filter(b => 
    b.batteryId.toLowerCase().includes(keyword) ||
    (b.vin && b.vin.toLowerCase().includes(keyword))
  );
  renderMonitorList(filtered);
}

function selectMonitorBattery(batteryId) {
  selectedBatteryId = batteryId;
  
  document.querySelectorAll('.battery-list-item').forEach(item => {
    item.classList.remove('selected');
    if (item.dataset.id === batteryId) {
      item.classList.add('selected');
    }
  });
  
  const battery = monitorBatteries.find(b => b.batteryId === batteryId);
  if (battery) {
    updateDetailView(battery);
    loadHistoryData(batteryId);
  }
}

function updateDetailView(battery) {
  document.getElementById('monitor-detail-header').innerHTML = `
    <h3>${battery.batteryId}</h3>
    <p>${battery.vin || '未装车'} · ${getStatusText(battery.status)}</p>
  `;
  
  document.getElementById('detail-voltage').textContent = battery.totalVoltage + ' V';
  document.getElementById('detail-current').textContent = battery.totalCurrent + ' A';
  document.getElementById('detail-soc').textContent = battery.soc + ' %';
  document.getElementById('detail-soh').textContent = battery.soh + ' %';
  document.getElementById('detail-maxtemp').textContent = battery.maxTemp + ' ℃';
  document.getElementById('detail-mintemp').textContent = battery.minTemp + ' ℃';
  document.getElementById('detail-tempdiff').textContent = battery.tempDiff + ' ℃';
  document.getElementById('detail-insulation').textContent = battery.insulationResistance + ' kΩ';
}

function initDetailCharts() {
  const socChart = echarts.init(document.getElementById('detail-chart-soc'));
  const tempChart = echarts.init(document.getElementById('detail-chart-temp'));
  
  detailCharts = { soc: socChart, temp: tempChart };
  
  window.addEventListener('resize', () => {
    Object.values(detailCharts).forEach(chart => chart.resize());
  });
}

function loadHistoryData(batteryId) {
  api.monitor.history(batteryId, { days: 1 }).then(result => {
    if (result && result.code === 200) {
      renderDetailCharts(result.data);
    }
  });
}

function renderDetailCharts(data) {
  const times = data.map(d => {
    const date = new Date(d.timestamp);
    return date.getHours() + ':' + String(date.getMinutes()).padStart(2, '0');
  });
  
  const socOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 33, 66, 0.95)',
      borderColor: 'rgba(0, 212, 255, 0.3)',
      textStyle: { color: '#e0f0ff' }
    },
    legend: {
      data: ['SOC', 'SOH'],
      textStyle: { color: '#8ab4d8', fontSize: 11 },
      top: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '25%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: times,
      axisLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.2)' } },
      axisLabel: { color: '#5a7a9a', fontSize: 9 }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.2)' } },
      axisLabel: { color: '#5a7a9a', fontSize: 9 },
      splitLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.08)' } }
    },
    series: [
      {
        name: 'SOC',
        type: 'line',
        smooth: true,
        data: data.map(d => d.soc),
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
        name: 'SOH',
        type: 'line',
        smooth: true,
        data: data.map(d => d.soh),
        lineStyle: { color: '#00ff88', width: 2 },
        itemStyle: { color: '#00ff88' }
      }
    ]
  };
  
  const tempOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 33, 66, 0.95)',
      borderColor: 'rgba(0, 212, 255, 0.3)',
      textStyle: { color: '#e0f0ff' }
    },
    legend: {
      data: ['最高温度', '最低温度', '温差'],
      textStyle: { color: '#8ab4d8', fontSize: 11 },
      top: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '25%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: times,
      axisLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.2)' } },
      axisLabel: { color: '#5a7a9a', fontSize: 9 }
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.2)' } },
      axisLabel: { color: '#5a7a9a', fontSize: 9 },
      splitLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.08)' } }
    },
    series: [
      {
        name: '最高温度',
        type: 'line',
        smooth: true,
        data: data.map(d => d.maxTemp),
        lineStyle: { color: '#ff4466', width: 2 },
        itemStyle: { color: '#ff4466' }
      },
      {
        name: '最低温度',
        type: 'line',
        smooth: true,
        data: data.map(d => d.minTemp),
        lineStyle: { color: '#6688ff', width: 2 },
        itemStyle: { color: '#6688ff' }
      },
      {
        name: '温差',
        type: 'line',
        smooth: true,
        data: data.map(d => d.tempDiff),
        lineStyle: { color: '#ffaa00', width: 2 },
        itemStyle: { color: '#ffaa00' }
      }
    ]
  };
  
  detailCharts.soc.setOption(socOption);
  detailCharts.temp.setOption(tempOption);
}

function updateMonitorData(data) {
  data.forEach(b => {
    const existing = monitorBatteries.find(mb => mb.batteryId === b.batteryId);
    if (existing) {
      Object.assign(existing, b);
    }
  });
  updateMonitorList(monitorBatteries);
  updateMonitorStats();
}

function getStatusText(status) {
  const map = {
    running: '运行中',
    charging: '充电中',
    idle: '待机',
    retired: '退役',
    echelon: '梯次利用',
    dismantled: '已拆解'
  };
  return map[status] || status;
}
