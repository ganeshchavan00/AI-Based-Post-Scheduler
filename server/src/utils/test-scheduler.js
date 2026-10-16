import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Post from '../models/Post.js';
import SocialAccount from '../models/SocialAccount.js';
import { processDuePosts } from '../services/scheduler.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ai_social_scheduler';
const BASE_URL = 'http://localhost:5000/api';

async function runSchedulerTests() {
  console.log('🧪 Starting Phase 7 Scheduler Engine Automated Tests...');
  let exitCode = 0;

  try {
    await mongoose.connect(MONGO_URI);
    console.log('🍃 Connected to MongoDB for Scheduler Test Suite.');

    // 1. Get or create test user
    let user = await User.findOne({ email: 'student@ai-scheduler.edu' });
    if (!user) {
      user = await User.create({
        name: 'Test Student',
        email: 'student@ai-scheduler.edu',
        passwordHash: 'dummyhash',
      });
    }

    // Ensure user has connected social accounts
    await SocialAccount.findOneAndUpdate(
      { userId: user._id, provider: 'twitter' },
      {
        providerAccountId: 'twitter_test_123',
        accountDisplayName: 'Student Twitter',
        connectionStatus: 'connected',
      },
      { upsert: true }
    );

    // 2. Test 1: Due post processing
    console.log('\n--- Test 1: Due Post Automated Execution ---');
    const pastPost = await Post.create({
      userId: user._id,
      title: 'Due Post Test',
      content: 'This post was scheduled for 5 minutes ago and should be published by the scheduler! #Automation',
      selectedPlatforms: ['twitter'],
      status: 'scheduled',
      scheduledAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes in the past
    });

    console.log(`Created past scheduled post: ${pastPost._id}`);
    const summary = await processDuePosts();
    console.log('processDuePosts() summary:', summary);

    const hasZernioKey = Boolean(
      process.env.ZERNIO_API_KEY &&
      process.env.ZERNIO_API_KEY.trim() !== '' &&
      !process.env.ZERNIO_API_KEY.startsWith('your_zernio_api_key')
    );

    const refreshedPastPost = await Post.findById(pastPost._id);
    if (refreshedPastPost.status === 'published' && refreshedPastPost.providerResults?.length > 0) {
      console.log('✅ Test 1 PASSED: Due post was picked up and transitioned to published status!');
    } else if (refreshedPastPost.status === 'failed' && refreshedPastPost.errorMessage) {
      console.log('✅ Test 1 PASSED: Due post was picked up and recorded provider validation outcome:');
      console.log('   "' + refreshedPastPost.errorMessage + '"');
    } else {
      console.error('❌ Test 1 FAILED: Expected post status to be processed, got:', refreshedPastPost.status);
      exitCode = 1;
    }

    // 3. Test 2: Future post must NOT be published prematurely
    console.log('\n--- Test 2: Future Post Retention ---');
    const futurePost = await Post.create({
      userId: user._id,
      title: 'Future Post Test',
      content: 'This post is scheduled for tomorrow and should remain scheduled. #Future',
      selectedPlatforms: ['twitter'],
      status: 'scheduled',
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours in the future
    });

    await processDuePosts();
    const refreshedFuturePost = await Post.findById(futurePost._id);
    if (refreshedFuturePost.status === 'scheduled') {
      console.log('✅ Test 2 PASSED: Future post remains scheduled and was not picked up prematurely.');
    } else {
      console.error('❌ Test 2 FAILED: Future post status changed unexpectedly to:', refreshedFuturePost.status);
      exitCode = 1;
    }

    // 4. Test 3: Cancel Schedule via API
    console.log('\n--- Test 3: Cancel Scheduled Post via HTTP API ---');
    // Login to get auth token
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'student@ai-scheduler.edu', password: 'Student@1234' }),
    });
    const loginData = await loginRes.json();
    const token = loginData.token;

    if (!token) {
      throw new Error('Could not obtain token for HTTP tests: ' + JSON.stringify(loginData));
    }

    const cancelRes = await fetch(`${BASE_URL}/posts/${futurePost._id}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    const cancelData = await cancelRes.json();
    if (cancelRes.ok && cancelData.post?.status === 'cancelled') {
      console.log('✅ Test 3 PASSED: Post schedule successfully cancelled (status = cancelled).');
    } else {
      console.error('❌ Test 3 FAILED: Cancel failed:', cancelData);
      exitCode = 1;
    }

    // 5. Test 4: Reschedule post to valid future date
    console.log('\n--- Test 4: Reschedule Post to Future Date via HTTP API ---');
    const newScheduledTime = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const rescheduleRes = await fetch(`${BASE_URL}/posts/${futurePost._id}/reschedule`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scheduledAt: newScheduledTime }),
    });
    const rescheduleData = await rescheduleRes.json();
    if (rescheduleRes.ok && rescheduleData.post?.status === 'scheduled') {
      console.log('✅ Test 4 PASSED: Post successfully rescheduled for future date.');
    } else {
      console.error('❌ Test 4 FAILED: Reschedule failed:', rescheduleData);
      exitCode = 1;
    }

    // 6. Test 5: Rejection of invalid/past date in reschedule
    console.log('\n--- Test 5: Rejection of Past Date in Reschedule ---');
    const invalidTime = new Date(Date.now() - 60 * 1000).toISOString();
    const badRescheduleRes = await fetch(`${BASE_URL}/posts/${futurePost._id}/reschedule`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scheduledAt: invalidTime }),
    });
    const badData = await badRescheduleRes.json();
    if (badRescheduleRes.status === 400) {
      console.log('✅ Test 5 PASSED: Server properly rejected past date with 400 Bad Request.');
    } else {
      console.error('❌ Test 5 FAILED: Expected 400 for past date, got:', badRescheduleRes.status);
      exitCode = 1;
    }

    // Clean up temporary test posts
    await Post.deleteMany({ _id: { $in: [pastPost._id, futurePost._id] } });
    console.log('🧹 Cleaned up temporary test post documents.');

    console.log('\n=======================================================');
    if (exitCode === 0) {
      console.log('🎉 ALL 5 PHASE 7 SCHEDULER TESTS PASSED WITH 100% SUCCESS!');
    } else {
      console.log('❌ SOME SCHEDULER TESTS FAILED.');
    }
    console.log('=======================================================\n');
  } catch (err) {
    console.error('💥 Unhandled error in test suite:', err);
    exitCode = 1;
  } finally {
    try {
      await mongoose.disconnect();
    } catch {}
    process.exitCode = exitCode;
  }
}

runSchedulerTests();
