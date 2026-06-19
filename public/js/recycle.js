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
    weight,
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
          <span style="color: var(--text-muted);">电池类型:</span>
          <span>${data.battery?.batteryType}</span>
        </div>
        <div style="font-size: 13px; margin-bottom: 8px;">
          <span style="color: var(--text-muted);">额定容量:</span>
          <span>${data.battery?.ratedCapacity}Ah</span>
        </div>
        <div style="font-size: 13px;">
          <span style="color: var(--text-muted);">当前状态:</span>
          <span class="status-badge status-${data.battery?.status}">${getStatusText(data.battery?.status)}</span>
        </div>
      </div>
      <p style="margin-top: 12px; font-size: 12px; color: var(--text-muted);">
        验证时间: ${new Date(data.verificationTime).toLocaleString('zh-CN')}
      </p>
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
