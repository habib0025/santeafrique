const { PrismaClient } = require('@prisma/client');
const request = require('supertest');
const app = require('../server');
const sms = require('../services/sms');

const prisma = new PrismaClient();
jest.mock('../services/sms'); // Mock SMS service

describe('Appointment Integration', () => {
  let testDonor;
  let testCenter;
  let staffToken;

  beforeAll(async () => {
    // Setup test data
    testCenter = await prisma.center.create({
      data: { name: "Test Center", location: "Test Location" }
    });

    testDonor = await prisma.donor.create({
      data: {
        user: { create: { email: "test@donor.com", password: "pass", role: "DONOR" } },
        contactPhone: "+221701234567",
        bloodType: "O_POSITIVE"
      },
      include: { user: true }
    });

    staffToken = generateTestToken({ role: "HEALTH_STAFF" });
  });

  afterEach(async () => {
    await prisma.appointment.deleteMany();
    jest.clearAllMocks();
  });

  test('Full appointment lifecycle', async () => {
    // 1. Check availability
    const availability = await request(app)
      .get(`/api/appointments/availability/${testCenter.id}`)
      .set('Authorization', `Bearer ${staffToken}`);
    
    const testSlot = new Date(availability.body.availableSlots[0]);

    // 2. Create appointment
    const createRes = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        donorId: testDonor.id,
        centerId: testCenter.id,
        date: testSlot
      });
    
    expect(createRes.status).toBe(201);
    expect(sms.sendSMS).toHaveBeenCalled();

    // 3. Verify appointment exists
    const getRes = await request(app)
      .get('/api/appointments')
      .set('Authorization', `Bearer ${staffToken}`);
    
    expect(getRes.body.some(a => a.id === createRes.body.id)).toBeTruthy();

    // 4. Cancel appointment
    const cancelRes = await request(app)
      .patch(`/api/appointments/${createRes.body.id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: "CANCELLED", cancellationReason: "TEST" });
    
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.status).toBe("CANCELLED");
  });
});

// Helper
function generateTestToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET);
}