// Add to middlewares/appointmentState.js
const { AppointmentStatus } = require('@prisma/client');

const STATUS_TRANSITIONS = {
  [AppointmentStatus.PENDING]: [AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED],
  [AppointmentStatus.CONFIRMED]: [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED],
  [AppointmentStatus.COMPLETED]: [],
  [AppointmentStatus.CANCELLED]: []
};

function validateStatusTransition(currentStatus, newStatus) {
  return STATUS_TRANSITIONS[currentStatus].includes(newStatus);
}

module.exports = { validateStatusTransition };