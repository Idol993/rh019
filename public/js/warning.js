let warningPage = 1;
let warningPageSize = 10;
let warningTotal = 0;

function loadWarnings() {
  const level = document.getElementById('warning-level').value;
  const status = document.getElementById('warning-status').value;
  
  const params = {
    page: warningPage,
    pageSize: warningPageSize
  };
  
  if (level) params.level = level;
  if (status) params.status = status;
  
  api.warning.list(params).then(result => {
    if (result && result.code === 200) {
      renderWarningList(result.data.list);
      warningTotal = result.data.total;
      renderWarningPagination();
    }
  });
  
  api.warning.stats().then(result => {
    if (result && result.code === 200) {
      updateWarningStats(result.data);
    }
  });
}

function updateWarningStats(stats) {
  document.getElementById('ws-total').textContent = stats.total || 0;
  document.getElementById('ws-normal').textContent = stats.level1 || 0;
  document.getElementById('ws-urgent').textContent = stats.level2 || 0;
  document.getElementById('ws-critical').textContent = stats.level3 || 0;
}

function renderWarningList(warnings) {
  const list = document.getElementById('warning-list');
  
  if (warnings.length === 0) {
    list.innerHTML = `
      <div style="text-align: center; padding: 60px; color: var(--text-muted);">
        <div style="font-size: 48px; margin-bottom: 16px;">✨</div>
        <p>暂无预警记录</p>
      </div>
    `;
    return;
  }
  
  const canHandleWarning = currentUser && (currentUser.role === 'admin' || currentUser.role === 'oem');
  
  list.innerHTML = warnings.map(w => `
    <div class="warning-item level-${w.level}">
      <div class="warning-icon">
        ${w.level === 'critical' ? '🚨' : w.level === 'urgent' ? '⚠️' : 'ℹ️'}
      </div>
      <div class="warning-main">
        <div class="warning-title">
          <span class="warning-level-tag level-tag-${w.level}">${getLevelText(w.level)}</span>
          ${w.name}
        </div>
        <div class="warning-desc">${w.description}</div>
        <div class="warning-meta">
          <span>电池: ${w.batteryId}</span>
          <span>当前值: ${w.value}${w.unit || ''}</span>
          <span>阈值: ${w.threshold}${w.unit || ''}</span>
          <span>时间: ${formatTime(w.timestamp)}</span>
          <span class="warning-status-tag status-tag-${w.status}">
            ${w.status === 'pending' ? '待处理' : '已处理'}
          </span>
        </div>
      </div>
      <div class="warning-action">
        ${w.status === 'pending' && canHandleWarning
          ? `<button class="btn btn-success btn-sm" onclick="handleWarning('${w.id}')">处理</button>`
          : `<button class="btn btn-secondary btn-sm" onclick="viewWarningDetail('${w.id}')">详情</button>`
        }
      </div>
    </div>
  `).join('');
}

function renderWarningPagination() {
  const totalPages = Math.ceil(warningTotal / warningPageSize);
  const pagination = document.getElementById('warning-pagination');
  
  let html = `
    <button class="page-btn" ${warningPage <= 1 ? 'disabled' : ''} onclick="goToWarningPage(${warningPage - 1})">上一页</button>
  `;
  
  const startPage = Math.max(1, warningPage - 2);
  const endPage = Math.min(totalPages, warningPage + 2);
  
  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="page-btn ${i === warningPage ? 'active' : ''}" onclick="goToWarningPage(${i})">${i}</button>`;
  }
  
  html += `
    <button class="page-btn" ${warningPage >= totalPages ? 'disabled' : ''} onclick="goToWarningPage(${warningPage + 1})">下一页</button>
    <span style="color: var(--text-muted); font-size: 12px; margin-left: 12px;">共 ${warningTotal} 条</span>
  `;
  
  pagination.innerHTML = html;
}

function goToWarningPage(page) {
  warningPage = page;
  loadWarnings();
}

function handleWarning(warningId) {
  showModal('预警处理', `
    <div style="padding: 10px 0;">
      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; font-size: 13px; color: var(--text-secondary);">处理结果</label>
        <textarea id="handle-result" rows="4" style="width: 100%; padding: 10px; background: rgba(10, 22, 40, 0.8); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); font-size: 13px; outline: none; resize: vertical;" placeholder="请输入处理结果..."></textarea>
      </div>
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button class="btn btn-secondary" onclick="closeModal()">取消</button>
        <button class="btn btn-primary" onclick="submitHandle('${warningId}')">确认处理</button>
      </div>
    </div>
  `);
}

function submitHandle(warningId) {
  const result = document.getElementById('handle-result').value;
  
  if (!result.trim()) {
    showToast('请输入处理结果', 'error');
    return;
  }
  
  api.warning.handle(warningId, { result }).then(res => {
    if (res && res.code === 200) {
      showToast('处理成功');
      closeModal();
      loadWarnings();
      updateWarningBadge();
    } else {
      showToast('处理失败', 'error');
    }
  });
}

function viewWarningDetail(warningId) {
  api.warning.list({ page: 1, pageSize: 100 }).then(result => {
    if (result && result.code === 200) {
      const warning = result.data.list.find(w => w.id === warningId);
      if (warning) {
        showModal('预警详情', `
          <div style="font-size: 13px;">
            <div style="margin-bottom: 12px;">
              <span style="color: var(--text-muted);">预警类型:</span>
              <span style="margin-left: 8px;">${warning.name}</span>
            </div>
            <div style="margin-bottom: 12px;">
              <span style="color: var(--text-muted);">预警级别:</span>
              <span class="warning-level-tag level-tag-${warning.level}" style="margin-left: 8px;">${getLevelText(warning.level)}</span>
            </div>
            <div style="margin-bottom: 12px;">
              <span style="color: var(--text-muted);">电池ID:</span>
              <span style="margin-left: 8px; font-family: monospace;">${warning.batteryId}</span>
            </div>
            <div style="margin-bottom: 12px;">
              <span style="color: var(--text-muted);">描述:</span>
              <p style="margin-top: 4px; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 4px;">${warning.description}</p>
            </div>
            <div style="margin-bottom: 12px;">
              <span style="color: var(--text-muted);">当前值:</span>
              <span style="margin-left: 8px;">${warning.value}${warning.unit || ''}</span>
            </div>
            <div style="margin-bottom: 12px;">
              <span style="color: var(--text-muted);">阈值:</span>
              <span style="margin-left: 8px;">${warning.threshold}${warning.unit || ''}</span>
            </div>
            <div style="margin-bottom: 12px;">
              <span style="color: var(--text-muted);">发生时间:</span>
              <span style="margin-left: 8px;">${formatTime(warning.timestamp)}</span>
            </div>
            <div style="margin-bottom: 12px;">
              <span style="color: var(--text-muted);">状态:</span>
              <span class="warning-status-tag status-tag-${warning.status}" style="margin-left: 8px;">${warning.status === 'pending' ? '待处理' : '已处理'}</span>
            </div>
            ${warning.handler ? `
              <div style="margin-bottom: 12px;">
                <span style="color: var(--text-muted);">处理人:</span>
                <span style="margin-left: 8px;">${warning.handler}</span>
              </div>
              <div style="margin-bottom: 12px;">
                <span style="color: var(--text-muted);">处理时间:</span>
                <span style="margin-left: 8px;">${formatTime(warning.handleTime)}</span>
              </div>
              <div>
                <span style="color: var(--text-muted);">处理结果:</span>
                <p style="margin-top: 4px; padding: 8px; background: rgba(0,255,136,0.1); border: 1px solid rgba(0,255,136,0.2); border-radius: 4px;">${warning.handleResult || '-'}</p>
              </div>
            ` : ''}
            <div style="margin-top: 16px; text-align: right;">
              <button class="btn btn-secondary" onclick="closeModal()">关闭</button>
            </div>
          </div>
        `);
      }
    }
  });
}

function getLevelText(level) {
  const map = {
    normal: '一般',
    urgent: '紧急',
    critical: '特级'
  };
  return map[level] || level;
}

function formatTime(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}
