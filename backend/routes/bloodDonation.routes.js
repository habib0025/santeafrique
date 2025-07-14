const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const auth = require('../middleware/auth');
const smsService = require('../services/smsService');

const prisma = new PrismaClient();
const router = express.Router();

// Schéma de validation Zod
const donationSchema = z.object({
  donorId: z.string().uuid(),
  centerId: z.string().uuid(),
  quantityML: z.number().int().min(350).max(500),
  bloodType: z.enum(['A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE']),
  testResults: z.object({
    hemoglobin: z.number().min(12.5).max(20),
    infectiousDiseases: z.boolean()
  }).optional()
});

// Enregistrement d'un don complet
router.post('/', auth(['HEALTH_STAFF']), async (req, res) => {
  try {
    // 1. Validation des données
    const data = donationSchema.parse(req.body);

    // 2. Vérification éligibilité donneur
    const donor = await prisma.donor.findUnique({
      where: { id: data.donorId },
      include: { user: true }
    });

    if (new Date() < donor.canDonateFrom) {
      return res.status(403).json({
        error: "Don non autorisé",
        nextEligibleDate: donor.canDonateFrom
      });
    }

    // 3. Transaction atomique
    const result = await prisma.$transaction(async (tx) => {
      // a. Enregistrement du don
      const donation = await tx.donation.create({
        data: {
          donorId: data.donorId,
          centerId: data.centerId,
          quantityML: data.quantityML,
          status: data.testResults ? 'COMPLETED' : 'PENDING'
        }
      });

      // b. Mise à jour stock si tests valides
      if (data.testResults?.infectiousDiseases === false) {
        await tx.bloodStock.upsert({
          where: {
            centerId_bloodType: {
              centerId: data.centerId,
              bloodType: data.bloodType
            }
          },
          create: {
            centerId: data.centerId,
            bloodType: data.bloodType,
            quantity: Math.floor(data.quantityML / 450)
          },
          update: {
            quantity: { increment: Math.floor(data.quantityML / 450) },
            lastUpdated: new Date()
          }
        });
      }

      // c. Mise à jour délai prochain don (8 semaines)
      await tx.donor.update({
        where: { id: data.donorId },
        data: {
          lastDonation: new Date(),
          canDonateFrom: new Date(Date.now() + 8 * 7 * 24 * 60 * 60 * 1000)
        }
      });

      return donation;
    });

    // 4. Notifications
    await Promise.all([
      smsService.sendSMS(
        donor.contactPhone,
        `Merci pour votre don #${result.id}. Prochain don possible le ${new Date(donor.canDonateFrom).toLocaleDateString()}`
      ),
      prisma.notification.create({
        data: {
          userId: donor.userId,
          type: 'DONATION_CONFIRMATION',
          content: {
            donationId: result.id,
            nextDonationDate: donor.canDonateFrom
          }
        }
      })
    ]);

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
      requestId: req.id
    });
  }
});

// Récupération des dons par centre
router.get('/center/:centerId', auth(['HEALTH_STAFF']), async (req, res) => {
  const { page = 1, status } = req.query;

  const donations = await prisma.donation.findMany({
    where: { 
      centerId: req.params.centerId,
      ...(status && { status }) 
    },
    include: {
      donor: {
        select: {
          user: { select: { email: true } },
          bloodType: true
        }
      }
    },
    orderBy: { date: 'desc' },
    take: 20,
    skip: (page - 1) * 20
  });

  res.json(donations);
});

// Validation des tests sanguins
router.post('/:id/validate', auth(['LAB_TECH']), async (req, res) => {
  const { testResults } = req.body;

  await prisma.$transaction([
    prisma.donation.update({
      where: { id: req.params.id },
      data: { 
        status: testResults.infectiousDiseases ? 'REJECTED' : 'COMPLETED',
        testResults 
      }
    }),
    ...(!testResults.infectiousDiseases ? [
      prisma.bloodStock.update({
        where: {
          centerId_bloodType: {
            centerId: donation.centerId,
            bloodType: donation.donor.bloodType
          }
        },
        data: { quantity: { increment: 1 } }
      })
    ] : [])
  ]);

  res.sendStatus(204);
});

module.exports = router;