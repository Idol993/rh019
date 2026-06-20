const express = require('express');
const { warnings, batteries } = require('../data/store');
const { authenticateToken, requirePermission, hasPermission, filterByFactory } = require('./auth');

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  if (!hasPermission(req.user, 'warning:read') && !hasPermission(req.user, 'warning:read_own')) {
    return res.status(403).json({ code: 403, message: '权限不足，需要预警读取权限' });
  }
  
  const { page = 1, pageSize = 20, level, status, batteryId } = req.query;
  
  let filtered = [...warnings];
  
  const accessibleBatteries = filterByFactory(req, batteries);
  const accessibleBatteryIds = accessibleBatteries.map(b => b.batteryId);
  filtered = filtered.filter(w => accessibleBatteryIds.includes(w.batteryId));
  
  if (level) {
    filtered = filtered.filter(w => w.level === level);
  }
  if (status) {
    filtered = filtered.filter(w => w.status === status);
  }
  if (batteryId) {
    filtered = filtered.filter(w => w.batteryId === batteryId);
  }
  
  filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  const start = (page - 1) * pageSize;
  const paginated = filtered.slice(start, start + parseInt(pageSize));
  
  res.json({
    code: 200,
    data: {
      list: paginated,
      total: filtered.length,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    }
  });
});

router.get('/stats', authenticateToken, (req, res) => {
  if (!hasPermission(req.user, 'warning:read') && !hasPermission(req.user, 'warning:read_own')) {
    return res.status(403).json({ code: 403, message: '权限不足，需要预警读取权限' });
  }
  
  const accessibleBatteries = filterByFactory(req, batteries);
  const accessibleBatteryIds = accessibleBatteries.map(b => b.batteryId);
  const filteredWarnings = warnings.filter(w => accessibleBatteryIds.includes(w.batteryId));
  
  const today = new Date().toDateString();
  const todayWarnings = filteredWarnings.filter(w => new Date(w.timestamp).toDateString() === today);
  
  const stats = {
    total: filteredWarnings.length,
    today: todayWarnings.length,
    unhandled: filteredWarnings.filter(w => w.status === 'pending').length,
    level1: filteredWarnings.filter(w => w.level === 'normal').length,
    level2: filteredWarnings.filter(w => w.level === 'urgent').length,
    level3: filteredWarnings.filter(w => w.level === 'critical').length
  };
  
  res.json({
    code: 200,
    data: stats
  });
});

router.post('/:id/handle', authenticateToken, requirePermission('warning:handle'), (req, res) => {
  const { id } = req.params;
  const { result, handler } = req.body;
  
  const warning = warnings.find(w => w.id === id);
  
  if (!warning) {
    return res.status(404).json({ code: 404, message: '预警不存在' });
  }
  
  warning.status = 'handled';
  warning.handleResult = result;
  warning.handler = handler || req.user.username;
  warning.handleTime = new Date().toISOString();
  
  res.json({
    code: 200,
    message: '预警处理完成',
    data: warning
  });
});

router.get('/rules', authenticateToken, (req, res) => {
  if (!hasPermission(req.user, 'warning:read') && !hasPermission(req.user, 'warning:read_own')) {
    return res.status(403).json({ code: 403, message: '权限不足，需要预警读取权限' });
  }
  
  const rules = [
    { id: 1, name: '温度突升', condition: '温度变化率 > 3℃/min', level: 'critical', enabled: true },
    { id: 2, name: '单体压差过大', condition: '单体压差 > 0.1V', level: 'urgent', enabled: true },
    { id: 3, name: 'SOH异常下降', condition: '周降幅 > 5%', level: 'urgent', enabled: true },
    { id: 4, name: '绝缘电阻过低', condition: '绝缘电阻 < 500kΩ', level: 'critical', enabled: true },
    { id: 5, name: '充电过流', condition: '充电电流 > 额定1.5倍', level: 'urgent', enabled: true },
    { id: 6, name: '过温保护', condition: '最高温度 > 55℃', level: 'critical', enabled: true },
    { id: 7, name: '低温预警', condition: '最低温度 < -20℃', level: 'normal', enabled: true },
    { id: 8, name: 'SOC异常跳变', condition: '10分钟内SOC变化 > 20%', level: 'urgent', enabled: true }
  ];
  
  res.json({
    code: 200,
    data: rules
  });
});

module.exports = router;
