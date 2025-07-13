const { verifyToken } = require('../lib/auth');

const authenticate = (roles = []) => (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Accès non autorisé' });
  }

  const decoded = verifyToken(token);
  
  if (!decoded || (roles.length && !roles.includes(decoded.role))) {
    return res.status(403).json({ error: 'Permissions insuffisantes' });
  }

  req.user = decoded;
  next();
};

module.exports = authenticate;