const queueService = require('./queue.service');
const Appointment = require('./Appointment.model');
const { asyncHandler, AppError } = require('../../shared/utils');

/**
 * getPosition
 * GET /api/v1/queue/:appointmentId/position?date=YYYY-MM-DD
 */
const getPosition = asyncHandler(async (req, res) => {
  const appointmentId = req.params.appointmentId;
  const appointmentDate = req.query.date;

  if (!appointmentDate) {
    throw new AppError(400, 'date query parameter is required');
  }

  const position = await queueService.getQueuePosition(appointmentId, appointmentDate);

  if (position === null) {
    return res.status(404).json({
      error: {
        code: 'NOT_IN_QUEUE',
        message: 'Appointment not found in queue',
        statusCode: 404
      }
    });
  }

  return res.status(200).json({ position: position });
});

/**
 * callNext
 * POST /api/v1/queue/call-next
 */
const callNext = asyncHandler(async (req, res) => {
  const appointmentDate = req.body.date;

  if (!appointmentDate) {
    throw new AppError(400, 'date is required in request body');
  }

  const nextAppointmentId = await queueService.callNextPatient(appointmentDate);

  if (nextAppointmentId === null) {
    return res.status(200).json({ message: 'Queue is empty' });
  }

  const appointment = await Appointment.findById(nextAppointmentId).populate('patientId doctorId');

  // Emit Socket.io event 'patient_called'
  const io = req.app.get('io');
  if (io) {
    if (appointment && appointment.patientId) {
      const patientIdStr = appointment.patientId._id.toString();
      io.to('patient:' + patientIdStr).emit('patient_called', {
        appointmentId: nextAppointmentId,
        message: 'Your turn has come!'
      });
    }
    
    // Also notify the doctor room
    if (appointment && appointment.doctorId) {
      const doctorIdStr = appointment.doctorId._id.toString();
      io.to('doctor:' + doctorIdStr).emit('queue_updated', {
        event: 'patient_called',
        appointmentId: nextAppointmentId
      });
    }
  }

  return res.status(200).json({
    message: 'Patient called',
    appointmentId: nextAppointmentId,
    appointment: appointment
  });
});

/**
 * getQueueList
 * GET /api/v1/queue/list?date=YYYY-MM-DD
 */
const getQueueList = asyncHandler(async (req, res) => {
  const appointmentDate = req.query.date;

  if (!appointmentDate) {
    throw new AppError(400, 'date query parameter is required');
  }

  const allIds = await queueService.getAllInQueue(appointmentDate);
  const queue = [];

  for (let i = 0; i < allIds.length; i = i + 1) {
    const apptId = allIds[i];
    const appointment = await Appointment.findById(apptId).populate('patientId', 'name');
    
    if (appointment) {
      queue.push({
        position: i + 1,
        appointmentId: apptId,
        patientName: appointment.patientId.name,
        timeSlot: appointment.timeSlot
      });
    }
  }

  return res.status(200).json({ queue: queue });
});

module.exports = {
  getPosition,
  callNext,
  getQueueList
};
