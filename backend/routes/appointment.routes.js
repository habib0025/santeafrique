const express = require('express');
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');

const prisma = new PrismaClient();
const router = express.Router();

// Création de rendez-vous
router.post('/', auth(['DONOR']), async (req, res) => {
  const { centerId, date } = req.body;
  
  const appointment = await prisma.appointment.create({
    data: {
      donorId: req.user.userId,
      centerId,
      date: new Date(date)
    }
  });

  res.status(201).json(appointment);
});

module.exports = router;