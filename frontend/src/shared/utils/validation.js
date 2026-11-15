const validateEmail = (email) => {
  if (!email) {
    return 'Email is required'
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Please enter a valid email address'
  }
  return null
}

const validatePassword = (password) => {
  if (!password) {
    return 'Password is required'
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters'
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter'
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number'
  }
  return null
}

const validatePhone = (phone) => {
  if (!phone) {
    return 'Phone number is required'
  }
  if (!/^\d{10}$/.test(phone)) {
    return 'Phone number must be 10 digits'
  }
  return null
}

const validateUsername = (username) => {
  if (!username) {
    return 'Username is required'
  }
  if (username.length < 3 || username.length > 20) {
    return 'Username must be between 3 and 20 characters'
  }
  if (!/^[a-zA-Z0-9]+$/.test(username)) {
    return 'Username can only contain letters and numbers'
  }
  return null
}

const validateSlotSelection = (startTime, endTime) => {
  if (!startTime || !endTime) {
    return 'Both start and end times are required'
  }
  if (startTime >= endTime) {
    return 'End time must be after start time'
  }
  return null
}

const validateDate = (date) => {
  if (!date) {
    return 'Date is required'
  }
  const today = new Date().toISOString().split('T')[0]
  if (date < today) {
    return 'Date cannot be in the past'
  }
  return null
}

export {
  validateEmail,
  validatePassword,
  validatePhone,
  validateUsername,
  validateSlotSelection,
  validateDate
}
