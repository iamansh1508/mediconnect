#!/usr/bin/env node
/** Minimal refresh-token isolation test — no token output */
const BASE = 'http://localhost:5001/api/v1';
const email = `rt${Date.now()}@test.com`;

async function run() {
  await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'RT', email, username: `rt${Date.now()}`, password: 'Password123!', role: 'patient' }),
  });
  const login = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Password123!' }),
  });
  const loginData = await login.json();
  const refresh = await fetch(`${BASE}/auth/refresh-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: loginData.refreshToken }),
  });
  console.log('login status:', login.status);
  console.log('refresh status:', refresh.status);
  console.log('refresh message:', (await refresh.json()).message);
}

run().catch(console.error);
