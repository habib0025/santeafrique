const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const smsService = require('./smsService');

async function checkStocks() {
  const criticalStocks = await prisma.bloodStock.findMany({
    where: { 
      quantity: { lte: 3 }, // Seuil critique
      lastUpdated: { gte: new Date(Date.now() - 24*60*60*1000) } // Dernières 24h
    },
    include: { center: true }
  });

  criticalStocks.forEach(stock => {
    smsService.sendAlert(
      process.env.ADMIN_PHONE,
      `Stock critique: ${stock.bloodType} à ${stock.center.name} (${stock.quantity} restants)`
    );
  });
}

module.exports = { checkStocks };