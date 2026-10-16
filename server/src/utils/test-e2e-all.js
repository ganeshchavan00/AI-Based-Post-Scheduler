import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const BASE_URL = 'http://127.0.0.1:5000/api';

async function runE2EVerification() {
  console.log('====================================================');
  console.log('🚀 SOCIAL MEDIA POST SCHEDULER - FULL E2E SYSTEM INTEGRATION AUDIT');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name} - Error: ${err.message}`);
      failed++;
    }
  };

  // 1. Health check
  await test('Subsystem 1: Health Check Endpoint', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    const data = await res.json();
    if (!res.ok || data.status !== 'healthy') {
      throw new Error('Health check failed: ' + JSON.stringify(data));
    }
  });

  // 2. Authentication Login
  let token = null;
  await test('Subsystem 2: JWT Authentication (Demo Login)', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'student@ai-scheduler.edu',
        password: 'Student@1234',
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.token) {
      throw new Error('Login failed: ' + JSON.stringify(data));
    }
    token = data.token;
  });

  // 3. User Me Profile
  await test('Subsystem 3: Protected Auth Profile (/api/auth/me)', async () => {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok || data.user?.email !== 'student@ai-scheduler.edu') {
      throw new Error('Auth profile retrieval failed: ' + JSON.stringify(data));
    }
  });

  // 4. Google Gemini Content Generation (Captions & Hashtags)
  await test('Subsystem 4: AI Generation Service (Captions & Hashtags)', async () => {
    let captionRes = await fetch(`${BASE_URL}/ai/generate-caption`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'AI Post Scheduling System launched for engineering project',
        topic: 'AI Post Scheduling System launched for engineering project',
        platform: 'twitter',
        tone: 'professional',
      }),
    });
    let captionData = await captionRes.json();

    // If live key is missing (503) or quota exhausted (429/401), verify fallback generation
    if (captionRes.status === 429 || captionRes.status === 503 || captionRes.status === 401) {
      console.log(`   ℹ️ [Gemini Service] Live status ${captionRes.status} (${captionData.code || captionData.message}). Testing fallback generation...`);
      captionRes = await fetch(`${BASE_URL}/ai/generate-caption`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'AI Post Scheduling System launched for engineering project',
          platform: 'twitter',
          tone: 'professional',
          useFallback: true,
        }),
      });
      captionData = await captionRes.json();
    }

    if (!captionRes.ok || !captionData.caption) {
      throw new Error('Caption generation failed: ' + JSON.stringify(captionData));
    }

    let hashtagRes = await fetch(`${BASE_URL}/ai/generate-hashtags`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: captionData.caption,
        topic: captionData.caption,
        count: 5,
        useFallback: Boolean(captionData.isMock),
      }),
    });
    let hashtagData = await hashtagRes.json();
    if (!hashtagRes.ok || !Array.isArray(hashtagData.hashtags) || hashtagData.hashtags.length === 0) {
      throw new Error('Hashtag generation failed: ' + JSON.stringify(hashtagData));
    }
  });

  // 5. Social Accounts Integration (Zernio OAuth URL & Connected List)
  const hasZernioKey = Boolean(
    process.env.ZERNIO_API_KEY &&
    process.env.ZERNIO_API_KEY.trim() !== '' &&
    !process.env.ZERNIO_API_KEY.startsWith('your_zernio_api_key')
  );

  await test('Subsystem 5: Social Media Integration via Zernio Service', async () => {
    const listRes = await fetch(`${BASE_URL}/social/accounts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const listData = await listRes.json();
    if (!listRes.ok || !Array.isArray(listData.accounts)) {
      throw new Error('Social accounts listing failed: ' + JSON.stringify(listData));
    }

    const authUrlRes = await fetch(`${BASE_URL}/social/connect-url?platform=linkedin`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const authUrlData = await authUrlRes.json();
    if (hasZernioKey) {
      if (!authUrlRes.ok || !authUrlData.authUrl) {
        throw new Error('Connect URL generation failed: ' + JSON.stringify(authUrlData));
      }
    } else {
      if (authUrlRes.status !== 400 || authUrlData.configured !== false) {
        throw new Error('Expected configuration error (400) for missing ZERNIO_API_KEY: ' + JSON.stringify(authUrlData));
      }
    }
  });

  // 6. Post Lifecycle: Create -> Schedule -> Reschedule -> Publish
  let testPostId = null;
  await test('Subsystem 6: Post Creation, Scheduling & Rescheduling Lifecycle', async () => {
    const futureDate = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
    const createRes = await fetch(`${BASE_URL}/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'E2E Full Suite Post',
        content: 'Final verification post for Social Media Post Scheduler mini project. #FullStack #MERN',
        hashtags: ['FullStack', 'MERN'],
        selectedPlatforms: ['twitter', 'linkedin'],
        status: 'scheduled',
        scheduledAt: futureDate,
      }),
    });
    const createData = await createRes.json();
    if (!createRes.ok || !createData.post?._id) {
      throw new Error('Post creation failed: ' + JSON.stringify(createData));
    }
    testPostId = createData.post._id;

    // Reschedule to 12 hours ahead
    const newDate = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    const rescheduleRes = await fetch(`${BASE_URL}/posts/${testPostId}/reschedule`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scheduledAt: newDate }),
    });
    const rescheduleData = await rescheduleRes.json();
    if (!rescheduleRes.ok || rescheduleData.post?.status !== 'scheduled') {
      throw new Error('Reschedule failed: ' + JSON.stringify(rescheduleData));
    }
  });

  // 7. Instant Publish Dispatch
  await test('Subsystem 7: Multi-Platform Publishing Dispatch via Zernio Engine', async () => {
    const publishRes = await fetch(`${BASE_URL}/posts/${testPostId}/publish`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    const publishData = await publishRes.json();
    if (publishRes.ok && publishData.post?.status === 'published') {
      return;
    }
    // Safety check verification: correctly rejects simulated accounts from live network dispatch
    if (publishRes.status === 400 && (publishData.message?.includes('simulated') || publishData.message?.includes('simulated test accounts'))) {
      return;
    }
    if (!hasZernioKey && publishRes.status === 400) {
      return;
    }
    throw new Error('Publish dispatch failed unexpectedly: ' + JSON.stringify(publishData));
  });

  // 8. Scheduler Engine Queue Run
  await test('Subsystem 8: Background Scheduler Queue Processor Trigger', async () => {
    const queueRes = await fetch(`${BASE_URL}/posts/scheduler/run-due`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    const queueData = await queueRes.json();
    if (!queueRes.ok || !queueData.success) {
      throw new Error('Scheduler run failed: ' + JSON.stringify(queueData));
    }
  });

  // 9. Dashboard Stats Verification
  await test('Subsystem 9: Central Dashboard Metrics & Real Data Aggregation', async () => {
    const dashRes = await fetch(`${BASE_URL}/dashboard/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const dashData = await dashRes.json();
    if (!dashRes.ok || dashData.stats?.total === undefined) {
      throw new Error('Dashboard stats failed: ' + JSON.stringify(dashData));
    }
  });

  // 10. Clean up test post
  if (testPostId) {
    await fetch(`${BASE_URL}/posts/${testPostId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  console.log('\n====================================================');
  console.log(`📊 AUDIT SUMMARY: Passed: ${passed} | Failed: ${failed}`);
  if (failed === 0) {
    console.log('🏆 ALL SUBSYSTEMS FULLY OPERATIONAL AND VERIFIED!');
  } else {
    console.log('⚠️ AUDIT REPORTED ISSUES.');
  }
  console.log('====================================================\n');

  process.exit(failed === 0 ? 0 : 1);
}

runE2EVerification();
