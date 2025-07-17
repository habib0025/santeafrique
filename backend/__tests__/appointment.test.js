const request = require('supertest');
const app = require('../server');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

describe('Appointment API', () => {
  let testDonor;
  let testCenter;
  let staffToken;
  let donorToken;

  beforeAll(async () => {
    testCenter = await prisma.center.create({
      data: { name: "Test Center", location: "Test City" }
    });

    testDonor = await prisma.donor.create({
      data: {
        user: { create: { email: "donor@test.com", password: "test", role: "DONOR" } },
        bloodType: "O_POSITIVE"
      },
      include: { user: true }
    });

    staffToken = generateTestToken({ role: "HEALTH_STAFF" });
    donorToken = generateTestToken({ 
      role: "DONOR", 
      donorId: testDonor.id 
    });
  });

  it('should create appointment (staff)', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        donorId: testDonor.id,
        centerId: testCenter.id,
        date: new Date(Date.now() + 3 * 60 * 60 * 1000) // 3 hours from now
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });

  it('should reject duplicate slots', async () => {
    const time = new Date(Date.now() + 4 * 60 * 60 * 1000);
    
    await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        donorId: testDonor.id,
        centerId: testCenter.id,
        date: time
      });

    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        donorId: testDonor.id,
        centerId: testCenter.id,
        date: time
      });
      
    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('suggestedTimes');
  });
});