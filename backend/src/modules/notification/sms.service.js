// SMS notification service using Twilio (fire-and-forget)
// All functions return result or null — they never throw.

const { sendSms, isConfigured: isTwilioConfigured } = require('../../shared/twilio.client');

/**
 * Send a generic SMS.
 * Returns { sid, status, to, sentAt } on success, null on failure.
 */
async function sendSMS(phoneNumber, message) {
  // Fire-and-forget: validate inputs, try send, catch and log, never throw
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    console.warn('SMS sendSMS: invalid phoneNumber');
    return null;
  }
  if (!message || typeof message !== 'string') {
    console.warn('SMS sendSMS: invalid message');
    return null;
  }

  if (!isTwilioConfigured()) {
    console.warn('SMS sendSMS: Twilio not configured, skipping');
    return null;
  }

  try {
    const result = await sendSms(phoneNumber, message);
    return {
      sid: result.sid,
      status: result.status,
      to: result.to,
      sentAt: new Date().toISOString(),
    };
  } catch (error) {
    console.warn('SMS sendSMS failed:', error && error.message);
    return null;
  }
}

/**
 * Send turn alert SMS to patient when their turn is approaching.
 * Message: "Hi! It's almost your turn at [clinic] (Dr. [doctor]). Please head to the clinic. - MediConnect"
 */
async function sendTurnAlertSMS(patientPhone, doctorName, clinicName) {
  if (!patientPhone || typeof patientPhone !== 'string') {
    console.warn('SMS sendTurnAlertSMS: invalid patientPhone');
    return null;
  }
  if (!doctorName || typeof doctorName !== 'string') {
    console.warn('SMS sendTurnAlertSMS: invalid doctorName');
    return null;
  }
  if (!clinicName || typeof clinicName !== 'string') {
    console.warn('SMS sendTurnAlertSMS: invalid clinicName');
    return null;
  }

  const message = 'Hi! It\'s almost your turn at ' + clinicName + ' (Dr. ' + doctorName + '). Please head to the clinic. - MediConnect';

  return await sendSMS(patientPhone, message);
}

/**
 * Send booking confirmation SMS.
 * Message: "Your appointment with Dr. [doctor] is confirmed for [date] at [time]. - MediConnect"
 */
async function sendBookingConfirmationSMS(patientPhone, doctorName, appointmentDate, time) {
  if (!patientPhone || typeof patientPhone !== 'string') {
    console.warn('SMS sendBookingConfirmationSMS: invalid patientPhone');
    return null;
  }
  if (!doctorName || typeof doctorName !== 'string') {
    console.warn('SMS sendBookingConfirmationSMS: invalid doctorName');
    return null;
  }
  if (!appointmentDate || typeof appointmentDate !== 'string') {
    console.warn('SMS sendBookingConfirmationSMS: invalid appointmentDate');
    return null;
  }
  if (!time || typeof time !== 'string') {
    console.warn('SMS sendBookingConfirmationSMS: invalid time');
    return null;
  }

  const message = 'Your appointment with Dr. ' + doctorName + ' is confirmed for ' + appointmentDate + ' at ' + time + '. - MediConnect';

  return await sendSMS(patientPhone, message);
}

/**
 * Send cancellation SMS.
 * Message: "Your appointment with Dr. [doctor] on [date] has been cancelled. - MediConnect"
 */
async function sendCancellationSMS(patientPhone, doctorName, appointmentDate) {
  if (!patientPhone || typeof patientPhone !== 'string') {
    console.warn('SMS sendCancellationSMS: invalid patientPhone');
    return null;
  }
  if (!doctorName || typeof doctorName !== 'string') {
    console.warn('SMS sendCancellationSMS: invalid doctorName');
    return null;
  }
  if (!appointmentDate || typeof appointmentDate !== 'string') {
    console.warn('SMS sendCancellationSMS: invalid appointmentDate');
    return null;
  }

  const message = 'Your appointment with Dr. ' + doctorName + ' on ' + appointmentDate + ' has been cancelled. - MediConnect';

  return await sendSMS(patientPhone, message);
}

module.exports = {
  sendSMS,
  sendTurnAlertSMS,
  sendBookingConfirmationSMS,
  sendCancellationSMS,
};
