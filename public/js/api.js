const API_BASE = '/api';

const api = {
  async request(url, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
      const response = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers
      });
      
      const data = await response.json();
      
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.reload();
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('API Error:', error);
      return { code: -1, message: '网络错误' };
    }
  },
  
  get(url, params) {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request(url + queryString, { method: 'GET' });
  },
  
  post(url, data) {
    return this.request(url, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  
  put(url, data) {
    return this.request(url, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },
  
  auth: {
    login(username, password) {
      return api.post('/auth/login', { username, password });
    },
    getUserInfo() {
      return api.get('/auth/userinfo');
    },
    logout() {
      return api.post('/auth/logout');
    }
  },
  
  battery: {
    list(params) {
      return api.get('/battery', params);
    },
    detail(id) {
      return api.get(`/battery/${id}`);
    },
    meta() {
      return api.get('/battery/meta');
    },
    create(data) {
      return api.post('/battery', data);
    },
    bindVin(id, data) {
      return api.post(`/battery/${id}/bind-vin`, data);
    },
    traceability(id) {
      return api.get(`/battery/${id}/traceability`);
    },
    exportCsv(params) {
      const token = localStorage.getItem('token');
      const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
      return `/api/battery/export/csv${queryString}${params ? '&' : '?'}token=${encodeURIComponent(token)}`;
    }
  },
  
  monitor: {
    realtime(params) {
      return api.get('/monitor/realtime', params);
    },
    history(batteryId, params) {
      return api.get(`/monitor/${batteryId}/history`, params);
    },
    latest(batteryId) {
      return api.get(`/monitor/${batteryId}/latest`);
    }
  },
  
  warning: {
    list(params) {
      return api.get('/warning', params);
    },
    stats() {
      return api.get('/warning/stats');
    },
    handle(id, data) {
      return api.post(`/warning/${id}/handle`, data);
    },
    rules() {
      return api.get('/warning/rules');
    }
  },
  
  recycle: {
    orders(params) {
      return api.get('/recycle/orders', params);
    },
    orderDetail(orderNo) {
      return api.get(`/recycle/dismantle/${orderNo}`);
    },
    createOrder(data) {
      return api.post('/recycle/dismantle-order', data);
    },
    verify(data) {
      return api.post('/recycle/verify', data);
    },
    retireAssess(batteryId) {
      return api.post('/recycle/retire-assess', { batteryId });
    },
    echelonProjects() {
      return api.get('/recycle/echelon-projects');
    },
    dismantle(data) {
      return api.post('/recycle/dismantle', data);
    },
    stats() {
      return api.get('/recycle/stats');
    }
  },
  
  carbon: {
    footprint(batteryId) {
      return api.get(`/carbon/footprint/${batteryId}`);
    },
    summary(params) {
      return api.get('/carbon/summary', params);
    },
    trend(params) {
      return api.get('/carbon/trend', params);
    },
    distribution() {
      return api.get('/carbon/distribution');
    },
    battery(batteryId) {
      return api.get(`/carbon/battery/${batteryId}`);
    },
    reports(params) {
      return api.get('/carbon/reports', params);
    },
    report(reportId) {
      return api.get(`/carbon/report/${reportId}`);
    },
    reportHtmlUrl(reportId) {
      const token = localStorage.getItem('token');
      return `/api/carbon/report/${reportId}/html?token=${encodeURIComponent(token)}`;
    },
    calculate(data) {
      return api.post('/carbon/calculate', data);
    }
  },
  
  dashboard: {
    overview() {
      return api.get('/dashboard/overview');
    },
    sohDistribution() {
      return api.get('/dashboard/soh-distribution');
    },
    typeDistribution() {
      return api.get('/dashboard/type-distribution');
    },
    regionDistribution() {
      return api.get('/dashboard/region-distribution');
    },
    factoryRanking() {
      return api.get('/dashboard/factory-ranking');
    },
    realtimeTrend(hours) {
      return api.get('/dashboard/realtime-trend', { hours });
    },
    warningTrend(days) {
      return api.get('/dashboard/warning-trend', { days });
    },
    heatmap() {
      return api.get('/dashboard/heatmap');
    }
  }
};
