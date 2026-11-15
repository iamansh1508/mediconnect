// Cloudinary service for prescription PDF uploads
// Uses the shared cloudinary client for consistent configuration

const fs = require('fs');
const cloudinary = require('../shared/cloudinary.client');

/**
 * Check if Cloudinary is configured (delegates to shared client)
 */
function isCloudinaryConfigured() {
  // The shared client already handles this check
  // We could expose a function, but for now we'll check the env directly
  // since the service needs to know early if it should operate
  return !!(
    process.env.CLOUDINARY_URL ||
    (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
  );
}

/**
 * Upload prescription PDF to Cloudinary
 * @param {string} pdfFilePath - Path to the PDF file on disk
 * @param {string} prescriptionId - Prescription ID for public_id
 * @returns {Promise<Object|null>} - { url, publicId, uploadedAt } or null on failure
 */
async function uploadPrescriptionPDF(pdfFilePath, prescriptionId) {
  // Fire-and-forget style: validate, try upload, catch and log, return null on failure
  if (!pdfFilePath || typeof pdfFilePath !== 'string') {
    console.warn('Cloudinary uploadPrescriptionPDF: invalid pdfFilePath');
    return null;
  }
  if (!prescriptionId || typeof prescriptionId !== 'string') {
    console.warn('Cloudinary uploadPrescriptionPDF: invalid prescriptionId');
    return null;
  }

  if (!isCloudinaryConfigured()) {
    console.warn('Cloudinary uploadPrescriptionPDF: Cloudinary not configured, skipping');
    return null;
  }

  // Check if file exists
  if (!fs.existsSync(pdfFilePath)) {
    console.warn('Cloudinary uploadPrescriptionPDF: file does not exist: ' + pdfFilePath);
    return null;
  }

  try {
    const publicId = 'prescription_' + prescriptionId;
    const folder = 'mediconnect/prescriptions';

    const uploadResult = await cloudinary.uploader.upload(pdfFilePath, {
      resource_type: 'raw', // For PDFs
      folder: folder,
      public_id: publicId,
      overwrite: true,
    });

    // Delete temp file after successful upload
    try {
      fs.unlinkSync(pdfFilePath);
    } catch (unlinkError) {
      console.warn('Cloudinary uploadPrescriptionPDF: failed to delete temp file:', unlinkError && unlinkError.message);
    }

    return {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      uploadedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.warn('Cloudinary uploadPrescriptionPDF failed:', error && error.message);
    
    // Try to delete temp file even on failure
    try {
      if (fs.existsSync(pdfFilePath)) {
        fs.unlinkSync(pdfFilePath);
      }
    } catch (unlinkError) {
      // Ignore
    }
    
    return null;
  }
}

module.exports = {
  uploadPrescriptionPDF,
  isCloudinaryConfigured,
};
