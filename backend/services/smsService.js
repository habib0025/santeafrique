const twilio = require('twilio');
require('dotenv').config(); // Important pour charger les variables

console.log('Twilio SID:', process.env.TWILIO_SID?.substring(0, 5) + '...'); // Log partiel

module.exports = {
  sendSMS: async (to, body) => {
    try {
      if (!process.env.TWILIO_SID || !process.env.TWILIO_TOKEN) {
        throw new Error('Configuration Twilio manquante');
      }

      const client = twilio(
        process.env.TWILIO_SID,
        process.env.TWILIO_TOKEN
      );
      
      const response = await client.messages.create({
        body,
        from: process.env.TWILIO_PHONE,
        to
      });
      
      console.log('SMS envoyé. SID:', response.sid);
      return response;
    } catch (error) {
      console.error('Détails erreur Twilio:', {
        message: error.message,
        config: {
          hasSid: !!process.env.TWILIO_SID,
          hasToken: !!process.env.TWILIO_TOKEN,
          phone: process.env.TWILIO_PHONE
        }
      });
      throw error;
    }
  }
};