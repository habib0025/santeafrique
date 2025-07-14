const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const auth = require('../middleware/auth');

const prisma = new PrismaClient();
const router = express.Router();

// Schéma de validation
const donationSchema = z.object({
  donorId: z.string().uuid(),
  centerId: z.string().uuid(),
  quantityML: z.number().int().min(350).max(500), // 350-500ml par don
  bloodType: z.enum([
    'A_POSITIVE',
    'A_NEGATIVE',
    'B_POSITIVE',
    'B_NEGATIVE',
    'AB_POSITIVE',
    'AB_NEGATIVE',
    'O_POSITIVE',
    'O_NEGATIVE'
  ]),
  donationDate: z.coerce.date().max(new Date()) // Pas de date future
});

// Enregistrement d'un don
router.post('/', auth(['HEALTH_STAFF', 'SYSTEM_ADMIN']), async (req, res) => {
  try {
    // 1. Validation
    const validatedData = donationSchema.parse(req.body);
    const { donorId, centerId, quantityML, bloodType } = validatedData;

    // 2. Vérification de l'éligibilité
    const donor = await prisma.donor.findUnique({
      where: { id: donorId },
      select: { canDonateFrom: true }
    });

    if (new Date() < donor.canDonateFrom) {
      return res.status(400).json({
        error: "Don non autorisé",
        nextDonationDate: donor.canDonateFrom
      });
    }

    // 3. Transaction atomique
    const result = await prisma.$transaction(async (tx) => {
      // a. Création du don
      const donation = await tx.donation.create({
        data: {
          donorId,
          centerId,
          quantityML,
          date: new Date()
        }
      });

      // b. Mise à jour du stock
      await tx.bloodStock.upsert({
        where: {
          centerId_bloodType: {
            centerId,
            bloodType
          }
        },
        create: {
          centerId,
          bloodType,
          quantity: Math.floor(quantityML / 450) // 1 unité = ~450ml
        },
        update: {
          quantity: { increment: Math.floor(quantityML / 450) },
          lastUpdated: new Date()
        }
      });

      // c. Mise à jour délai prochain don (8 semaines)
      await tx.donor.update({
        where: { id: donorId },
        data: {
          lastDonation: new Date(),
          canDonateFrom: new Date(Date.now() + 8 * 7 * 24 * 60 * 60 * 1000)
        }
      });

      return donation;
    });

    // 4. Notification
    await sendDonationConfirmation(donorId, result.id);

    res.status(201).json(result);

  } catch (error) {
    console.error('Donation error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Données invalides",
        details: error.issues
      });
    }

    res.status(500).json({ 
      error: "Erreur lors de l'enregistrement",
      debugId: req.requestId
    });
  }
});

// Récupération historique des dons
router.get('/', auth(['HEALTH_STAFF']), async (req, res) => {
  const { centerId, donorId, page = 1 } = req.query;
  
  const where = {};
  if (centerId) where.centerId = centerId;
  if (donorId) where.donorId = donorId;

  const donations = await prisma.donation.findMany({
    where,
    include: {
      donor: { select: { user: { select: { email: true } } } },
      center: { select: { name: true } }
    },
    orderBy: { date: 'desc' },
    take: 20,
    skip: (page - 1) * 20
  });

  res.json(donations);
});

// Statistiques des dons
router.get('/stats', auth(['SYSTEM_ADMIN']), async (req, res) => {
  const stats = await prisma.$queryRaw`
    SELECT 
      DATE_TRUNC('month', date) as month,
      bloodType,
      SUM(quantityML) as totalML,
      COUNT(*) as donationsCount
    FROM Donation
    JOIN Donor ON Donation.donorId = Donor.id
    GROUP BY month, bloodType
    ORDER BY month DESC
  `;

  res.json(stats);
});

// Fonction utilitaire - Envoi confirmation
async function sendDonationConfirmation(donorId, donationId) {
  const donor = await prisma.donor.findUnique({
    where: { id: donorId },
    include: { user: true }
  });

  await prisma.notification.create({
    data: {
      userId: donor.userId,
      type: 'DONATION_CONFIRMATION',
      message: `Merci pour votre don #${donationId}`,
      metadata: { donationId }
    }
  });

  // Envoi SMS (exemple avec Twilio)
  if (donor.contactPhone) {
    await sendSMS(
      donor.contactPhone,
      `Merci pour votre don. Prochain don possible le ${new Date(donor.canDonateFrom).toLocaleDateString()}`
    );
  }
}

module.exports = router;