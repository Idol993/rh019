let batteryPage = 1;
let batteryPageSize = 20;
let batteryTotal = 0;

function loadBatteries() {
  const status = document.getElementById('filter-status').value;
  const batteryType = document.getElementById('filter-type').value;
  const keyword = document.getElementById('filter-keyword').value;
  
  const params = {
    page: batteryPage,
    pageSize: batteryPageSize
  };
  
  if (status) params.status = status;
  if (batteryType) params.batteryType = batteryType;
  if (keyword) params.keyword = keyword;
  
  api.battery.list(params).then(result => {
    if (result && result.code === 200) {
      renderBatteryTable(result.data.list);
      batteryTotal = result.data.total;
      renderPagination();
    }
  });
}

function renderBatteryTable(batteries) {
  const tbody = document.getElementById('battery-table-body');
  
  tbody.innerHTML = batteries.map(b => `
    <tr>
      <td style="font-family: monospace; font-size: 11px;">${b.batteryId}</td>
      <td>${b.batteryType}</td>
      <td>${b.ratedCapacity}Ah</td>
      <td style="color: ${parseFloat(b.currentSoh) > 80 ? '#00ff88' : parseFloat(b.currentSoh) > 60 ? '#ffaa00' : '#ff4466'}">
        ${b.currentSoh}%
      </td>
      <td>${b.cycles}</td>
      <td style="font-family: monospace;">${b.vin || '-'}</td>
      <td><span class="status-badge status-${b.status}">${getStatusText(b.status)}</span></td>
      <td>${b.region || '-'}</td>
      <td>
        <div class="action-btns">
          <button class="action-btn" onclick="viewBattery('${b.batteryId}')">详情</button>
          <button class="action-btn" onclick="viewTrace('${b.batteryId}')">溯源</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderPagination() {
  const totalPages = Math.ceil(batteryTotal / batteryPageSize);
  const pagination = document.getElementById('pagination');
  
  let html = `
    <button class="page-btn" ${batteryPage <= 1 ? 'disabled' : ''} onclick="goToPage(${batteryPage - 1})">上一页</button>
  `;
  
  const startPage = Math.max(1, batteryPage - 2);
  const endPage = Math.min(totalPages, batteryPage + 2);
  
  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="page-btn ${i === batteryPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
  }
  
  html += `
    <button class="page-btn" ${batteryPage >= totalPages ? 'disabled' : ''} onclick="goToPage(${batteryPage + 1})">下一页</button>
    <span style="color: var(--text-muted); font-size: 12px; margin-left: 12px;">共 ${batteryTotal} 条</span>
  `;
  
  pagination.innerHTML = html;
}

function goToPage(page) {
  batteryPage = page;
  loadBatteries();
}

function viewBattery(batteryId) {
  api.battery.detail(batteryId).then(result => {
    if (result && result.code === 200) {
      const b = result.data;
      showModal('电池档案详情', `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div>
            <h4 style="margin-bottom: 12px; color: var(--accent-primary);">基本信息</h4>
            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
              <div><span style="color: var(--text-muted);">电池ID:</span> <span style="font-family: monospace;">${b.batteryId}</span></div>
              <div><span style="color: var(--text-muted);">电池类型:</span> ${b.batteryType}</div>
              <div><span style="color: var(--text-muted);">电芯型号:</span> ${b.cellModel}</div>
              <div><span style="color: var(--text-muted);">额定容量:</span> ${b.ratedCapacity}Ah</div>
              <div><span style="color: var(--text-muted);">标称电压:</span> ${b.nominalVoltage}V</div>
              <div><span style="color: var(--text-muted);">生产批次:</span> ${b.batchNo}</div>
              <div><span style="color: var(--text-muted);">出厂日期:</span> ${b.productionDate}</div>
            </div>
          </div>
          <div>
            <h4 style="margin-bottom: 12px; color: var(--accent-primary);">状态信息</h4>
            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
              <div><span style="color: var(--text-muted);">当前状态:</span> <span class="status-badge status-${b.status}">${getStatusText(b.status)}</span></div>
              <div><span style="color: var(--text-muted);">当前SOH:</span> <span style="color: var(--accent-success);">${b.currentSoh}%</span></div>
              <div><span style="color: var(--text-muted);">出厂SOH:</span> ${b.factorySoh}%</div>
              <div><span style="color: var(--text-muted);">循环次数:</span> ${b.cycles}次</div>
              <div><span style="color: var(--text-muted);">当前SOC:</span> ${b.soc}%</div>
              <div><span style="color: var(--text-muted);">总容量:</span> ${b.totalCapacity}kWh</div>
              <div><span style="color: var(--text-muted);">绝缘电阻:</span> ${b.insulationResistance}kΩ</div>
            </div>
          </div>
          <div>
            <h4 style="margin-bottom: 12px; color: var(--accent-primary);">车辆信息</h4>
            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
              <div><span style="color: var(--text-muted);">VIN码:</span> <span style="font-family: monospace;">${b.vin || '-'}</span></div>
              <div><span style="color: var(--text-muted);">车型:</span> ${b.vehicleModel || '-'}</div>
              <div><span style="color: var(--text-muted);">车主:</span> ${b.owner || '-'}</div>
              <div><span style="color: var(--text-muted);">所属区域:</span> ${b.region || '-'}</div>
              <div><span style="color: var(--text-muted);">装车日期:</span> ${b.installDate || '-'}</div>
            </div>
          </div>
          <div>
            <h4 style="margin-bottom: 12px; color: var(--accent-primary);">防伪标识</h4>
            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
              <div><span style="color: var(--text-muted);">NFC芯片:</span> <span style="font-family: monospace; font-size: 11px;">${b.nfcId}</span></div>
              <div><span style="color: var(--text-muted);">二维码:</span> <span style="font-family: monospace; font-size: 11px;">${b.qrCode}</span></div>
              <div><span style="color: var(--text-muted);">数字签名:</span></div>
              <div style="font-family: monospace; font-size: 10px; color: var(--text-muted); word-break: break-all;">${b.signature.substring(0, 40)}...</div>
            </div>
          </div>
        </div>
        <div style="margin-top: 20px; display: flex; gap: 12px; justify-content: flex-end;">
          <button class="btn btn-secondary" onclick="closeModal()">关闭</button>
          <button class="btn btn-primary" onclick="viewTrace('${b.batteryId}')">查看溯源</button>
        </div>
      `);
    }
  });
}

function viewTrace(batteryId) {
  closeModal();
  switchPage('trace');
  setTimeout(() => {
    document.getElementById('trace-battery-id').value = batteryId;
    searchTrace();
  }, 200);
}

function showCreateModal() {
  showModal('新建电池档案', `
    <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap: 16px;">
      <div class="form-item">
        <label>电池厂编码</label>
        <select id="new-factory">
          <option value="CATLBJ">CATL 北京</option>
          <option value="BYDSZ">BYD 深圳</option>
          <option value="GOTSHH">国轩高科 上海</option>
          <option value="EVEHZ">亿纬锂能 惠州</option>
          <option value="SVOLT">蜂巢能源</option>
        </select>
      </div>
      <div class="form-item">
        <label>车型代码</label>
        <select id="new-model">
          <option value="MDL001">MDL001 - 乘用车</option>
          <option value="MDL002">MDL002 - SUV</option>
          <option value="MDL003">MDL003 - 商用车</option>
          <option value="MDL004">MDL004 - 物流车</option>
          <option value="MDL005">MDL005 - 专用车</option>
        </select>
      </div>
      <div class="form-item">
        <label>生产日期</label>
        <input type="date" id="new-date" value="${new Date().toISOString().split('T')[0]}">
      </div>
      <div class="form-item">
        <label>电池类型</label>
        <select id="new-type">
          <option value="三元锂">三元锂</option>
          <option value="磷酸铁锂">磷酸铁锂</option>
          <option value="锰酸锂">锰酸锂</option>
        </select>
      </div>
      <div class="form-item">
        <label>额定容量(Ah)</label>
        <input type="number" id="new-capacity" value="280">
      </div>
      <div class="form-item">
        <label>标称电压(V)</label>
        <input type="number" id="new-voltage" value="3.2" step="0.1">
      </div>
      <div class="form-item">
        <label>电芯型号</label>
        <input type="text" id="new-cellmodel" value="LFP-280">
      </div>
      <div class="form-item">
        <label>生产批次</label>
        <input type="text" id="new-batch" value="BATCH${new Date().toISOString().slice(0,7).replace(/-/g, '')}">
      </div>
      <div class="form-item full" style="grid-column: 1 / -1; margin-top: 16px;">
        <button class="btn btn-primary" onclick="createBattery()" style="width: 100%;">创建电池档案</button>
      </div>
    </div>
  `);
}

function createBattery() {
  const data = {
    factoryCode: document.getElementById('new-factory').value,
    modelCode: document.getElementById('new-model').value,
    productionDate: document.getElementById('new-date').value,
    batteryType: document.getElementById('new-type').value,
    ratedCapacity: parseFloat(document.getElementById('new-capacity').value),
    nominalVoltage: parseFloat(document.getElementById('new-voltage').value),
    cellModel: document.getElementById('new-cellmodel').value,
    batchNo: document.getElementById('new-batch').value
  };
  
  api.battery.create(data).then(result => {
    if (result && result.code === 200) {
      showToast('电池档案创建成功');
      closeModal();
      loadBatteries();
    } else {
      showToast(result?.message || '创建失败', 'error');
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
