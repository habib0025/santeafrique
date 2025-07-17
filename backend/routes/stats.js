const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const authMiddleware = require('../middleware/auth');

router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const [totalDonors, totalDonations, bloodStock] = await Promise.all([
      prisma.donor.count(),
      prisma.donation.count(),
      prisma.bloodStock.groupBy({
        by: ['bloodType'],
        _sum: {
          quantity: true
        }
      })
    ]);

    const bloodStockByType = bloodStock.map(item => ({
      type: item.bloodType,
      quantity: item._sum.quantity || 0
    }));

    res.json({
      totalDonors,
      totalDonations,
      bloodStockByType,
      monthlyDonations: [] // À implémenter
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;