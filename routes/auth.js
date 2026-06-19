const express = require('express');
const jwt = require('jsonwebtoken');
const { users } = require('../data/store');

const router = express.Router();
const JWT_SECRET = 'battery-traceability-secret-key-2024';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ code: 401, message: '未提供访问令牌' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ code: 403, message: '令牌无效或已过期' });
    }
    req.user = user;
    next();
  });
};

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
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
        tenant: user.tenant
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
module.exports.JWT_SECRET = JWT_SECRET;
