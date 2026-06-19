let currentPage = 'dashboard';
let currentUser = null;
let ws = null;

function handleLogin() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  
  if (!username || !password) {
    showToast('请输入用户名和密码', 'error');
    return;
  }
  
  api.auth.login(username, password).then(result => {
    if (result && result.code === 200) {
      const { token, user } = result.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      currentUser = user;
      
      showToast('登录成功');
      setTimeout(() => {
        initApp();
      }, 500);
    } else {
      showToast(result?.message || '登录失败', 'error');
    }
  });
}

function handleLogout() {
  api.auth.logout();
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  currentUser = null;
  
  if (ws) {
    ws.close();
    ws = null;
  }
  
  document.getElementById('login-page').classList.remove('hidden');
  document.getElementById('main-app').classList.add('hidden');
}

function initApp() {
  const userStr = localStorage.getItem('user');
  if (userStr) {
    currentUser = JSON.parse(userStr);
  }
  
  const token = localStorage.getItem('token');
  if (!token || !currentUser) {
    document.getElementById('login-page').classList.remove('hidden');
    document.getElementById('main-app').classList.add('hidden');
    return;
  }
  
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('main-app').classList.remove('hidden');
  
  document.getElementById('user-name').textContent = currentUser.username;
  document.getElementById('user-role').textContent = getRoleName(currentUser.role);
  
  updateTime();
  setInterval(updateTime, 1000);
  
  initWebSocket();
  switchPage('dashboard');
}

function getRoleName(role) {
  const roleMap = {
    admin: '管理员',
    factory: '电池厂',
    oem: '车企',
    recycler: '回收商',
    regulator: '监管'
  };
  return roleMap[role] || role;
}

function updateTime() {
  const now = new Date();
  const timeStr = now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const el = document.getElementById('time-display');
  if (el) el.textContent = timeStr;
}

function switchPage(page) {
  currentPage = page;
  
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.page === page) {
      item.classList.add('active');
    }
  });
  
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
  });
  
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) {
    pageEl.classList.add('active');
  }
  
  switch (page) {
    case 'dashboard':
      initDashboard();
      break;
    case 'battery':
      loadBatteries();
      break;
    case 'monitor':
      initMonitor();
      break;
    case 'trace':
      break;
    case 'warning':
      loadWarnings();
      break;
    case 'recycle':
      loadEchelonProjects();
      break;
    case 'carbon':
      loadCarbonSummary();
      break;
  }
}

function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}`);
  
  ws.onopen = () => {
    console.log('WebSocket connected');
  };
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    } catch (e) {
      console.error('WebSocket parse error:', e);
    }
  };
  
  ws.onclose = () => {
    console.log('WebSocket disconnected, reconnecting...');
    setTimeout(() => {
      initWebSocket();
    }, 3000);
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

function handleWebSocketMessage(data) {
  switch (data.type) {
    case 'realtime_update':
      if (currentPage === 'dashboard') {
        updateRealtimeBatteries(data.data);
      }
      if (currentPage === 'monitor') {
        updateMonitorData(data.data);
      }
      break;
    case 'warning_alert':
      updateWarningBadge();
      if (currentPage === 'warning') {
        loadWarnings();
      }
      break;
    case 'battery_update':
      break;
  }
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-message');
  
  toastMsg.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

function showModal(title, content) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = content;
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

function updateWarningBadge() {
  api.warning.stats().then(result => {
    if (result && result.code === 200) {
      const badge = document.getElementById('warning-badge');
      if (badge) {
        badge.textContent = result.data.unhandled || 0;
        badge.style.display = result.data.unhandled > 0 ? 'inline-block' : 'none';
      }
    }
  });
}

function exportData() {
  showToast('数据导出功能开发中...');
}

window.addEventListener('DOMContentLoaded', () => {
  initApp();
});
