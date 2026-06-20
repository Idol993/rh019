let batteryPage = 1;
let batteryPageSize = 20;
let batteryTotal = 0;
let batteryPermissions = {};
let batteryMeta = null;

function loadBatteries() {
  const status = document.getElementById('filter-status').value;
  const batteryType = document.getElementById('filter-type').value;
  const keyword = document.getElementById('filter-keyword').value;
  const factoryCode = document.getElementById('filter-factory') ? document.getElementById('filter-factory').value : '';
  
  const params = {
    page: batteryPage,
    pageSize: batteryPageSize
  };
  
  if (status) params.status = status;
  if (batteryType) params.batteryType = batteryType;
  if (keyword) params.keyword = keyword;
  if (factoryCode) params.factoryCode = factoryCode;
  
  api.battery.list(params).then(result => {
    if (result && result.code === 200) {
      renderBatteryTable(result.data.list);
      batteryTotal = result.data.total;
      batteryPermissions = result.permissions || {};
      renderPagination();
      updateButtonVisibility();
    }
  });
}

function loadBatteryMeta() {
  api.battery.meta().then(result => {
    if (result && result.code === 200) {
      batteryMeta = result.data;
      populateFactoryFilter();
    }
  });
}

function populateFactoryFilter() {
  const select = document.getElementById('filter-factory');
  if (!select || !batteryMeta) return;
  
  const currentVal = select.value;
  select.innerHTML = '<option value="">全部工厂</option>';
  
  batteryMeta.factories.forEach(f => {
    const option = document.createElement('option');
    option.value = f.code;
    option.textContent = f.name;
    select.appendChild(option);
  });
  
  select.value = currentVal;
}

function updateButtonVisibility() {
  const createBtn = document.getElementById('btn-create-battery');
  if (createBtn) {
    createBtn.style.display = batteryPermissions.canCreate ? '' : 'none';
  }
  const exportBtn = document.getElementById('btn-export-battery');
  if (exportBtn) {
    exportBtn.style.display = batteryPermissions.canExport ? '' : 'none';
  }
}

function renderBatteryTable(batteries) {
  const tbody = document.getElementById('battery-table-body');
  
  tbody.innerHTML = batteries.map(b => {
    const sohColor = parseFloat(b.currentSoh) > 80 ? '#00ff88' : parseFloat(b.currentSoh) > 60 ? '#ffaa00' : '#ff4466';
    
    let actionBtns = `
      <button class="action-btn" onclick="viewBattery('${b.batteryId}')">详情</button>
      <button class="action-btn" onclick="viewTrace('${b.batteryId}')">溯源</button>
    `;
    
    if (batteryPermissions.canEdit && b.status === 'factory') {
      actionBtns += `<button class="action-btn" onclick="editBattery('${b.batteryId}')">编辑</button>`;
    }
    
    return `
    <tr>
      <td style="font-family: monospace; font-size: 11px;">${b.batteryId}</td>
      <td>${b.cellModel || '-'}</td>
      <td>${b.batteryType}</td>
      <td>${b.ratedCapacity}Ah</td>
      <td style="color: ${sohColor}">
        ${b.currentSoh}%
      </td>
      <td>${b.cycles}</td>
      <td style="font-family: monospace;">${b.vin || '-'}</td>
      <td><span class="status-badge status-${b.status}">${getStatusText(b.status)}</span></td>
      <td>${b.factoryName || b.factoryCode || '-'}</td>
      <td>
        <div class="action-btns">
          ${actionBtns}
        </div>
      </td>
    </tr>
    `;
  }).join('');
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
      const verifyStatusText = b.verifyStatus === 'verified' ? '<span style="color:#00ff88;">✓ 校验通过</span>' : '<span style="color:#ff4466;">✗ 未校验</span>';
      
      showModal('电池档案详情', `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; max-height: 70vh; overflow-y: auto; padding-right: 8px;">
          <div>
            <h4 style="margin-bottom: 12px; color: var(--accent-primary);">基本信息</h4>
            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
              <div><span style="color: var(--text-muted);">电池ID:</span> <span style="font-family: monospace;">${b.batteryId}</span></div>
              <div><span style="color: var(--text-muted);">电池类型:</span> ${b.batteryType}</div>
              <div><span style="color: var(--text-muted);">电芯型号:</span> ${b.cellModel}</div>
              <div><span style="color: var(--text-muted);">电芯配方:</span> ${b.cellFormula || '-'}</div>
              <div><span style="color: var(--text-muted);">额定容量:</span> ${b.ratedCapacity}Ah</div>
              <div><span style="color: var(--text-muted);">标称电压:</span> ${b.nominalVoltage}V</div>
              <div><span style="color: var(--text-muted);">总容量:</span> ${b.totalCapacity}kWh</div>
              <div><span style="color: var(--text-muted);">生产批次:</span> ${b.batchNo}</div>
              <div><span style="color: var(--text-muted);">出厂日期:</span> ${b.productionDate}</div>
              <div><span style="color: var(--text-muted);">出厂SOH:</span> ${b.factorySoh}%</div>
              <div><span style="color: var(--text-muted);">出厂循环:</span> ${b.factoryCycles}次</div>
              <div><span style="color: var(--text-muted);">生产工厂:</span> ${b.factoryName}</div>
              <div><span style="color: var(--text-muted);">校验状态:</span> ${verifyStatusText}</div>
            </div>
          </div>
          <div>
            <h4 style="margin-bottom: 12px; color: var(--accent-primary);">状态信息</h4>
            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
              <div><span style="color: var(--text-muted);">当前状态:</span> <span class="status-badge status-${b.status}">${getStatusText(b.status)}</span></div>
              <div><span style="color: var(--text-muted);">当前SOH:</span> <span style="color: var(--accent-success);">${b.currentSoh}%</span></div>
              <div><span style="color: var(--text-muted);">循环次数:</span> ${b.cycles}次</div>
              <div><span style="color: var(--text-muted);">当前SOC:</span> ${b.soc}%</div>
              <div><span style="color: var(--text-muted);">总电压:</span> ${b.totalVoltage}V</div>
              <div><span style="color: var(--text-muted);">总电流:</span> ${b.totalCurrent}A</div>
              <div><span style="color: var(--text-muted);">最高温度:</span> ${b.maxTemp}°C</div>
              <div><span style="color: var(--text-muted);">最低温度:</span> ${b.minTemp}°C</div>
              <div><span style="color: var(--text-muted);">绝缘电阻:</span> ${b.insulationResistance}kΩ</div>
              <div><span style="color: var(--text-muted);">电池重量:</span> ${b.packWeight || '-'}kg</div>
              <div><span style="color: var(--text-muted);">BMS版本:</span> ${b.bmsSoftwareVersion || '-'}</div>
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
            <h4 style="margin-bottom: 12px; color: var(--accent-primary);">三重防伪标识</h4>
            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
              <div><span style="color: var(--text-muted);">NFC芯片ID:</span></div>
              <div style="font-family: monospace; font-size: 11px; background: rgba(0,212,255,0.1); padding: 6px 8px; border-radius: 4px;">${b.nfcId}</div>
              <div><span style="color: var(--text-muted);">二维码:</span></div>
              <div style="font-family: monospace; font-size: 10px; word-break: break-all; background: rgba(0,255,136,0.1); padding: 6px 8px; border-radius: 4px;">${b.qrCode.substring(0, 40)}...</div>
              <div><span style="color: var(--text-muted);">数字签名:</span></div>
              <div style="font-family: monospace; font-size: 10px; word-break: break-all; color: var(--text-muted); background: rgba(255,170,0,0.1); padding: 6px 8px; border-radius: 4px;">${b.signature.substring(0, 40)}...</div>
            </div>
          </div>
          ${b.formationData ? `
          <div style="grid-column: 1 / -1;">
            <h4 style="margin-bottom: 12px; color: var(--accent-primary);">化成数据</h4>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 12px;">
              <div><span style="color: var(--text-muted);">首次充电容量:</span> ${b.formationData.firstChargeCapacity || '-'}Ah</div>
              <div><span style="color: var(--text-muted);">首次放电容量:</span> ${b.formationData.firstDischargeCapacity || '-'}Ah</div>
              <div><span style="color: var(--text-muted);">首次效率:</span> ${b.formationData.firstEfficiency || '-'}%</div>
              <div><span style="color: var(--text-muted);">化成时间:</span> ${b.formationData.formationTime || '-'}h</div>
              <div><span style="color: var(--text-muted);">化成温度:</span> ${b.formationData.formationTemp || '-'}°C</div>
              <div><span style="color: var(--text-muted);">老化时间:</span> ${b.formationData.agingTime || '-'}h</div>
              <div><span style="color: var(--text-muted);">老化后电压:</span> ${b.formationData.agingVoltage || '-'}V</div>
              <div><span style="color: var(--text-muted);">自放电率:</span> ${b.formationData.selfDischarge || '-'}%/月</div>
            </div>
          </div>
          ` : ''}
          ${b.inspectionReport ? `
          <div style="grid-column: 1 / -1;">
            <h4 style="margin-bottom: 12px; color: var(--accent-primary);">出厂检测报告</h4>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 12px;">
              <div><span style="color: var(--text-muted);">外观检测:</span> ${b.inspectionReport.appearance || '-'}</div>
              <div><span style="color: var(--text-muted);">尺寸检测:</span> ${b.inspectionReport.dimension || '-'}</div>
              <div><span style="color: var(--text-muted);">重量检测:</span> ${b.inspectionReport.weight || '-'}kg</div>
              <div><span style="color: var(--text-muted);">绝缘检测:</span> ${b.inspectionReport.insulation || '-'}</div>
              <div><span style="color: var(--text-muted);">耐压检测:</span> ${b.inspectionReport.withstandVoltage || '-'}</div>
              <div><span style="color: var(--text-muted);">容量检测:</span> ${b.inspectionReport.capacityTest || '-'}</div>
              <div><span style="color: var(--text-muted);">内阻检测:</span> ${b.inspectionReport.internalResistance || '-'}mΩ</div>
              <div><span style="color: var(--text-muted);">BMS检测:</span> ${b.inspectionReport.bmsTest || '-'}</div>
              <div><span style="color: var(--text-muted);">充放电循环:</span> ${b.inspectionReport.cycleTest || '-'}次</div>
              <div><span style="color: var(--text-muted);">高低温测试:</span> ${b.inspectionReport.tempTest || '-'}</div>
              <div><span style="color: var(--text-muted);">振动测试:</span> ${b.inspectionReport.vibrationTest || '-'}</div>
              <div><span style="color: var(--text-muted);">综合判定:</span> <span style="color:${b.inspectionReport.overallResult === '合格' ? '#00ff88' : '#ff4466'}">${b.inspectionReport.overallResult || '-'}</span></div>
            </div>
            <div style="margin-top: 8px; font-size: 12px; color: var(--text-muted);">
              检测员: ${b.inspectionReport.inspector || '-'} &nbsp;|&nbsp;
              检测日期: ${b.inspectionReport.inspectionDate || '-'} &nbsp;|&nbsp;
              报告编号: ${b.inspectionReport.reportNo || '-'}
            </div>
          </div>
          ` : ''}
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
  if (!batteryMeta) {
    loadBatteryMeta();
  }
  
  const factoryOptions = batteryMeta ? batteryMeta.factories.map(f => 
    `<option value="${f.code}">${f.name}</option>`
  ).join('') : '<option value="CATL01">宁德时代</option>';
  
  const modelOptions = batteryMeta ? batteryMeta.models.map(m => 
    `<option value="${m.code}">${m.name}</option>`
  ).join('') : '<option value="MDL001">Model S - 轿车</option>';
  
  const formulaOptions = batteryMeta ? batteryMeta.formulas.map(f => 
    `<option value="${f}">${f}</option>`
  ).join('') : '<option value="NCM811">NCM811</option>';
  
  showModal('新建电池档案', `
    <div style="max-height: 65vh; overflow-y: auto; padding-right: 8px;">
      <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap: 14px;">
        <div class="form-item">
          <label>电池厂 <span style="color: #ff4466;">*</span></label>
          <select id="new-factory">
            ${factoryOptions}
          </select>
        </div>
        <div class="form-item">
          <label>车型代码 <span style="color: #ff4466;">*</span></label>
          <select id="new-model">
            ${modelOptions}
          </select>
        </div>
        <div class="form-item">
          <label>生产日期 <span style="color: #ff4466;">*</span></label>
          <input type="date" id="new-date" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-item">
          <label>电池类型 <span style="color: #ff4466;">*</span></label>
          <select id="new-type">
            <option value="三元锂">三元锂</option>
            <option value="磷酸铁锂">磷酸铁锂</option>
            <option value="锰酸锂">锰酸锂</option>
          </select>
        </div>
        <div class="form-item">
          <label>电芯型号 <span style="color: #ff4466;">*</span></label>
          <input type="text" id="new-cellmodel" value="LFP-280" placeholder="请输入电芯型号">
        </div>
        <div class="form-item">
          <label>电芯配方</label>
          <select id="new-formula">
            ${formulaOptions}
          </select>
        </div>
        <div class="form-item">
          <label>额定容量(Ah) <span style="color: #ff4466;">*</span></label>
          <input type="number" id="new-capacity" value="280" step="0.1">
        </div>
        <div class="form-item">
          <label>标称电压(V) <span style="color: #ff4466;">*</span></label>
          <input type="number" id="new-voltage" value="3.2" step="0.01">
        </div>
        <div class="form-item">
          <label>出厂SOH(%) <span style="color: #ff4466;">*</span></label>
          <input type="number" id="new-factorysoh" value="100" step="0.1">
        </div>
        <div class="form-item">
          <label>出厂循环次数</label>
          <input type="number" id="new-factorycycles" value="3" min="0">
        </div>
        <div class="form-item">
          <label>生产批次 <span style="color: #ff4466;">*</span></label>
          <input type="text" id="new-batch" value="BATCH${new Date().toISOString().slice(0,7).replace(/-/g, '')}">
        </div>
        <div class="form-item">
          <label>电池包重量(kg)</label>
          <input type="number" id="new-weight" value="420" step="0.1">
        </div>
        <div class="form-item">
          <label>总容量(kWh)</label>
          <input type="number" id="new-totalcapacity" value="85" step="0.1">
        </div>
        <div class="form-item">
          <label>BMS软件版本</label>
          <input type="text" id="new-bmsver" value="BMS-V2.3.1">
        </div>
      </div>
      
      <div style="margin-top: 16px; border-top: 1px solid var(--border-color); padding-top: 14px;">
        <h4 style="margin-bottom: 10px; color: var(--accent-primary); font-size: 14px;">化成数据（选填）</h4>
        <div class="form-grid" style="grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px;">
          <div class="form-item">
            <label style="font-size: 12px;">首充容量(Ah)</label>
            <input type="number" id="new-fc-capacity" step="0.01" value="280.5">
          </div>
          <div class="form-item">
            <label style="font-size: 12px;">首放容量(Ah)</label>
            <input type="number" id="new-fd-capacity" step="0.01" value="278.2">
          </div>
          <div class="form-item">
            <label style="font-size: 12px;">首次效率(%)</label>
            <input type="number" id="new-f-efficiency" step="0.01" value="99.2">
          </div>
          <div class="form-item">
            <label style="font-size: 12px;">化成时间(h)</label>
            <input type="number" id="new-f-time" step="0.1" value="24">
          </div>
        </div>
      </div>
      
      <div style="margin-top: 16px; border-top: 1px solid var(--border-color); padding-top: 14px;">
        <h4 style="margin-bottom: 10px; color: var(--accent-primary); font-size: 14px;">出厂检测（选填）</h4>
        <div class="form-grid" style="grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px;">
          <div class="form-item">
            <label style="font-size: 12px;">外观检测</label>
            <select id="new-ins-appearance">
              <option value="合格">合格</option>
              <option value="不合格">不合格</option>
            </select>
          </div>
          <div class="form-item">
            <label style="font-size: 12px;">绝缘检测</label>
            <select id="new-ins-insulation">
              <option value="合格">合格</option>
              <option value="不合格">不合格</option>
            </select>
          </div>
          <div class="form-item">
            <label style="font-size: 12px;">容量检测</label>
            <select id="new-ins-capacity">
              <option value="合格">合格</option>
              <option value="不合格">不合格</option>
            </select>
          </div>
          <div class="form-item">
            <label style="font-size: 12px;">综合判定</label>
            <select id="new-ins-overall">
              <option value="合格">合格</option>
              <option value="不合格">不合格</option>
            </select>
          </div>
        </div>
      </div>
      
      <div style="margin-top: 20px; display: flex; gap: 12px; justify-content: flex-end;">
        <button class="btn btn-secondary" onclick="closeModal()">取消</button>
        <button class="btn btn-primary" onclick="createBattery()">创建档案</button>
      </div>
    </div>
  `);
}

function createBattery() {
  const formationData = {
    firstChargeCapacity: document.getElementById('new-fc-capacity').value,
    firstDischargeCapacity: document.getElementById('new-fd-capacity').value,
    firstEfficiency: document.getElementById('new-f-efficiency').value,
    formationTime: document.getElementById('new-f-time').value
  };
  
  const inspectionReport = {
    appearance: document.getElementById('new-ins-appearance').value,
    insulation: document.getElementById('new-ins-insulation').value,
    capacityTest: document.getElementById('new-ins-capacity').value,
    overallResult: document.getElementById('new-ins-overall').value,
    inspector: currentUser ? currentUser.name : '系统',
    inspectionDate: new Date().toISOString().split('T')[0],
    reportNo: 'INSP-' + Date.now()
  };
  
  const data = {
    factoryCode: document.getElementById('new-factory').value,
    modelCode: document.getElementById('new-model').value,
    productionDate: document.getElementById('new-date').value,
    batteryType: document.getElementById('new-type').value,
    ratedCapacity: parseFloat(document.getElementById('new-capacity').value),
    nominalVoltage: parseFloat(document.getElementById('new-voltage').value),
    cellModel: document.getElementById('new-cellmodel').value,
    cellFormula: document.getElementById('new-formula').value,
    factorySoh: parseFloat(document.getElementById('new-factorysoh').value),
    factoryCycles: parseInt(document.getElementById('new-factorycycles').value) || 0,
    batchNo: document.getElementById('new-batch').value,
    packWeight: parseFloat(document.getElementById('new-weight').value),
    totalCapacity: parseFloat(document.getElementById('new-totalcapacity').value),
    bmsSoftwareVersion: document.getElementById('new-bmsver').value,
    formationData,
    inspectionReport
  };
  
  api.battery.create(data).then(result => {
    if (result && result.code === 200) {
      showToast(`电池档案创建成功，ID: ${result.data.batteryId.substring(0, 16)}...`);
      closeModal();
      loadBatteries();
    } else {
      let msg = result?.message || '创建失败';
      if (result?.data?.missingFields) {
        msg += '（缺少：' + result.data.missingFields.join('、') + '）';
      }
      showToast(msg, 'error');
    }
  }).catch(err => {
    showToast('创建失败：' + err.message, 'error');
  });
}

function exportBatteries() {
  const status = document.getElementById('filter-status').value;
  const batteryType = document.getElementById('filter-type').value;
  const keyword = document.getElementById('filter-keyword').value;
  const factoryCode = document.getElementById('filter-factory') ? document.getElementById('filter-factory').value : '';
  
  let url = '/api/battery/export/csv?';
  const params = [];
  if (status) params.push('status=' + encodeURIComponent(status));
  if (batteryType) params.push('batteryType=' + encodeURIComponent(batteryType));
  if (keyword) params.push('keyword=' + encodeURIComponent(keyword));
  if (factoryCode) params.push('factoryCode=' + encodeURIComponent(factoryCode));
  
  const token = localStorage.getItem('token');
  url += params.join('&') + (params.length > 0 ? '&' : '') + 'token=' + encodeURIComponent(token);
  
  window.open(url, '_blank');
  showToast('正在导出当前筛选结果...');
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
