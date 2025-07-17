const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const auth = require('../middleware/auth');

const prisma = new PrismaClient();
const router = express.Router();

// Enhanced validation schema
const donationSchema = z.object({
  donorId: z.string().uuid(),
  centerId: z.string().uuid(),
  quantityML: z.number().int().min(350).max(500),
  // Remove bloodType from input - should come from donor record
  donationDate: z.coerce.date().max(new Date())
});

// Record donation with enhanced safety
router.post('/', auth(['HEALTH_STAFF', 'SYSTEM_ADMIN']), async (req, res) => {
  try {
    // 1. Validate input
    const { donorId, centerId, quantityML } = donationSchema.parse(req.body);

    // 2. Verify donor exists and get blood type
    const donor = await prisma.donor.findUnique({
      where: { id: donorId },
      select: {
        bloodType: true,
        canDonateFrom: true,
        user: { select: { id: true } },
        contactPhone: true
      }
    });

    if (!donor) {
      return res.status(404).json({ error: "Donor not found" });
    }

    // 3. Check eligibility
    if (donor.canDonateFrom > new Date()) {
      return res.status(400).json({
        error: "Donor not eligible",
        nextEligibleDate: donor.canDonateFrom
      });
    }

    // 4. Atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      // a. Create donation
      const donation = await tx.donation.create({
        data: {
          donorId,
          centerId,
          quantityML,
          bloodType: donor.bloodType, // From donor record
          date: new Date()
        }
      });

      // b. Update blood stock (1 unit = 450ml)
      const units = Math.round(quantityML / 450);
      await tx.bloodStock.upsert({
        where: {
          centerId_bloodType: {
            centerId,
            bloodType: donor.bloodType
          }
        },
        create: {
          centerId,
          bloodType: donor.bloodType,
          quantity: units,
          criticalThreshold: 3
        },
        update: {
          quantity: { increment: units },
          lastUpdated: new Date()
        }
      });

      // c. Update donor cooldown (8 weeks)
      await tx.donor.update({
        where: { id: donorId },
        data: {
          lastDonation: new Date(),
          canDonateFrom: new Date(Date.now() + 8 * 7 * 24 * 60 * 60 * 1000)
        }
      });

      return donation;
    });

    // 5. Send notifications
    await prisma.notification.create({
      data: {
        userId: donor.user.id,
        title: "Donation Recorded",
        message: `Thank you for donating ${quantityML}ml of blood!`,
        type: "DONATION_CONFIRMATION"
      }
    });

    // 6. Return success
    res.status(201).json(result);

  } catch (error) {
    console.error('Donation error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.issues
      });
    }

    res.status(500).json({ 
      error: "Internal server error",
      requestId: req.id // Assuming you have request ID middleware
    });
  }
});

// Get donations with filters
router.get('/', auth(['HEALTH_STAFF', 'SYSTEM_ADMIN']), async (req, res) => {
  const { centerId, donorId, page = 1, limit = 20 } = req.query;
  
  try {
    const where = {};
    if (centerId) where.centerId = centerId;
    if (donorId) where.donorId = donorId;

    const [donations, total] = await Promise.all([
      prisma.donation.findMany({
        where,
        include: {
          donor: {
            select: {
              user: { select: { email: true } },
              bloodType: true
            }
          },
          center: { select: { name: true, location: true } }
        },
        orderBy: { date: 'desc' },
        take: parseInt(limit),
        skip: (parseInt(page) - 1) * parseInt(limit)
      }),
      prisma.donation.count({ where })
    ]);

    res.json({
      data: donations,
      meta: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch donations" });
  }
});

module.exports = router;