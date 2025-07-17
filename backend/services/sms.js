const twilio = require('twilio');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class SMSService {
  constructor() {
    this.client = twilio(
      process.env.TWILIO_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }

  async sendSMS(to, message) {
    try {
      // Save to database first
      await prisma.smsLog.create({
        data: {
          recipient: to,
          message,
          status: 'ATTEMPTED'
        }
      });

      // Send via Twilio
      const result = await this.client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to
      });

      // Update log
      await prisma.smsLog.updateMany({
        where: { recipient: to, status: 'ATTEMPTED' },
        data: { 
          status: 'DELIVERED',
          externalId: result.sid,
          sentAt: new Date() 
        }
      });

      return true;
    } catch (error) {
      await prisma.smsLog.updateMany({
        where: { recipient: to, status: 'ATTEMPTED' },
        data: { 
          status: 'FAILED',
          error: error.message 
        }
      });
      throw error;
    }
  }

  // Appointment-specific messages
  async sendAppointmentConfirmation(donorId, appointment) {
    const donor = await prisma.donor.findUnique({
      where: { id: donorId },
      include: { user: true }
    });

    const message = `📅 Rendez-vous confirmé\n` +
      `Centre: ${appointment.center.name}\n` +
      `Date: ${appointment.date.toLocaleString('fr-FR')}\n` +
      `Code: APPT-${appointment.id.slice(0, 8)}`;

    return this.sendSMS(donor.contactPhone, message);
  }
}

module.exports = new SMSService();