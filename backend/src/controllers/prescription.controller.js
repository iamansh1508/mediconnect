// Prescription controller for creating and retrieving prescriptions
// Integrates PDF generation and Cloudinary upload

const mongoose = require('mongoose');
const Prescription = require('../modules/booking/Prescription.model');
const Appointment = require('../modules/booking/Appointment.model');
const Doctor = require('../modules/doctor/Doctor.model');
const User = require('../shared/User.model');
const { asyncHandler, AppError } = require('../shared/utils');
const pdfService = require('../services/pdf.service');
const cloudinaryService = require('../services/cloudinary.service');

/**
 * Create a new prescription with PDF generation and Cloudinary upload.
 * POST /api/v1/prescriptions
 * Body: { appointmentId, medications, notes }
 */
const createPrescription = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { appointmentId, medications, notes } = req.body;

  // Step 1: Validate inputs
  if (!appointmentId || !mongoose.isValidObjectId(appointmentId)) {
    throw new AppError(400, 'invalid appointmentId');
  }

  // Accept both "medications" (Phase 8 API) and "medicines" (existing schema)
  let medicinesInput = medications;
  if (!Array.isArray(medicinesInput)) {
    if (Array.isArray(req.body.medicines)) {
      medicinesInput = req.body.medicines;
    }
  }
  if (!Array.isArray(medicinesInput) || medicinesInput.length === 0) {
    throw new AppError(400, 'medications array required');
  }

  // Find the doctor profile linked to the logged-in user
  const doctor = await Doctor.findOne({ userId });
  if (!doctor) {
    throw new AppError(404, 'Doctor profile not found');
  }

  // Step 1: Verify doctor owns appointment
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    throw new AppError(404, 'Appointment not found');
  }
  if (appointment.doctorId.toString() !== doctor._id.toString()) {
    throw new AppError(403, 'Not authorized to create prescription for this appointment');
  }

  // Step 2: Create Prescription document in MongoDB
  const prescription = await Prescription.create({
    appointmentId: appointmentId,
    doctorId: doctor._id,
    patientId: appointment.patientId,
    medicines: medicinesInput,
    notes: notes || '',
  });

  // Step 3: Generate PDF (call pdf.service)
  let pdfFilePath = null;
  try {
    const patient = await User.findById(appointment.patientId);
    if (!patient) {
      console.warn('Prescription: Patient not found for PDF generation');
    } else {
      pdfFilePath = await pdfService.generatePrescriptionPDF(prescription, doctor, patient);
    }
  } catch (pdfError) {
    console.warn('Prescription: PDF generation failed:', pdfError && pdfError.message);
    pdfFilePath = null;
  }

  // Step 4: Upload to Cloudinary (call cloudinary.service)
  let pdfUrl = null;
  if (pdfFilePath) {
    try {
      const cloudinaryResult = await cloudinaryService.uploadPrescriptionPDF(pdfFilePath, prescription._id.toString());
      if (cloudinaryResult && cloudinaryResult.url) {
        pdfUrl = cloudinaryResult.url;
      }
    } catch (uploadError) {
      console.warn('Prescription: Cloudinary upload failed:', uploadError && uploadError.message);
      pdfUrl = null;
    }
  }

  // Step 5: Update prescription with cloudinaryUrl
  if (pdfUrl) {
    prescription.pdfUrl = pdfUrl;
    await prescription.save();
  }

  // Step 6: Update appointment status = 'completed'
  appointment.status = 'completed';
  appointment.prescription = prescription._id;
  await appointment.save();

  // Return 201 with prescriptionId, pdfUrl, generatedAt
  return res.status(201).json({
    prescriptionId: prescription._id,
    pdfUrl: prescription.pdfUrl || null,
    generatedAt: new Date().toISOString(),
  });
});

/**
 * Get prescription details.
 * GET /api/v1/prescriptions/:prescriptionId
 * Verify user is doctor or patient
 */
const getPrescription = asyncHandler(async (req, res) => {
  const { prescriptionId } = req.params;
  const userId = req.user._id;

  if (!mongoose.isValidObjectId(prescriptionId)) {
    throw new AppError(400, 'invalid prescriptionId');
  }

  const prescription = await Prescription.findById(prescriptionId);
  if (!prescription) {
    throw new AppError(404, 'Prescription not found');
  }

  // Verify user is doctor or patient
  const isPatient = prescription.patientId.toString() === userId.toString();

  let isDoctor = false;
  if (!isPatient) {
    const doctor = await Doctor.findOne({ userId });
    if (doctor) {
      isDoctor = prescription.doctorId.toString() === doctor._id.toString();
    }
  }

  if (!isDoctor && !isPatient) {
    throw new AppError(403, 'Not authorized to view this prescription');
  }

  // Return prescription data
  return res.json({
    prescription: {
      _id: prescription._id,
      appointmentId: prescription.appointmentId,
      doctorId: prescription.doctorId,
      patientId: prescription.patientId,
      medicines: prescription.medicines,
      notes: prescription.notes,
      pdfUrl: prescription.pdfUrl,
      createdAt: prescription.createdAt,
      updatedAt: prescription.updatedAt,
    },
  });
});

module.exports = {
  createPrescription,
  getPrescription,
};
