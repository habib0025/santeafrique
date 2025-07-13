const express = require('express');
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');

const prisma = new PrismaClient();
const router = express.Router();

// GET /api/centers - Liste tous les centres
router.get('/', async (req, res) => {
  const centers = await prisma.center.findMany({
    include: { bloodStock: true }
  });
  res.json(centers);
});

// POST /api/centers - Création (Admin seulement)
router.post('/', auth(['SYSTEM_ADMIN']), async (req, res) => {
  const { name, location, geoLocation } = req.body;
  
  const center = await prisma.center.create({
    data: { name, location, geoLocation }
  });

  res.status(201).json(center);
});

module.exports = router;