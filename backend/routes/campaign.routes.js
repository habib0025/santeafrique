const express = require('express');
const { PrismaClient, BloodType, CampaignStatus, NotificationType } = require('@prisma/client');
const { z } = require('zod');
const authMiddleware = require('../middleware/auth');

const prisma = new PrismaClient();
const router = express.Router();

// --- Validation Schemas ---
const createCampaignSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().optional(),
  startDate: z.coerce.date().min(new Date()),
  endDate: z.coerce.date(),
  locationId: z.number().int(),
  targetUnits: z.number().int().min(1),
  targetBloodTypes: z.array(z.nativeEnum(BloodType)).min(1),
  imageUrl: z.string().url().optional()
}).refine(data => data.endDate > data.startDate, {
  message: "End date must be after start date",
  path: ["endDate"]
});

const updateCampaignSchema = createCampaignSchema.partial();

// --- Routes ---

// 1. Create Campaign (STS_ADMIN or SYSTEM_ADMIN only)
router.post('/', 
  authMiddleware(['STS_ADMIN', 'SYSTEM_ADMIN']), 
  async (req, res) => {
    try {
      const validatedData = createCampaignSchema.parse(req.body);
      
      const campaign = await prisma.$transaction(async (tx) => {
        // Create campaign
        const newCampaign = await tx.campaign.create({
          data: {
            title: validatedData.title,
            description: validatedData.description,
            startDate: validatedData.startDate,
            endDate: validatedData.endDate,
            locationId: validatedData.locationId,
            targetUnits: validatedData.targetUnits,
            createdById: req.user.id,
            imageUrl: validatedData.imageUrl
          }
        });

        // Create target blood types
        await tx.campaignTargetBloodType.createMany({
          data: validatedData.targetBloodTypes.map(bloodType => ({
            campaignId: newCampaign.id,
            bloodType
          }))
        });

        return newCampaign;
      });

      res.status(201).json(campaign);

    } catch (error) {
      handleError(res, error);
    }
  }
);

// 2. Get All Campaigns (Public)
router.get('/', async (req, res) => {
  const { status, bloodType, upcoming } = req.query;
  
  try {
    const where = {};
    
    // Filter by status
    if (status) where.status = status;
    
    // Filter by blood type
    if (bloodType) {
      where.targetBloodTypes = {
        some: { bloodType }
      };
    }
    
    // Upcoming campaigns
    if (upcoming === 'true') {
      where.startDate = { gte: new Date() };
    }

    const campaigns = await prisma.campaign.findMany({
      where,
      include: {
        location: true,
        targetBloodTypes: true,
        createdBy: { select: { email: true } },
        _count: { select: { volunteers: true } }
      },
      orderBy: { startDate: 'asc' }
    });

    res.json(campaigns);
  } catch (error) {
    handleError(res, error);
  }
});

// 3. Get Single Campaign (Public)
router.get('/:id', async (req, res) => {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: req.params.id },
      include: {
        location: true,
        targetBloodTypes: true,
        createdBy: { select: { email: true } },
        volunteers: { 
          select: { 
            id: true,
            email: true 
          } 
        }
      }
    });

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    res.json(campaign);
  } catch (error) {
    handleError(res, error);
  }
});

// 4. Update Campaign (Admin only)
router.patch('/:id', 
  authMiddleware(['STS_ADMIN', 'SYSTEM_ADMIN']),
  async (req, res) => {
    try {
      const validatedData = updateCampaignSchema.parse(req.body);
      
      const updatedCampaign = await prisma.$transaction(async (tx) => {
        // Update campaign
        const campaign = await tx.campaign.update({
          where: { id: req.params.id },
          data: {
            title: validatedData.title,
            description: validatedData.description,
            startDate: validatedData.startDate,
            endDate: validatedData.endDate,
            locationId: validatedData.locationId,
            targetUnits: validatedData.targetUnits,
            imageUrl: validatedData.imageUrl
          }
        });

        // Update blood types if provided
        if (validatedData.targetBloodTypes) {
          await tx.campaignTargetBloodType.deleteMany({
            where: { campaignId: campaign.id }
          });
          
          await tx.campaignTargetBloodType.createMany({
            data: validatedData.targetBloodTypes.map(bloodType => ({
              campaignId: campaign.id,
              bloodType
            }))
          });
        }

        return campaign;
      });

      res.json(updatedCampaign);
    } catch (error) {
      handleError(res, error);
    }
  }
);

// 5. Delete Campaign (SYSTEM_ADMIN only)
router.delete('/:id', 
  authMiddleware(['SYSTEM_ADMIN']),
  async (req, res) => {
    try {
      await prisma.campaign.delete({
        where: { id: req.params.id }
      });
      res.status(204).end();
    } catch (error) {
      handleError(res, error);
    }
  }
);

// 6. Volunteer for Campaign (DONOR or HEALTH_STAFF)
router.post('/:id/volunteer', 
  authMiddleware(['DONOR', 'HEALTH_STAFF']),
  async (req, res) => {
    try {
      const campaign = await prisma.campaign.update({
        where: { id: req.params.id },
        data: {
          volunteers: {
            connect: { id: req.user.id }
          }
        },
        include: {
          volunteers: {
            where: { id: req.user.id }
          }
        }
      });

      // Send confirmation notification
      await prisma.notification.create({
        data: {
          userId: req.user.id,
          title: "Campaign Volunteering",
          message: `You've volunteered for "${campaign.title}"`,
          type: "CAMPAIGN_UPDATE",
          campaignId: campaign.id
        }
      });

      res.json({ success: true });
    } catch (error) {
      handleError(res, error);
    }
  }
);

// --- Helper Functions ---
function handleError(res, error) {
  console.error(error);
  
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      error: "Validation failed",
      details: error.issues
    });
  }

  if (error.code === 'P2025') {
    return res.status(404).json({ error: "Resource not found" });
  }

  res.status(500).json({ error: "Internal server error" });
}

module.exports = router;