// Cloudinary client singleton - initialized once at module load
const { v2: cloudinary } = require('cloudinary');

let configured = false;

if (process.env.CLOUDINARY_URL || (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)) {
  try {
    if (process.env.CLOUDINARY_URL) {
      cloudinary.config({ secure: true });
    } else {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true,
      });
    }
    configured = true;
  } catch (e) {
    console.warn('Cloudinary SDK not installed or failed to load:', e && e.message);
    cloudinary = null;
    configured = false;
  }
}

function isConfigured() {
  return configured;
}

module.exports = { cloudinary, isConfigured };
