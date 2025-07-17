const express = require('express');
const { PrismaClient, AppointmentStatus } = require('@prisma/client');
const { z } = require('zod');
const authMiddleware = require('../middleware/auth');
const { sendSMS } = require('../services/sms');

const prisma = new PrismaClient();
const router = express.Router();

// Status transition rules
const ALLOWED_TRANSITIONS = {
  [AppointmentStatus.PENDING]: [AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED],
  [AppointmentStatus.CONFIRMED]: [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED],
  [AppointmentStatus.COMPLETED]: [],
  [AppointmentStatus.CANCELLED]: []
};

// Zod schemas
const createAppointmentSchema = z.object({
  donorId: z.string().uuid(),
  centerId: z.string().uuid(),
  date: z.coerce.date()
    .min(new Date(Date.now() + 2 * 60 * 60 * 1000), 
    { message: "Must schedule at least 2 hours in advance" }),
  durationMinutes: z.number().int().min(15).max(120).default(30)
});

const updateAppointmentSchema = z.object({
  date: z.coerce.date().optional(),
  status: z.nativeEnum(AppointmentStatus).optional(),
  cancellationReason: z.string().min(10).max(500).optional()
});

// Create appointment
router.post('/', authMiddleware(['DONOR', 'HEALTH_STAFF']), async (req, res) => {
  try {
    const data = createAppointmentSchema.parse({
      ...req.body,
      donorId: req.user.role === 'DONOR' ? req.user.donorId : req.body.donorId
    });

    // Check donor eligibility
    const donor = await prisma.donor.findUnique({
      where: { id: data.donorId },
      select: { canDonateFrom: true, contactPhone: true }
    });
    if (donor.canDonateFrom > data.date) {
      return res.status(400).json({
        error: "Donor not eligible",
        nextEligibleDate: donor.canDonateFrom
      });
    }

    // Check availability
    const conflictingAppointments = await prisma.appointment.count({
      where: {
        centerId: data.centerId,
        date: {
          gte: new Date(data.date.getTime() - data.durationMinutes * 60000),
          lte: new Date(data.date.getTime() + data.durationMinutes * 60000)
        },
        status: { not: 'CANCELLED' }
      }
    });

    if (conflictingAppointments > 0) {
      return res.status(409).json({ error: "Time slot unavailable" });
    }

    // Create appointment
    const appointment = await prisma.appointment.create({
      data: { ...data, status: 'PENDING' },
      include: { donor: { include: { user: true } }, center: true }
    });

    // Send notifications
    await Promise.all([
      prisma.notification.create({
        data: {
          userId: appointment.donor.user.id,
          title: "Appointment Scheduled",
          message: `Your donation is set for ${appointment.date.toLocaleString()}`,
          type: "APPOINTMENT_ALERT"
        }
      }),
      sendSMS(donor.contactPhone, 
        `Blood donation appointment confirmed for ${appointment.date.toLocaleString()}`)
    ]);

    res.status(201).json(appointment);

  } catch (error) {
    handleError(res, error);
  }
});

// Update appointment
router.patch('/:id', authMiddleware(), async (req, res) => {
  try {
    const { id } = req.params;
    const data = updateAppointmentSchema.parse(req.body);

    // Verify appointment exists
    const existing = await prisma.appointment.findUnique({ 
      where: { id },
      include: { donor: { include: { user: true } } }
    });
    if (!existing) return res.status(404).json({ error: "Appointment not found" });

    // Authorization check
    if (req.user.role === 'DONOR' && existing.donorId !== req.user.donorId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Validate status transition
    if (data.status && !ALLOWED_TRANSITIONS[existing.status].includes(data.status)) {
      return res.status(400).json({
        error: "Invalid status transition",
        allowed: ALLOWED_TRANSITIONS[existing.status]
      });
    }

    // Prepare update data
    const updateData = { ...data };
    if (data.status) {
      updateData[`${data.status.toLowerCase()}At`] = new Date();
      if (data.status === 'CANCELLED' && !data.cancellationReason) {
        return res.status(400).json({ 
          error: "Cancellation reason required" 
        });
      }
    }

    // Execute update
    const updated = await prisma.$transaction([
      prisma.appointment.update({
        where: { id },
        data: updateData
      }),
      prisma.auditLog.create({
        data: {
          action: `APPOINTMENT_${data.status || 'UPDATE'}`,
          userId: req.user.id,
          ipAddress: req.ip,
          metadata: { appointmentId: id, changes: data }
        }
      })
    ]);

    res.json(updated[0]);

  } catch (error) {
    handleError(res, error);
  }
});

// Get appointments
router.get('/', authMiddleware(), async (req, res) => {
  try {
    const where = {
      ...(req.user.role === 'DONOR' && { donorId: req.user.donorId }),
      ...(req.query.centerId && { centerId: req.query.centerId }),
      ...(req.query.status && { status: req.query.status }),
      ...(req.query.upcoming === 'true' && { date: { gte: new Date() } })
    };

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        donor: { include: { user: { select: { email: true } } } },
        center: { select: { name: true, location: true } }
      },
      orderBy: { date: 'asc' }
    });

    res.json(appointments);
  } catch (error) {
    handleError(res, error);
  }
});



// Error handler
function handleError(res, error) {
  console.error('Appointment error:', error);
  
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      error: "Validation failed",
      issues: error.issues
    });
  }

  res.status(500).json({ 
    error: "Internal server error",
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
}

module.exports = router;