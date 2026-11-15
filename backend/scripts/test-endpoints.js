#!/usr/bin/env node
/**
 * Smoke-test all API endpoints. Run with server on PORT (default 5001).
 */
const BASE = `http://localhost:${process.env.PORT || 5001}/api/v1`;

const results = [];

async function req(method, path, { body, token, expect } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  let status, data, error;
  try {
    const res = await fetch(`${BASE}${path}`, opts);
    status = res.status;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  } catch (e) {
    error = e.message;
    status = 0;
  }

  const expected = Array.isArray(expect) ? expect : [expect];
  const ok = error ? false : expected.includes(status);
  results.push({ method, path, status, ok, error, expect: expected.join('|'), message: data?.message || '' });
  return { status, data, ok, error };
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

async function main() {
  const ts = Date.now();
  const patientEmail = `patient${ts}@test.com`;
  const doctorEmail = `doctor${ts}@test.com`;
  const adminEmail = `admin${ts}@test.com`;
  const password = 'Password123!';

  // --- AUTH: Public ---
  section('Auth (public)');

  await req('POST', '/auth/register', {
    body: { name: 'Test Patient', email: patientEmail, username: `patient${ts}`, password, role: 'patient' },
    expect: 201,
  });

  await req('POST', '/auth/register', {
    body: { name: 'Test Doctor', email: doctorEmail, username: `doctor${ts}`, password, role: 'doctor' },
    expect: 201,
  });

  await req('POST', '/auth/register', {
    body: { name: 'Test Admin', email: adminEmail, username: `admin${ts}`, password, role: 'admin' },
    expect: 201,
  });

  await req('POST', '/auth/register', {
    body: { email: patientEmail, username: `dup${ts}`, password },
    expect: 409,
  });

  await req('POST', '/auth/login', { body: {}, expect: 400 });
  await req('POST', '/auth/login', { body: { email: 'wrong@test.com', password }, expect: 401 });

  const patientLogin = await req('POST', '/auth/login', {
    body: { email: patientEmail, password },
    expect: 200,
  });
  const patientToken = patientLogin.data?.accessToken;

  const doctorLogin = await req('POST', '/auth/login', {
    body: { email: doctorEmail, password },
    expect: 200,
  });
  const doctorToken = doctorLogin.data?.accessToken;

  const adminLogin = await req('POST', '/auth/login', {
    body: { email: adminEmail, password },
    expect: 200,
  });
  const adminToken = adminLogin.data?.accessToken;

  const refreshRes = await req('POST', '/auth/refresh-token', {
    body: { refreshToken: patientLogin.data?.refreshToken },
    expect: 200,
  });

  await req('POST', '/auth/refresh', {
    body: { refreshToken: patientLogin.data?.refreshToken },
    expect: 200,
  });

  await req('POST', '/auth/forgot-password', { body: { email: patientEmail }, expect: 200 });

  await req('POST', '/auth/send-otp', { body: { email: patientEmail }, expect: 200 });
  const otpRes = await req('POST', '/auth/send-otp', { body: { email: `otp${ts}@test.com` }, expect: 200 });
  const otp = otpRes.data?.otp;
  if (otp) {
    await req('POST', '/auth/verify-otp', {
      body: { email: `otp${ts}@test.com`, otp },
      expect: 200,
    });
  } else {
    results.push({ method: 'POST', path: '/auth/verify-otp', status: '-', ok: false, expect: '200', message: 'No OTP returned in response' });
  }

  await req('GET', '/auth/verify-email/invalidtoken', { expect: [400, 404] });

  // --- AUTH: Protected ---
  section('Auth (protected)');

  await req('GET', '/auth/me', { expect: 401 });
  const meRes = await req('GET', '/auth/me', { token: patientToken, expect: 200 });

  await req('POST', '/auth/change-password', {
    token: patientToken,
    body: { oldPassword: password, newPassword: 'NewPassword123!' },
    expect: 200,
  });

  const newLogin = await req('POST', '/auth/login', {
    body: { email: patientEmail, password: 'NewPassword123!' },
    expect: 200,
  });
  const patientToken2 = newLogin.data?.accessToken;

  await req('POST', '/auth/resend-verification', { token: patientToken2, expect: [200, 500] });

  // --- DOCTORS ---
  section('Doctors');

  await req('GET', '/doctors', { expect: 401 });
  const doctorsList = await req('GET', '/doctors', { token: patientToken2, expect: 200 });

  await req('GET', '/doctors/nearby?lat=12.9716&lng=77.5946&radius=5000', { token: patientToken2, expect: 200 });

  // Doctor profile setup
  const profileRes = await req('GET', '/doctors/profile', { token: doctorToken, expect: 200 });
  const doctorId = profileRes.data?._id || profileRes.data?.doctor?._id;

  await req('PUT', '/doctors/profile', {
    token: doctorToken,
    body: { specialty: 'Cardiology', consultationFee: 500, nmcRegistrationNumber: 'NMC12345' },
    expect: 200,
  });

  await req('POST', '/doctors/verify-registration', {
    token: doctorToken,
    body: { nmcNumber: 'NMC12345' },
    expect: [200, 201],
  });

  await req('PUT', '/doctors/availability', {
    token: doctorToken,
    body: { availableSlots: [{ date: '2026-08-10', slots: ['10:00', '11:00'] }] },
    expect: 200,
  });

  if (doctorId) {
    await req('GET', `/doctors/${doctorId}`, { token: patientToken2, expect: 200 });
  }

  // Route ordering bug test: /doctors/me should not be treated as :id
  const meDoctor = await req('GET', '/doctors/me', { token: doctorToken, expect: 200 });
  const routeBugMe = meDoctor.status === 200 && meDoctor.data?._id;
  results.push({
    method: 'GET',
    path: '/doctors/me (route order check)',
    status: meDoctor.status,
    ok: routeBugMe,
    expect: '200 with profile',
    message: routeBugMe ? 'OK' : 'May be captured by /:id route',
  });

  await req('GET', '/doctors/appointments/today', { token: doctorToken, expect: 200 });
  await req('GET', '/doctors/patients', { token: doctorToken, expect: 200 });

  // --- APPOINTMENTS ---
  section('Appointments');

  let appointmentId;
  if (doctorId) {
    const bookRes = await req('POST', '/appointments/book', {
      token: patientToken2,
      body: { doctorId, date: '2026-08-10', timeSlot: '10:00' },
      expect: [200, 201],
    });
    appointmentId = bookRes.data?._id || bookRes.data?.appointment?._id;
  }

  await req('GET', '/appointments/my', { token: patientToken2, expect: 200 });

  if (appointmentId) {
    await req('GET', `/appointments/${appointmentId}/queue`, { token: patientToken2, expect: 200 });
    await req('PUT', `/doctors/appointments/${appointmentId}/call-next`, { token: doctorToken, expect: [200, 201] });

    const prescRes = await req('POST', '/doctors/prescriptions', {
      token: doctorToken,
      body: { appointmentId, medicines: [{ name: 'Paracetamol', dosage: '500mg' }], notes: 'Rest well' },
      expect: [200, 201],
    });
    const prescId = prescRes.data?._id || prescRes.data?.prescription?._id;

    if (prescId) {
      await req('GET', `/appointments/prescriptions/${prescId}/download`, {
        token: patientToken2,
        expect: [200, 501],
      });
    }

    if (doctorId) {
      await req('POST', `/appointments/reviews/${doctorId}`, {
        token: patientToken2,
        body: { rating: 5, comment: 'Great doctor', appointmentId },
        expect: [200, 201],
      });
    }

    await req('DELETE', `/appointments/${appointmentId}`, { token: patientToken2, expect: [200, 204] });
  }

  // --- PAYMENTS (expected 501) ---
  section('Payments (501 expected)');

  await req('POST', '/payments/create-order', { token: patientToken2, body: {}, expect: 501 });
  await req('POST', '/payments/verify', { token: patientToken2, body: {}, expect: 501 });
  await req('POST', '/payments/webhook', { body: {}, expect: 501 });
  await req('POST', '/payments/refund/fakeid', { token: patientToken2, body: {}, expect: 501 });

  // --- ADMIN ---
  section('Admin');

  await req('GET', '/admin', { token: patientToken2, expect: 403 });
  await req('GET', '/admin', { token: adminToken, expect: 200 });
  await req('GET', '/admin/doctors/pending', { token: adminToken, expect: 200 });
  await req('GET', '/admin/analytics', { token: adminToken, expect: 200 });
  await req('GET', '/admin/users', { token: adminToken, expect: 200 });

  if (doctorId) {
    await req('PUT', `/admin/doctors/${doctorId}/approve`, { token: adminToken, expect: [200, 201] });
  }

  const usersRes = await req('GET', '/admin/users', { token: adminToken, expect: 200 });
  const targetUser = usersRes.data?.users?.[0] || usersRes.data?.[0];
  const targetUserId = targetUser?._id;
  if (targetUserId) {
    await req('PUT', `/admin/users/${targetUserId}/ban`, { token: adminToken, expect: [200, 201] });
    await req('PUT', `/admin/users/${targetUserId}/unban`, { token: adminToken, expect: [200, 201] });
  }

  // Logout last
  await req('POST', '/auth/logout', { token: patientToken2, expect: 200 });

  // --- SUMMARY ---
  console.log('\n=== RESULTS SUMMARY ===\n');
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  for (const r of results) {
    const icon = r.ok ? '✓' : '✗';
    console.log(`${icon} ${r.method.padEnd(6)} ${r.path.padEnd(45)} → ${r.status} (expected ${r.expect})${r.message ? ' | ' + r.message : ''}`);
  }

  console.log(`\nTotal: ${results.length} | Passed: ${passed} | Failed: ${failed.length}`);
  if (failed.length) {
    console.log('\nFailed endpoints:');
    failed.forEach((r) => console.log(`  - ${r.method} ${r.path}: got ${r.status}, expected ${r.expect}${r.error ? ' (' + r.error + ')' : ''}`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
