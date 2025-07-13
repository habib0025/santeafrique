const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET;

// Créer une session avec token JWT
const createSession = async (userId) => {
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
  
  return await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });
};

// Middleware d'authentification
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Token manquant' });

  try {
    const { userId } = jwt.verify(token, JWT_SECRET);
    const session = await prisma.session.findUnique({ where: { token } });
    
    if (!session || new Date() > session.expiresAt) {
      return res.status(401).json({ error: 'Session expirée' });
    }

    req.user = { id: userId };
    next();
  } catch (error) {
    res.status(403).json({ error: 'Token invalide' });
  }
};

module.exports = { createSession, authenticate };