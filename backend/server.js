require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');

const authRoutes = require('./routes/auth.routes');
const centerRoutes = require('./routes/center.routes');
const appointmentRoutes = require('./routes/appointment.routes');
const { checkStocks } = require('./services/bloodAlert');
const donationRoutes = require('./routes/donation.routes');
const bloodDonationRoutes = require('./routes/bloodDonation.routes');
const campaignRoutes = require('./routes/campaign.routes');


const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/centers', centerRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/donations', bloodDonationRoutes);
app.use('/api/campaigns', campaignRoutes);





// Route de test
app.get('/api/status', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint non trouvé' });
});

// Gestion des erreurs globales
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: err.message,
    stack: err.stack
  });
});


cron.schedule('0 9-17 * * *', checkStocks);


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});