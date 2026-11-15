// PDF generation service using PDFKit
// Generates prescription PDFs and saves to temp file

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Generate a prescription PDF and save to temp file.
 * @param {Object} prescription - Prescription document from MongoDB
 * @param {Object} doctor - Doctor document with populated userId
 * @param {Object} patient - Patient/User document
 * @returns {Promise<string>} - Path to generated PDF file
 */
async function generatePrescriptionPDF(prescription, doctor, patient) {
  return new Promise((resolve, reject) => {
    // Create temp file path
    const tempDir = '/tmp';
    const fileName = 'prescription_' + prescription._id.toString() + '.pdf';
    const filePath = path.join(tempDir, fileName);

    // Create PDF document
    const doc = new PDFDocument({ margin: 50 });
    const writeStream = fs.createWriteStream(filePath);

    doc.pipe(writeStream);

    // Handle stream errors
    writeStream.on('error', (err) => {
      reject(new Error('PDF write stream error: ' + err.message));
    });

    writeStream.on('finish', () => {
      resolve(filePath);
    });

    // ===== HEADER =====
    doc.fontSize(24)
       .font('Helvetica-Bold')
       .text('PRESCRIPTION', { align: 'center' });
    doc.moveDown(0.5);

    // Doctor info
    const doctorName = doctor.doctorName || (doctor.userId && doctor.userId.name) || 'Unknown Doctor';
    const specialty = doctor.specialty || 'General Practice';
    const clinicName = doctor.clinicName || 'MediConnect Clinic';

    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('Dr. ' + doctorName, { align: 'center' });
    doc.fontSize(11)
       .font('Helvetica')
       .text(specialty, { align: 'center' });
    doc.text(clinicName, { align: 'center' });
    doc.moveDown(1);

    // Divider line
    doc.moveTo(50, doc.y)
       .lineTo(doc.page.width - 50, doc.y)
       .stroke();
    doc.moveDown(1);

    // ===== PATIENT INFO =====
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('Patient Information:');
    doc.moveDown(0.3);

    const patientName = patient.name || 'Unknown Patient';
    const appointmentDate = prescription.createdAt || new Date();
    const formattedDate = appointmentDate.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    doc.fontSize(11)
       .font('Helvetica')
       .text('Name: ' + patientName);
    doc.text('Date: ' + formattedDate);
    doc.moveDown(1);

    // Divider line
    doc.moveTo(50, doc.y)
       .lineTo(doc.page.width - 50, doc.y)
       .stroke();
    doc.moveDown(1);

    // ===== MEDICATIONS =====
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('Prescribed Medications:');
    doc.moveDown(0.5);

    const medicines = prescription.medicines || [];
    if (medicines.length === 0) {
      doc.fontSize(11)
         .font('Helvetica-Oblique')
         .text('No medications prescribed.');
    } else {
      for (let i = 0; i < medicines.length; i = i + 1) {
        const med = medicines[i];
        const medName = med.name || 'Unnamed medication';
        const dosage = med.dosage || '';
        const duration = med.duration || '';
        const instructions = med.instructions || '';

        // Check if we need a new page
        if (doc.y > doc.page.height - 100) {
          doc.addPage();
        }

        doc.fontSize(11)
           .font('Helvetica-Bold')
           .text((i + 1) + '. ' + medName);

        if (dosage) {
          doc.fontSize(10)
             .font('Helvetica')
             .text('   Dosage: ' + dosage);
        }
        if (duration) {
          doc.fontSize(10)
             .font('Helvetica')
             .text('   Duration: ' + duration);
        }
        if (instructions) {
          doc.fontSize(10)
             .font('Helvetica')
             .text('   Instructions: ' + instructions);
        }
        doc.moveDown(0.5);
      }
    }
    doc.moveDown(1);

    // Divider line
    doc.moveTo(50, doc.y)
       .lineTo(doc.page.width - 50, doc.y)
       .stroke();
    doc.moveDown(1);

    // ===== DOCTOR NOTES =====
    if (prescription.notes && prescription.notes.trim().length > 0) {
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text('Doctor Notes:');
      doc.moveDown(0.3);
      doc.fontSize(11)
         .font('Helvetica')
         .text(prescription.notes);
      doc.moveDown(1);

      // Divider line
      doc.moveTo(50, doc.y)
         .lineTo(doc.page.width - 50, doc.y)
         .stroke();
      doc.moveDown(1);
    }

    // ===== FOOTER =====
    doc.fontSize(9)
       .font('Helvetica-Oblique')
       .text('Electronically generated prescription', { align: 'center' });
    doc.text('MediConnect - ' + new Date().toLocaleDateString('en-IN'), { align: 'center' });

    // Finalize PDF
    doc.end();
  });
}

module.exports = {
  generatePrescriptionPDF,
};
