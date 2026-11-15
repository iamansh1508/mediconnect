const PDFDocument = require('pdfkit');

// Built from the stored prescription on every download: nothing to upload, nothing to keep in sync.
function prescriptionPdf(res, appt, doctor, patient) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="prescription-${appt.date}.pdf"` });
  doc.pipe(res);

  doc.font('Helvetica-Bold').fontSize(20).text(`Dr. ${doctor.name}`);
  doc.font('Helvetica').fontSize(11).text([doctor.specialty, doctor.clinicName, doctor.address].filter(Boolean).join(' · '));
  if (doctor.nmcRegistrationNumber) doc.text(`Reg. no. ${doctor.nmcRegistrationNumber}`);
  doc.moveDown().moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown();

  doc.fontSize(11).text(`Patient: ${patient.name}`).text(`Date: ${appt.date}, ${appt.time}`).moveDown();
  doc.font('Helvetica-Bold').fontSize(16).text('Rx').moveDown(0.5);

  appt.prescription.medicines.forEach((m, i) => {
    doc.font('Helvetica-Bold').fontSize(12).text(`${i + 1}. ${m.name}`);
    doc.font('Helvetica').fontSize(11).text([m.dosage, m.duration].filter(Boolean).join(', '), { indent: 16 });
    if (m.instructions) doc.fillColor('#555').text(m.instructions, { indent: 16 }).fillColor('black');
    doc.moveDown(0.5);
  });

  if (appt.prescription.notes) doc.moveDown().font('Helvetica-Bold').text('Notes').font('Helvetica').text(appt.prescription.notes);
  doc.moveDown(2).fontSize(9).fillColor('#777').text('Issued through MediConnect. Valid without signature.', { align: 'center' });
  doc.end();
}

module.exports = { prescriptionPdf };
