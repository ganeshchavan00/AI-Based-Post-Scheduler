import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import User from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const BASE_URL = 'http://localhost:5000/api/auth';

const runAuthTests = async () => {
  console.log('🧪 Starting Phase 3 Authentication Test Suite...');
  const testEmail = `auth_test_${Date.now()}@testmail.com`;
  const testPassword = 'Password@123';
  const testName = 'Priya Patel';

  let authToken = null;
  let createdUserId = null;

  try {
    // 1. Test Registration
    console.log('\n1️⃣ Testing Registration (POST /api/auth/register)...');
    const regRes = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: testName,
        email: testEmail,
        password: testPassword,
      }),
    });
    const regData = await regRes.json();

    if (regRes.status !== 201 || !regData.success || !regData.token) {
      throw new Error(`Registration failed: ${JSON.stringify(regData)}`);
    }
    console.log('   ✅ Registration succeeded. Token issued:', regData.token.substring(0, 20) + '...');
    console.log('   👤 User details returned:', regData.user.name, `(${regData.user.email})`);
    if (regData.user.passwordHash) {
      throw new Error('Security violation: passwordHash exposed in response!');
    }
    console.log('   🔒 Security check passed: passwordHash is not present in response.');
    createdUserId = regData.user._id;

    // 2. Test Duplicate Registration Prevention
    console.log('\n2️⃣ Testing Duplicate Email Prevention...');
    const dupRes = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Another Name',
        email: testEmail,
        password: testPassword,
      }),
    });
    const dupData = await dupRes.json();
    if (dupRes.status === 400 && !dupData.success) {
      console.log('   ✅ Duplicate registration rejected properly with HTTP 400:', dupData.message);
    } else {
      throw new Error(`Expected 400 for duplicate email, got ${dupRes.status}`);
    }

    // 3. Test Login with Valid Credentials
    console.log('\n3️⃣ Testing Login (POST /api/auth/login) with correct credentials...');
    const loginRes = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    const loginData = await loginRes.json();
    if (loginRes.status === 200 && loginData.success && loginData.token) {
      authToken = loginData.token;
      console.log('   ✅ Login successful with HTTP 200. Token verified.');
    } else {
      throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
    }

    // 4. Test Login with Incorrect Password
    console.log('\n4️⃣ Testing Login with Wrong Password...');
    const wrongRes = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'WrongPassword999',
      }),
    });
    const wrongData = await wrongRes.json();
    if (wrongRes.status === 401 && !wrongData.success) {
      console.log('   ✅ Wrong password rejected properly with HTTP 401:', wrongData.message);
    } else {
      throw new Error(`Expected 401 for wrong password, got ${wrongRes.status}`);
    }

    // 5. Test Protected Route with Valid Bearer Token (GET /api/auth/me)
    console.log('\n5️⃣ Testing Protected Route (GET /api/auth/me) with Bearer token...');
    const meRes = await fetch(`${BASE_URL}/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });
    const meData = await meRes.json();
    if (meRes.status === 200 && meData.success && meData.user?.email === testEmail) {
      console.log('   ✅ Protected route verified. Authenticated as:', meData.user.name, `(${meData.user._id})`);
    } else {
      throw new Error(`GET /me failed: ${JSON.stringify(meData)}`);
    }

    // 6. Test Protected Route without Token
    console.log('\n6️⃣ Testing Protected Route without Token (Expect 401)...');
    const noTokenRes = await fetch(`${BASE_URL}/me`, { method: 'GET' });
    const noTokenData = await noTokenRes.json();
    if (noTokenRes.status === 401 && !noTokenData.success) {
      console.log('   ✅ Unauthorized request blocked properly with HTTP 401:', noTokenData.message);
    } else {
      throw new Error(`Expected 401 without token, got ${noTokenRes.status}`);
    }

    console.log('\n🎉 ALL 6 AUTHENTICATION TESTS PASSED WITH 100% SUCCESS!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exitCode = 1;
  } finally {
    // Clean up test user directly from MongoDB
    if (createdUserId) {
      try {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_social_scheduler';
        await mongoose.connect(uri);
        await User.findByIdAndDelete(createdUserId);
        console.log('🧹 Cleaned up temporary test user record.');
        await mongoose.connection.close();
      } catch (cleanupErr) {
        console.error('Cleanup warning:', cleanupErr.message);
      }
    }
  }
};

runAuthTests();
