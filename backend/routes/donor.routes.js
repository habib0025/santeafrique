const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth');

const prisma = new PrismaClient();
const router = express.Router();

// Enregistrement donneur
router.post('/', async (req, res) => {
  const { email, password, bloodType, contactPhone } = req.body;
  
  const hashedPassword = await hashPassword(password);
  
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      role: 'DONOR',
      donor: {
        create: {
          bloodType,
          contactPhone
        }
      }
    },
    include: { donor: true }
  });

  res.status(201).json(user);
});

// Récupération profil
router.get('/me', authenticate(['DONOR']), async (req, res) => {
  const donor = await prisma.donor.findUnique({
    where: { userId: req.user.userId },
    include: { donations: true }
  });
  
  res.json(donor);
});

router.get('/compatible-donors/:bloodType', authMiddleware, async (req, res) => {
    const { bloodType } = req.params;
    const compatibleTypes = getCompatibleBloodTypes(bloodType); // Implement blood type compatibility logic
    
    const donors = await prisma.donor.findMany({
      where: { 
        bloodType: { in: compatibleTypes },
        canDonateFrom: { lte: new Date() }
      },
      include: { user: true }
    });
    
    res.json(donors);
  });

module.exports = router;