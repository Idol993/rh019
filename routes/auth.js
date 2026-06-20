const express = require('express');
const jwt = require('jsonwebtoken');
const { users } = require('../data/store');

const router = express.Router();
const JWT_SECRET = 'battery-traceability-secret-key-2024-v2';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];
  
  if (!token && req.query && req.query.token) {
    token = req.query.token;
  }
  
  if (!token) {
    return res.status(401).json({ code: 401, message: '未提供访问令牌，请先登录' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ code: 403, message: '令牌无效或已过期，请重新登录' });
    }
    
    const fullUser = users.find(u => u.id === user.id);
    if (!fullUser) {
      return res.status(403).json({ code: 403, message: '用户不存在或已被禁用' });
    }
    
    req.user = {
      id: fullUser.id,
      username: fullUser.username,
      name: fullUser.name,
      role: fullUser.role,
      tenant: fullUser.tenant,
      permissions: fullUser.permissions,
      menus: fullUser.menus
    };
    next();
  });
};

const hasPermission = (user, permission) => {
  if (!user || !user.permissions) return false;
  if (user.permissions.includes('*:*')) return true;
  if (user.permissions.includes(permission)) return true;
  
  const [module] = permission.split(':');
  if (user.permissions.includes(`${module}:*`)) return true;
  
  return false;
};

const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!hasPermission(req.user, permission)) {
      return res.status(403).json({ 
        code: 403, 
        message: `权限不足，需要 "${permission}" 权限`,
        required: permission
      });
    }
    next();
  };
};

const filterByFactory = (req, batteries) => {
  if (req.user.role === 'factory') {
    return batteries.filter(b => b.factoryCode === req.user.tenant);
  }
  return batteries;
};

const filterByRecycler = (req, orders) => {
  if (req.user.role === 'recycler') {
    return orders.filter(o => 
      (o.recyclerCode && o.recyclerCode === req.user.tenant) ||
      o.recycler === req.user.name || 
      o.recycler === req.user.tenant
    );
  }
  return orders;
};

const canAccessBattery = (req, battery) => {
  if (!battery) return false;
  if (req.user.role === 'admin' || req.user.role === 'regulator') return true;
  if (req.user.role === 'factory') return battery.factoryCode === req.user.tenant;
  if (req.user.role === 'oem') return !!battery.vin;
  if (req.user.role === 'recycler') return true;
  return false;
};

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ code: 400, message: '用户名和密码不能为空' });
  }
  
  const user = users.find(u => u.username === username && u.password === password);
  
  if (!user) {
    return res.status(401).json({ code: 401, message: '用户名或密码错误' });
  }
  
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, tenant: user.tenant },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  
  res.json({
    code: 200,
    message: '登录成功',
    data: {
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        tenant: user.tenant,
        menus: user.menus,
        permissions: user.permissions
      }
    }
  });
});

router.get('/userinfo', authenticateToken, (req, res) => {
  res.json({
    code: 200,
    data: req.user
  });
});

router.post('/logout', authenticateToken, (req, res) => {
  res.json({
    code: 200,
    message: '退出成功'
  });
});

module.exports = router;
module.exports.authenticateToken = authenticateToken;
module.exports.requirePermission = requirePermission;
module.exports.hasPermission = hasPermission;
module.exports.filterByFactory = filterByFactory;
module.exports.filterByRecycler = filterByRecycler;
module.exports.canAccessBattery = canAccessBattery;
module.exports.JWT_SECRET = JWT_SECRET;
