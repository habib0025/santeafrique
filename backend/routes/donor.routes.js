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

module.exports = router;