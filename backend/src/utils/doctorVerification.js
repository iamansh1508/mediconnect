// Doctor NMC verification utility (MOCKED)
// Simulates NMC API call for registration number verification

/**
 * Verify doctor NMC registration number (MOCKED)
 * @param {string} registrationNumber - NMC registration number to verify
 * @returns {Promise<Object>} - { verified: boolean, registrationNumber?: string, verifiedAt?: string, reason?: string }
 */
async function verifyDoctorNMC(registrationNumber) {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Validate input
  if (!registrationNumber || typeof registrationNumber !== 'string') {
    return {
      verified: false,
      reason: 'Registration number is required',
    };
  }

  const trimmed = registrationNumber.trim();

  if (trimmed.length === 0) {
    return {
      verified: false,
      reason: 'Registration number cannot be empty',
    };
  }

  // Mock validation: accept numbers starting with "NMC" followed by digits
  // In production, this would call the actual NMC API
  const nmcPattern = /^NMC\d{6,}$/i;

  if (!nmcPattern.test(trimmed)) {
    return {
      verified: false,
      reason: 'Invalid NMC registration format. Expected format: NMC followed by at least 6 digits',
    };
  }

  // Mock: treat all valid format numbers as verified
  return {
    verified: true,
    registrationNumber: trimmed.toUpperCase(),
    verifiedAt: new Date().toISOString(),
  };
}

module.exports = {
  verifyDoctorNMC,
};
