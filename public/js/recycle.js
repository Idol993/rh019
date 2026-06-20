let currentDismantleOrder = null;
let verifiedBattery = null;
let recyclePermissions = {};

function switchRecycleTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.tab === tab) {
      btn.classList.add('active');
    }
  });
  
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  
  const tabContent = document.getElementById(`tab-${tab}`);
  if (tabContent) {
    tabContent.classList.add('active');
  }
  
  if (tab === 'dismantle') {
    loadDismantleOrders();
  }
  if (tab === 'echelon') {
    loadEchelonProjects();
  }
}

function loadDismantleOrders() {
  api.recycle.orders().then(result => {
    if (result && result.code === 200) {
      renderDismantleOrders(result.data.list);
      recyclePermissions = result.permissions || {};
      updateRecycleButtons();
    }
  });
}

function updateRecycleButtons() {
  const createBtn = document.getElementById('btn-create-order');
  if (createBtn) {
    createBtn.style.display = recyclePermissions.canCreate ? '' : 'none';
  }
}

function renderDismantleOrders(orders) {
  const listEl = document.getElementById('dismantle-order-list');
  if (!listEl) return;
  
  if (!orders || orders.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">暂无拆解工单</div>';
    return;
  }
  
  listEl.innerHTML = orders.map(o => `
    <div class="order-card" onclick="selectDismantleOrder('${o.orderNo}')" style="cursor:pointer;padding:12px;border:1px solid var(--border-color);border-radius:6px;margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="font-family:monospace;font-weight:bold;">${o.orderNo}</span>
        <span class="status-badge status-${o.status}">${getOrderStatusText(o.status)}</span>
      </div>
      <div style="font-size:12px;color:var(--text-muted);">
        <div>电池ID: <span style="font-family:monospace;">${o.batteryId}</span></div>
        <div>类型: ${o.batteryType || '-'} | 回收商: ${o.recycler || '-'}</div>
        <div>创建时间: ${new Date(o.createTime).toLocaleString('zh-CN')}</div>
      </div>
    </div>
  `).join('');
}

function getOrderStatusText(status) {
  const map = {
    pending: '待处理',
    processing: '处理中',
    completed: '已完成',
    cancelled: '已取消'
  };
  return map[status] || status;
}

function selectDismantleOrder(orderNo) {
  api.recycle.orderDetail(orderNo).then(result => {
    if (result && result.code === 200) {
      currentDismantleOrder = result.data;
      renderDismantleDetail(result.data);
    }
  });
}

function renderDismantleDetail(order) {
  const detailEl = document.getElementById('dismantle-detail');
  if (!detailEl) return;
  
  const batteryId = order.batteryId;
  const isCompleted = order.status === 'completed';
  const hasData = order.dismantleData || (order.data && order.data.dismantleData);
  const data = order.dismantleData || (order.data && order.data.dismantleData);
  
  if (isCompleted && data) {
    detailEl.innerHTML = `
      <div style="background:rgba(0,212,255,0.1);padding:16px;border-radius:8px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <h3 style="margin:0;">${order.orderNo}</h3>
          <span class="status-badge status-completed">已完成</span>
        </div>
        <div style="font-size:13px;color:var(--text-muted);">
          电池ID: <span style="font-family:monospace;">${batteryId}</span>
          &nbsp;|&nbsp; 回收商: ${order.recycler || '-'}
          &nbsp;|&nbsp; 完成时间: ${order.completeTime ? new Date(order.completeTime).toLocaleString('zh-CN') : '-'}
        </div>
      </div>
      
      <h4 style="margin-bottom:12px;color:var(--accent-primary);">拆解数据</h4>
      <div class="form-grid" style="grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; font-size: 13px;">
        <div class="form-item">
          <label style="color:var(--text-muted);">毛重</label>
          <div>${data.grossWeight || '-'} kg</div>
        </div>
        <div class="form-item">
          <label style="color:var(--text-muted);">净重</label>
          <div>${data.netWeight || '-'} kg</div>
        </div>
        <div class="form-item">
          <label style="color:var(--text-muted);">锂回收率</label>
          <div style="color:var(--accent-success);">${data.lithiumRecovery || '-'}%</div>
        </div>
        <div class="form-item">
          <label style="color:var(--text-muted);">钴回收率</label>
          <div style="color:var(--accent-success);">${data.cobaltRecovery || '-'}%</div>
        </div>
        <div class="form-item">
          <label style="color:var(--text-muted);">镍回收率</label>
          <div style="color:var(--accent-success);">${data.nickelRecovery || '-'}%</div>
        </div>
        <div class="form-item">
          <label style="color:var(--text-muted);">锰回收率</label>
          <div style="color:var(--accent-success);">${data.manganeseRecovery || '-'}%</div>
        </div>
        <div class="form-item">
          <label style="color:var(--text-muted);">铜回收率</label>
          <div>${data.copperRecovery || '-'}%</div>
        </div>
        <div class="form-item">
          <label style="color:var(--text-muted);">铝回收率</label>
          <div>${data.aluminumRecovery || '-'}%</div>
        </div>
        <div class="form-item">
          <label style="color:var(--text-muted);">碳减排</label>
          <div style="color:var(--accent-success);font-weight:bold;">${data.carbonReductionKg || '-'} kgCO₂e</div>
        </div>
        <div class="form-item">
          <label style="color:var(--text-muted);">处置方式</label>
          <div>${data.disposalMethod || '-'}</div>
        </div>
        <div class="form-item">
          <label style="color:var(--text-muted);">环保凭证</label>
          <div>${data.environmentalCert || '-'}</div>
        </div>
        <div class="form-item">
          <label style="color:var(--text-muted);">拆解人员</label>
          <div>${data.dismantler || '-'}</div>
        </div>
      </div>
      
      <div style="margin-top:16px;">
        <button class="btn btn-secondary" onclick="viewBatteryTrace('${batteryId}')">查看溯源链</button>
      </div>
    `;
  } else {
    detailEl.innerHTML = `
      <div style="background:rgba(0,212,255,0.1);padding:16px;border-radius:8px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <h3 style="margin:0;">${order.orderNo}</h3>
          <span class="status-badge status-pending">待处理</span>
        </div>
        <div style="font-size:13px;color:var(--text-muted);">
          电池ID: <span style="font-family:monospace;">${batteryId}</span>
          &nbsp;|&nbsp; 电池类型: ${order.batteryType || '-'}
          &nbsp;|&nbsp; 创建时间: ${new Date(order.createTime).toLocaleString('zh-CN')}
        </div>
      </div>
      
      <h4 style="margin-bottom:12px;color:var(--accent-primary);">录入拆解数据</h4>
      <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap: 12px;">
        <div class="form-item">
          <label>毛重(kg) <span style="color:#ff4466;">*</span></label>
          <input type="number" id="dm-gross" value="${order.batteryInfo?.packWeight || 420}" step="0.1">
        </div>
        <div class="form-item">
          <label>净重(kg)</label>
          <input type="number" id="dm-net" step="0.1">
        </div>
        <div class="form-item">
          <label>锂回收率(%) <span style="color:#ff4466;">*</span></label>
          <input type="number" id="dm-lithium" value="95.2" step="0.1">
        </div>
        <div class="form-item">
          <label>钴回收率(%)</label>
          <input type="number" id="dm-cobalt" value="92.5" step="0.1">
        </div>
        <div class="form-item">
          <label>镍回收率(%)</label>
          <input type="number" id="dm-nickel" value="90.3" step="0.1">
        </div>
        <div class="form-item">
          <label>锰回收率(%)</label>
          <input type="number" id="dm-manganese" value="88.0" step="0.1">
        </div>
        <div class="form-item">
          <label>铜回收率(%)</label>
          <input type="number" id="dm-copper" value="98.5" step="0.1">
        </div>
        <div class="form-item">
          <label>铝回收率(%)</label>
          <input type="number" id="dm-aluminum" value="97.8" step="0.1">
        </div>
        <div class="form-item">
          <label>处置方式</label>
          <select id="dm-disposal">
            <option value="湿法冶金回收">湿法冶金回收</option>
            <option value="火法冶金回收">火法冶金回收</option>
            <option value="直接回收">直接回收</option>
          </select>
        </div>
        <div class="form-item">
          <label>废水处理</label>
          <select id="dm-wastewater">
            <option value="达标排放">达标排放</option>
            <option value="零排放">零排放</option>
            <option value="中水回用">中水回用</option>
          </select>
        </div>
        <div class="form-item">
          <label>环保凭证 <span style="color:#ff4466;">*</span></label>
          <input type="text" id="dm-cert" value="EP-${Date.now()}">
        </div>
        <div class="form-item">
          <label>发证单位</label>
          <input type="text" id="dm-cert-issuer" value="当地生态环境局">
        </div>
        <div class="form-item">
          <label>拆解人员</label>
          <input type="text" id="dm-dismantler" value="${currentUser?.name || ''}">
        </div>
        <div class="form-item">
          <label>危废处置</label>
          <select id="dm-residue">
            <option value="危废专业处置">危废专业处置</option>
            <option value="固化填埋">固化填埋</option>
            <option value="资源化利用">资源化利用</option>
          </select>
        </div>
        <div class="form-item full" style="grid-column: 1 / -1;">
          <label>备注</label>
          <textarea id="dm-remark" rows="2" placeholder="请输入备注信息" style="width:100%;"></textarea>
        </div>
      </div>
      
      <div style="margin-top: 16px; display: flex; gap: 12px;">
        <button class="btn btn-primary" onclick="submitDismantleRecord('${order.orderNo}', '${batteryId}')">提交拆解记录</button>
        <button class="btn btn-secondary" onclick="clearDismantleDetail()">取消</button>
      </div>
    `;
  }
}

function clearDismantleDetail() {
  const detailEl = document.getElementById('dismantle-detail');
  if (detailEl) {
    detailEl.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding-top: 60px;">请选择左侧工单查看详情或录入拆解数据</div>';
  }
  currentDismantleOrder = null;
}

function viewBatteryTrace(batteryId) {
  switchPage('trace');
  setTimeout(() => {
    document.getElementById('trace-battery-id').value = batteryId;
    searchTrace();
  }, 200);
}

function showCreateOrderModal() {
  showModal('创建拆解工单', `
    <div style="max-width: 450px;">
      <p style="margin-bottom:16px;color:var(--text-muted);font-size:13px;">输入电池ID创建拆解工单，系统将自动验证电池身份</p>
      <div class="form-item">
        <label>电池ID <span style="color:#ff4466;">*</span></label>
        <input type="text" id="new-order-battery" placeholder="请输入电池ID" style="width:100%;">
      </div>
      <div class="form-item">
        <label>工单类型</label>
        <select id="new-order-type" style="width:100%;">
          <option value="dismantle">拆解工单</option>
          <option value="echelon">梯次利用评估</option>
        </select>
      </div>
      <div style="margin-top:20px;display:flex;gap:12px;justify-content:flex-end;">
        <button class="btn btn-secondary" onclick="closeModal()">取消</button>
        <button class="btn btn-primary" onclick="createOrderSubmit()">创建工单</button>
      </div>
    </div>
  `);
}

function createOrderSubmit() {
  const batteryId = document.getElementById('new-order-battery').value.trim();
  const type = document.getElementById('new-order-type').value;
  
  if (!batteryId) {
    showToast('请输入电池ID', 'error');
    return;
  }
  
  api.recycle.createOrder({ batteryId, type }).then(result => {
    if (result && result.code === 200) {
      showToast('拆解工单创建成功：' + result.data.orderNo);
      closeModal();
      loadDismantleOrders();
    } else {
      showToast(result?.message || '创建失败', 'error');
    }
  }).catch(err => {
    showToast('创建失败：' + (err.message || '未知错误'), 'error');
  });
}

function submitDismantleRecord(orderNo, batteryId) {
  const grossWeight = document.getElementById('dm-gross').value;
  const netWeight = document.getElementById('dm-net').value;
  const lithiumRecovery = document.getElementById('dm-lithium').value;
  const cobaltRecovery = document.getElementById('dm-cobalt').value;
  const nickelRecovery = document.getElementById('dm-nickel').value;
  const manganeseRecovery = document.getElementById('dm-manganese').value;
  const copperRecovery = document.getElementById('dm-copper').value;
  const aluminumRecovery = document.getElementById('dm-aluminum').value;
  const disposalMethod = document.getElementById('dm-disposal').value;
  const wasteWaterTreatment = document.getElementById('dm-wastewater').value;
  const environmentalCert = document.getElementById('dm-cert').value;
  const certIssuer = document.getElementById('dm-cert-issuer').value;
  const dismantler = document.getElementById('dm-dismantler').value;
  const wasteResidue = document.getElementById('dm-residue').value;
  const remark = document.getElementById('dm-remark').value;
  
  if (!grossWeight || !lithiumRecovery || !environmentalCert) {
    showToast('请填写必填项：毛重、锂回收率、环保凭证编号', 'error');
    return;
  }
  
  api.recycle.dismantle({
    batteryId,
    orderNo,
    grossWeight,
    netWeight,
    lithiumRecovery,
    cobaltRecovery,
    nickelRecovery,
    manganeseRecovery,
    copperRecovery,
    aluminumRecovery,
    disposalMethod,
    wasteWaterTreatment,
    wasteResidue,
    environmentalCert,
    certIssuer,
    dismantler,
    remark
  }).then(result => {
    if (result && result.code === 200) {
      showToast('拆解记录提交成功，数据已上链存证');
      loadDismantleOrders();
      setTimeout(() => {
        selectDismantleOrder(orderNo);
      }, 300);
    } else {
      showToast(result?.message || '提交失败', 'error');
    }
  }).catch(err => {
    showToast('提交失败：' + (err.message || '未知错误'), 'error');
  });
}

function doAssess() {
  const batteryId = document.getElementById('assess-battery-id').value.trim();
  
  if (!batteryId) {
    showToast('请输入电池ID', 'error');
    return;
  }
  
  api.recycle.retireAssess(batteryId).then(result => {
    if (result && result.code === 200) {
      renderAssessResult(result.data);
    } else {
      showToast('评估失败，请检查电池ID', 'error');
    }
  });
}

function renderAssessResult(data) {
  document.getElementById('assess-result').classList.remove('hidden');
  
  const score = parseFloat(data.totalScore);
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;
  
  const scoreProgress = document.getElementById('score-progress');
  scoreProgress.style.strokeDashoffset = offset;
  scoreProgress.style.transition = 'stroke-dashoffset 1s ease-out';
  
  document.getElementById('score-value').textContent = Math.round(score);
  document.getElementById('assess-recommendation').textContent = data.recommendation;
  
  const scoreLabels = {
    soh: 'SOH评分',
    cycles: '循环次数评分',
    faultHistory: '故障历史评分',
    age: '使用年限评分',
    resistance: '内阻压差评分'
  };
  
  const breakdown = document.getElementById('score-breakdown');
  breakdown.innerHTML = Object.entries(data.scores).map(([key, value]) => `
    <div class="score-item">
      <span class="score-item-label">${scoreLabels[key] || key}</span>
      <div class="score-item-bar">
        <div class="score-item-fill" style="width: ${(parseFloat(value) / 0.4).toFixed(0)}%"></div>
      </div>
      <span class="score-item-value">${value}</span>
    </div>
  `).join('');
  
  const actionBtn = document.getElementById('assess-action-btn');
  if (actionBtn) {
    if (data.canDismantle) {
      actionBtn.style.display = '';
      actionBtn.innerHTML = '<button class="btn btn-danger" onclick="createOrderFromAssess(\'' + data.batteryId + '\')">生成拆解工单</button>';
    } else {
      actionBtn.style.display = 'none';
    }
  }
}

function createOrderFromAssess(batteryId) {
  api.recycle.createOrder({ batteryId, type: 'dismantle' }).then(result => {
    if (result && result.code === 200) {
      showToast('拆解工单创建成功：' + result.data.orderNo);
      switchRecycleTab('dismantle');
    } else {
      showToast(result?.message || '创建工单失败', 'error');
    }
  });
}

function loadEchelonProjects() {
  api.recycle.echelonProjects().then(result => {
    if (result && result.code === 200) {
      renderEchelonProjects(result.data);
    }
  });
}

function renderEchelonProjects(projects) {
  const grid = document.getElementById('echelon-grid');
  if (!grid) return;
  
  const typeLabels = {
    energy_storage: '储能电站',
    low_speed_vehicle: '低速电动车',
    base_station: '通信基站',
    home_energy: '家庭储能'
  };
  
  const statusLabels = {
    operating: { text: '运行中', class: 'status-running' },
    installing: { text: '安装中', class: 'status-charging' },
    planning: { text: '规划中', class: 'status-idle' }
  };
  
  grid.innerHTML = projects.map(p => `
    <div class="echelon-card">
      <h4>${p.name}</h4>
      <div class="echelon-info">
        <div class="echelon-info-item">
          <span>项目类型</span>
          <span>${typeLabels[p.type] || p.type}</span>
        </div>
        <div class="echelon-info-item">
          <span>装机容量</span>
          <span>${p.capacity}</span>
        </div>
        <div class="echelon-info-item">
          <span>电池数量</span>
          <span>${p.batteries} 组</span>
        </div>
        <div class="echelon-info-item">
          <span>项目状态</span>
          <span class="status-badge ${statusLabels[p.status]?.class || ''}">${statusLabels[p.status]?.text || p.status}</span>
        </div>
      </div>
    </div>
  `).join('');
}

function submitDismantle() {
  const batteryId = document.getElementById('dismantle-battery-id').value.trim();
  const weight = document.getElementById('dismantle-weight').value;
  const lithiumRecovery = document.getElementById('dismantle-lithium').value;
  const cobaltRecovery = document.getElementById('dismantle-cobalt').value;
  const nickelRecovery = document.getElementById('dismantle-nickel').value;
  const manganeseRecovery = document.getElementById('dismantle-manganese').value;
  const disposalMethod = document.getElementById('dismantle-disposal').value;
  const environmentalCert = document.getElementById('dismantle-cert').value;
  
  if (!batteryId || !weight) {
    showToast('请填写电池ID和重量', 'error');
    return;
  }
  
  api.recycle.dismantle({
    batteryId,
    grossWeight: weight,
    lithiumRecovery,
    cobaltRecovery,
    nickelRecovery,
    manganeseRecovery,
    disposalMethod,
    environmentalCert
  }).then(result => {
    if (result && result.code === 200) {
      showToast('拆解记录提交成功，数据已上链');
      document.getElementById('dismantle-battery-id').value = '';
      document.getElementById('dismantle-weight').value = '';
      document.getElementById('dismantle-lithium').value = '';
      document.getElementById('dismantle-cobalt').value = '';
      document.getElementById('dismantle-nickel').value = '';
      document.getElementById('dismantle-manganese').value = '';
      document.getElementById('dismantle-disposal').value = '';
      document.getElementById('dismantle-cert').value = '';
    } else {
      showToast(result?.message || '提交失败', 'error');
    }
  });
}

function doVerify() {
  const batteryId = document.getElementById('verify-battery-id').value.trim();
  const nfcId = document.getElementById('verify-nfc').value.trim();
  const qrCode = document.getElementById('verify-qr').value.trim();
  
  if (!batteryId) {
    showToast('请输入电池ID', 'error');
    return;
  }
  
  api.recycle.verify({ batteryId, nfcId, qrCode }).then(result => {
    if (result && result.code === 200) {
      verifiedBattery = result.data.battery;
      renderVerifyResult(result.data);
    } else {
      showToast('验证失败', 'error');
    }
  });
}

function renderVerifyResult(data) {
  const resultEl = document.getElementById('verify-result');
  resultEl.classList.remove('hidden');
  
  if (data.valid) {
    resultEl.className = 'verify-result valid';
    resultEl.innerHTML = `
      <h4>✅ 验真通过</h4>
      <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">该电池身份验证通过，为原厂正品电池</p>
      <div class="verify-info">
        <div style="font-size: 13px; margin-bottom: 8px;">
          <span style="color: var(--text-muted);">电池ID:</span>
          <span style="font-family: monospace;">${data.battery?.batteryId}</span>
        </div>
        <div style="font-size: 13px; margin-bottom: 8px;">
          <span style="color: var(--text-muted);">电芯型号:</span>
          <span>${data.battery?.cellModel || '-'}</span>
        </div>
        <div style="font-size: 13px; margin-bottom: 8px;">
          <span style="color: var(--text-muted);">电池类型:</span>
          <span>${data.battery?.batteryType}</span>
        </div>
        <div style="font-size: 13px; margin-bottom: 8px;">
          <span style="color: var(--text-muted);">额定容量:</span>
          <span>${data.battery?.ratedCapacity}Ah</span>
        </div>
        <div style="font-size: 13px; margin-bottom: 8px;">
          <span style="color: var(--text-muted);">出厂SOH:</span>
          <span>${data.battery?.factorySoh || '-'}%</span>
        </div>
        <div style="font-size: 13px;">
          <span style="color: var(--text-muted);">当前状态:</span>
          <span class="status-badge status-${data.battery?.status}">${getStatusText(data.battery?.status)}</span>
        </div>
      </div>
      <div style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed var(--border-color);">
        <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">
          验证时间: ${new Date(data.verificationTime).toLocaleString('zh-CN')}
        </p>
        ${data.canDismantle ? `
          <button class="btn btn-primary" onclick="createOrderFromVerify()" style="width:100%;">生成拆解工单</button>
        ` : data.battery?.dismantleData ? `
          <div style="padding:8px;background:rgba(255,170,0,0.1);border-radius:4px;font-size:12px;text-align:center;">
            该电池已完成拆解
          </div>
        ` : `
          <div style="padding:8px;background:rgba(255,68,102,0.1);border-radius:4px;font-size:12px;text-align:center;">
            该电池当前状态不可拆解
          </div>
        `}
      </div>
    `;
  } else {
    resultEl.className = 'verify-result invalid';
    resultEl.innerHTML = `
      <h4>❌ 验真失败</h4>
      <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">该电池身份验证未通过，请谨慎处理</p>
      <ul class="verify-reasons">
        ${(data.reasons || []).map(r => `<li>• ${r}</li>`).join('')}
      </ul>
    `;
  }
}

function createOrderFromVerify() {
  if (!verifiedBattery) {
    showToast('请先完成验真', 'error');
    return;
  }
  
  api.recycle.createOrder({ 
    batteryId: verifiedBattery.batteryId, 
    type: 'dismantle' 
  }).then(result => {
    if (result && result.code === 200) {
      showToast('拆解工单创建成功：' + result.data.orderNo);
      setTimeout(() => {
        switchRecycleTab('dismantle');
      }, 800);
    } else {
      showToast(result?.message || '创建工单失败', 'error');
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
