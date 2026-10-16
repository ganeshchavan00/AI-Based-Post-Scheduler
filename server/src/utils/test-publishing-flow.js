import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Post from '../models/Post.js';
import SocialAccount from '../models/SocialAccount.js';
import { generateToken } from './jwt.js';
import {
  validatePostForPlatforms,
  sanitizeLogData,
  ensurePublicMediaUrls,
} from '../services/zernio.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const BASE_URL = 'http://localhost:5000/api';

const runPublishingRegressionTests = async () => {
  console.log('====================================================');
  console.log('🧪 Starting Social Publishing Flow Regression Tests');
  console.log('====================================================\n');

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_social_scheduler';
  await mongoose.connect(uri);

  let testUser, token;

  try {
    testUser = await User.create({
      name: 'Regression Tester',
      email: `regression_${Date.now()}@test.edu`,
      passwordHash: 'dummyhash123',
    });
    token = generateToken(testUser._id);
    console.log('👤 Created test user for regression suite.');

    // 1. Test Platform Validation: Instagram requires media
    console.log('\n1️⃣ Testing Instagram text-only rejection (Instagram requires media)...');
    try {
      validatePostForPlatforms({
        post: {
          selectedPlatforms: ['instagram'],
          content: 'Hello Instagram without media',
          mediaUrls: [],
        },
        connectedAccounts: [
          {
            provider: 'instagram',
            providerAccountId: 'ig_acc_123',
            accountDisplayName: 'IG Account',
            connectionStatus: 'connected',
            isSimulated: false,
          },
        ],
      });
      throw new Error('Expected Instagram text-only post to be rejected, but it passed.');
    } catch (err) {
      if (err.message.includes('Instagram requires at least one image or video')) {
        console.log('   ✅ Successfully rejected text-only Instagram post with clear message:');
        console.log(`      "${err.message}"`);
      } else {
        throw err;
      }
    }

    // 2. Test Platform Validation: Simulated accounts cannot publish
    console.log('\n2️⃣ Testing Simulated Account Rejection from Live Publishing...');
    try {
      validatePostForPlatforms({
        post: {
          selectedPlatforms: ['twitter'],
          content: 'Tweet test',
          mediaUrls: [],
        },
        connectedAccounts: [
          {
            provider: 'twitter',
            providerAccountId: 'tw_sim_123',
            accountDisplayName: 'Demo Twitter',
            connectionStatus: 'connected',
            isSimulated: true,
          },
        ],
      });
      throw new Error('Expected simulated account to be rejected, but it passed.');
    } catch (err) {
      if (err.message.includes('simulated demo account')) {
        console.log('   ✅ Successfully blocked simulated account with clear explanation:');
        console.log(`      "${err.message}"`);
      } else {
        throw err;
      }
    }

    // 3. Test Log Sanitization: Secrets and tokens are never logged
    console.log('\n3️⃣ Testing Safe Log Sanitization (Zero Secret Leakage)...');
    const sensitivePayload = {
      apiKey: 'sk_live_secret_key_12345',
      authorization: 'Bearer sensitive_jwt_token',
      post: {
        id: 'post_123',
        account: {
          token: 'oauth_access_token_xyz',
          password: 'super_secret_password',
        },
      },
    };
    const sanitized = sanitizeLogData(sensitivePayload);
    const serialized = JSON.stringify(sanitized);
    if (
      !serialized.includes('sk_live_secret_key_12345') &&
      !serialized.includes('sensitive_jwt_token') &&
      !serialized.includes('oauth_access_token_xyz') &&
      !serialized.includes('super_secret_password') &&
      sanitized.apiKey === '[REDACTED]' &&
      sanitized.authorization === '[REDACTED]'
    ) {
      console.log('   ✅ All sensitive fields successfully redacted from logging payload.');
    } else {
      throw new Error('Log sanitization failed to redact secrets: ' + serialized);
    }

    // 4. Test Duplicate Prevention on Already Published Post
    console.log('\n4️⃣ Testing Duplicate Publishing Prevention (Already Published)...');
    const publishedPost = await Post.create({
      userId: testUser._id,
      title: 'Already Published Post',
      content: 'Testing duplicate prevention mechanism',
      selectedPlatforms: ['instagram'],
      status: 'published',
      publishedAt: new Date(),
    });

    const dupRes = await fetch(`${BASE_URL}/posts/${publishedPost._id}/publish`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    const dupData = await dupRes.json();
    if (dupRes.status === 400 && dupData.message.includes('already been published')) {
      console.log('   ✅ Duplicate publish blocked with HTTP 400:');
      console.log(`      "${dupData.message}"`);
    } else {
      throw new Error(`Expected duplicate to be rejected (400) but got ${dupRes.status}: ${JSON.stringify(dupData)}`);
    }

    // 5. Test Duplicate Prevention on In-Flight (Publishing) Post
    console.log('\n5️⃣ Testing Duplicate Publishing Prevention (Currently In-Flight)...');
    const inFlightPost = await Post.create({
      userId: testUser._id,
      title: 'In-Flight Post',
      content: 'Testing concurrent publishing lockout',
      selectedPlatforms: ['instagram'],
      status: 'publishing',
    });

    const flightRes = await fetch(`${BASE_URL}/posts/${inFlightPost._id}/publish`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    const flightData = await flightRes.json();
    if (flightRes.status === 409 && flightData.message.includes('currently in the process of being published')) {
      console.log('   ✅ In-flight duplicate publish blocked with HTTP 409:');
      console.log(`      "${flightData.message}"`);
    } else {
      throw new Error(`Expected in-flight to return 409 Conflict, got ${flightRes.status}: ${JSON.stringify(flightData)}`);
    }

    // 6. Test CreatePost Validation Endpoint Check
    console.log('\n6️⃣ Testing Immediate Publish API Platform Pre-Validation...');
    const invalidCreateRes = await fetch(`${BASE_URL}/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Invalid Text Only IG',
        content: 'This should fail immediately before creating a broken post',
        selectedPlatforms: ['instagram'],
        status: 'published',
      }),
    });
    const invalidCreateData = await invalidCreateRes.json();
    if (invalidCreateRes.status === 400 && invalidCreateData.message) {
      console.log('   ✅ Invalid immediate publish rejected cleanly with HTTP 400:');
      console.log(`      "${invalidCreateData.message}"`);
    } else {
      throw new Error(`Expected 400 Bad Request, got ${invalidCreateRes.status}: ${JSON.stringify(invalidCreateData)}`);
    }

    console.log('\n====================================================');
    console.log('🎉 ALL PUBLISHING REGRESSION TESTS PASSED (6/6)!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('❌ Regression test failed:', err);
    process.exitCode = 1;
  } finally {
    try {
      if (testUser) {
        await User.findByIdAndDelete(testUser._id);
        await Post.deleteMany({ userId: testUser._id });
        await SocialAccount.deleteMany({ userId: testUser._id });
      }
      await mongoose.disconnect();
    } catch {}
  }
};

runPublishingRegressionTests();
