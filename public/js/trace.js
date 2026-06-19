function searchTrace() {
  const batteryId = document.getElementById('trace-battery-id').value.trim();
  
  if (!batteryId) {
    showToast('请输入电池ID', 'error');
    return;
  }
  
  api.battery.traceability(batteryId).then(result => {
    if (result && result.code === 200) {
      renderTraceResult(batteryId, result.data);
    } else {
      showToast('未找到该电池的溯源信息', 'error');
    }
  });
  
  api.battery.detail(batteryId).then(result => {
    if (result && result.code === 200) {
      updateTraceHeader(result.data);
    }
  });
}

function updateTraceHeader(battery) {
  document.getElementById('trace-battery-name').textContent = battery.batteryId;
  document.getElementById('trace-battery-type').textContent = 
    `${battery.batteryType} · ${battery.cellModel} · ${battery.ratedCapacity}Ah`;
  
  const statusBadge = document.getElementById('trace-status');
  statusBadge.className = `status-badge status-${battery.status}`;
  statusBadge.textContent = getStatusText(battery.status);
}

function renderTraceResult(batteryId, traceData) {
  document.getElementById('trace-empty').classList.add('hidden');
  document.getElementById('trace-result').classList.remove('hidden');
  
  const timeline = document.getElementById('trace-timeline');
  
  timeline.innerHTML = traceData.map(node => `
    <div class="trace-node ${node.status}">
      <div class="trace-node-dot"></div>
      <div class="trace-node-content">
        <div class="trace-node-stage">
          ${node.stage}
          ${node.status === 'in_progress' ? '<span style="font-size: 11px; color: var(--accent-warning); margin-left: 8px;">进行中</span>' : ''}
        </div>
        <div class="trace-node-desc">${node.description}</div>
        <div class="trace-node-meta">
          <span>📍 ${node.location}</span>
          <span>👤 ${node.operator}</span>
          <span>🕐 ${node.timestamp}</span>
          ${node.onChain ? '<span class="on-chain">🔗 已上链</span>' : '<span>⏳ 待上链</span>'}
        </div>
        ${node.data ? `
          <div style="margin-top: 8px; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 4px; font-size: 11px;">
            ${Object.entries(node.data).map(([k, v]) => `<span style="color: var(--text-muted);">${k}:</span> <span style="color: var(--text-primary);">${v}</span>`).join(' · ')}
          </div>
        ` : ''}
      </div>
    </div>
  `).join('');
  
  const blockchainInfo = document.getElementById('blockchain-info');
  const onChainNodes = traceData.filter(n => n.onChain);
  
  blockchainInfo.innerHTML = `
    <div style="margin-bottom: 10px;">
      <strong>存证节点数:</strong> ${onChainNodes.length} / ${traceData.length}
    </div>
    ${onChainNodes.map(n => `
      <div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid rgba(170, 102, 255, 0.1);">
        <div style="color: var(--accent-purple); margin-bottom: 4px;">${n.stage}</div>
        <div style="font-size: 11px;">
          <span style="color: var(--text-muted);">区块哈希:</span>
          ${n.blockHash ? n.blockHash.substring(0, 32) + '...' : '-'}
        </div>
      </div>
    `).join('')}
  `;
}

function scanQrCode() {
  showToast('扫码功能需要摄像头权限，演示模式下请手动输入电池ID');
}

function getStatusText(status) {
  const map = {
    running: '运行中',
    charging: '充电中',
    idle: '待机',
    retired: '已退役',
    echelon: '梯次利用中',
    dismantled: '已拆解',
    factory: '待装车'
  };
  return map[status] || status;
}
