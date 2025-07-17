const twilio = require('twilio');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class SMSService {
  constructor() {
    if (!process.env.TWILIO_SID || !process.env.TWILIO_TOKEN || !process.env.TWILIO_PHONE) {
      throw new Error('Configuration Twilio incomplète');
    }

    this.client = twilio(
      process.env.TWILIO_SID,
      process.env.TWILIO_TOKEN
    );
  }

  async sendSMS(to, body) {
    try {
      // 1. Journalisation initiale
      const log = await prisma.smsLog.create({
        data: {
          recipient: to,
          message: body,
          status: 'ATTEMPTED'
        }
      });

      // 2. Envoi réel
      const response = await this.client.messages.create({
        body,
        from: process.env.TWILIO_PHONE,
        to
      });

      // 3. Mise à jour du statut
      await prisma.smsLog.update({
        where: { id: log.id },
        data: {
          status: 'DELIVERED',
          externalId: response.sid,
          sentAt: new Date()
        }
      });

      console.log(`SMS envoyé à ${to} (ID: ${response.sid})`);
      return response;

    } catch (error) {
      // 4. Gestion des erreurs
      await prisma.smsLog.updateMany({
        where: { recipient: to, status: 'ATTEMPTED' },
        data: { 
          status: 'FAILED',
          error: error.message 
        }
      });

      console.error('Échec envoi SMS:', {
        to,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
      throw error;
    }
  }

  // Méthode spécialisée pour les rendez-vous
  async sendAppointmentConfirmation(to, appointmentDetails) {
    const message = `📅 Confirmation RDV\n` +
      `Centre: ${appointmentDetails.centerName}\n` +
      `Date: ${appointmentDetails.date}\n` +
      `Code: ${appointmentDetails.code}`;

    return this.sendSMS(to, message);
  }
}

// Singleton pattern
module.exports = new SMSService();