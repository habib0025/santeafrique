// controllers/campaignController.js
const createCampaign = async (req, res) => {
    const { title, description, startDate, endDate, locationId, targetUnits } = req.body;
    const createdById = req.user.id;
  
    // Validate dates
    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({ error: "End date must be after start date" });
    }
  
    try {
      const campaign = await prisma.campaign.create({
        data: { title, description, startDate, endDate, locationId, targetUnits, createdById }
      });
      res.status(201).json(campaign);
    } catch (error) {
      res.status(500).json({ error: "Failed to create campaign" });
    }
  };

  const getCampaigns = async (req, res) => {
    const { status, limit = 10, page = 1 } = req.query;
    const skip = (page - 1) * limit;
  
    const where = {};
    if (status) where.status = status;
  
    try {
      const [campaigns, total] = await Promise.all([
        prisma.campaign.findMany({
          where,
          skip,
          take: parseInt(limit),
          include: { location: { select: { name: true, city: true } } },
          orderBy: { startDate: 'asc' }
        }),
        prisma.campaign.count({ where })
      ]);
  
      res.json({
        data: campaigns,
        meta: { total, page: parseInt(page), limit: parseInt(limit) }
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch campaigns" });
    }
  };

  const getCampaignDetails = async (req, res) => {
    const { id } = req.params;
  
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: parseInt(id) },
        include: {
          location: true,
          donors: { select: { id: true } }
        }
      });
  
      if (!campaign) return res.status(404).json({ error: "Campaign not found" });
  
      res.json({
        ...campaign,
        donationsCount: campaign.donors.length
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch campaign details" });
    }
  };

  const updateCampaignStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
  
    if (!Object.values(CampaignStatus).includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
  
    try {
      const updatedCampaign = await prisma.campaign.update({
        where: { id: parseInt(id) },
        data: { status }
      });
      res.json(updatedCampaign);
    } catch (error) {
      res.status(500).json({ error: "Failed to update campaign status" });
    }
  };