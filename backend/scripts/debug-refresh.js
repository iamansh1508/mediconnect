#!/usr/bin/env node
/** Debug refresh token storage — compares match without printing tokens */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../src/shared/User.model');

const BASE = 'http://localhost:5001/api/v1';

async function run() {
  const { MongoMemoryServer } = require('mongodb-memory-server');
  // Use running server's DB via direct query after login
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mediconnect');
  
  const email = `dbg${Date.now()}@test.com`;
  await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Dbg', email, username: `dbg${Date.now()}`, password: 'Password123!', role: 'patient' }),
  });
  const login = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Password123!' }),
  });
  const loginData = await login.json();
  
  const user = await User.findOne({ email });
  const responseToken = loginData.refreshToken;
  const dbToken = user?.refreshToken;
  
  console.log('user found:', !!user);
  console.log('response has refreshToken:', !!responseToken);
  console.log('db has refreshToken:', !!dbToken);
  console.log('tokens match:', responseToken === dbToken);
  console.log('db token length:', dbToken?.length || 0);
  console.log('response token length:', responseToken?.length || 0);
  
  await mongoose.disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });
