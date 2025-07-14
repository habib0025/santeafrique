const express = require('express');
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');

const prisma = new PrismaClient();
const router = express.Router();

// Mise à jour des stocks (Pour staff médical)
router.put('/:centerId', auth(['HEALTH_STAFF', 'SYSTEM_ADMIN']), async (req, res) => {
  const updates = req.body; // [{bloodType: "A_POSITIVE", quantity: 5}, ...]
  
  await prisma.$transaction(
    updates.map(update => 
      prisma.bloodStock.upsert({
        where: { 
          centerId_bloodType: {
            centerId: req.params.centerId,
            bloodType: update.bloodType
          }
        },
        update: { 
          quantity: { increment: update.quantity },
          lastUpdated: new Date()
        },
        create: {
          centerId: req.params.centerId,
          bloodType: update.bloodType,
          quantity: update.quantity
        }
      })
    )
  );

  res.json({ success: true });
});

// Alertes de stock critique (Automatique)
router.get('/alerts', auth(['SYSTEM_ADMIN']), async (req, res) => {
  const criticalStocks = await prisma.bloodStock.findMany({
    where: {
      quantity: { lte: prisma.bloodStock.fields.criticalThreshold }
    },
    include: { center: true }
  });
  
  res.json(criticalStocks);
});