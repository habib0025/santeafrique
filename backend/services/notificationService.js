// backend/services/notificationService.js
const { Server } = require('socket.io');

function setupBloodAlerts(server) {
  const io = new Server(server);
  
  prisma.$on('bloodStock:update', async (data) => {
    if (data.quantity <= data.criticalThreshold) {
      io.emit('bloodAlert', {
        center: data.centerId,
        bloodType: data.bloodType,
        quantity: data.quantity
      });
    }
  });
}