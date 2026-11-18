import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Post from '../models/Post.js';
import SocialAccount from '../models/SocialAccount.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const BASE_URL = 'http://localhost:5000/api';
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_social_scheduler';

async function runPersistenceVerification() {
  console.log('================================================================');
  console.log('🧪 MONGODB DATA PERSISTENCE COMPREHENSIVE VERIFICATION AUDIT');
  console.log('================================================================\n');

  await mongoose.connect(MONGO_URI);
  console.log(`🍃 Connected to MongoDB: ${mongoose.connection.host}/${mongoose.connection.name}`);
  const db = mongoose.connection.db;

  const testEmail = `persistence_test_${Date.now()}@example.com`;
  const testPassword = 'TestPassword@123';
  const testName = 'Persistence Tester';

  let testUserId = null;
  let authToken = null;
  let draftPostId = null;
  let scheduledPostId = null;
  let socialAccountId = null;

  try {
    // -------------------------------------------------------------
    // Test 1: Register a test user and confirm it appears in `users`
    // -------------------------------------------------------------
    console.log('\n--- 1. Register a test user and confirm it appears in `users` ---');
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: testName,
        email: testEmail,
        password: testPassword,
      }),
    });
    const regData = await regRes.json();
    if (!regRes.ok || !regData.success || !regData.token) {
      throw new Error(`Registration failed: ${JSON.stringify(regData)}`);
    }
    testUserId = regData.user._id;
    console.log(`   ✅ API Registration successful. User ID: ${testUserId}`);

    // Direct MongoDB verification
    const userInDb = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(testUserId) });
    if (!userInDb) {
      throw new Error(`FAILED: User document not found in MongoDB 'users' collection!`);
    }
    if (userInDb.email !== testEmail.toLowerCase()) {
      throw new Error(`FAILED: Email in DB (${userInDb.email}) does not match registered email!`);
    }
    if (!userInDb.passwordHash || !userInDb.passwordHash.startsWith('$2')) {
      throw new Error(`FAILED: Password hash invalid or plaintext stored!`);
    }
    console.log(`   ✅ Confirmed document in 'users' collection:`);
    console.log(`      _id: ${userInDb._id}`);
    console.log(`      email: ${userInDb.email}`);
    console.log(`      name: ${userInDb.name}`);
    console.log(`      passwordHash: ${userInDb.passwordHash.substring(0, 15)}... (bcrypt hash verified, never plaintext)`);

    // -------------------------------------------------------------
    // Test 2: Log in and verify authentication works
    // -------------------------------------------------------------
    console.log('\n--- 2. Log in and verify authentication works ---');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok || !loginData.success || !loginData.token) {
      throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
    }
    authToken = loginData.token;
    console.log(`   ✅ API Login successful. JWT token issued: ${authToken.substring(0, 25)}...`);

    // Verify /api/auth/me uses MongoDB user
    const meRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const meData = await meRes.json();
    if (!meRes.ok || meData.user?.email !== testEmail.toLowerCase()) {
      throw new Error(`Profile lookup failed: ${JSON.stringify(meData)}`);
    }
    console.log(`   ✅ Verified auth middleware loaded database user: ${meData.user.name} (${meData.user.email})`);

    // -------------------------------------------------------------
    // Test 3: Create a draft post and confirm it appears in `posts`
    // -------------------------------------------------------------
    console.log('\n--- 3. Create a draft post and confirm it appears in `posts` ---');
    const draftRes = await fetch(`${BASE_URL}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        title: 'Draft Persistence Test Post',
        content: 'This draft should be saved in MongoDB posts collection.',
        hashtags: ['DraftTest', 'MongoDB'],
        selectedPlatforms: ['twitter', 'linkedin'],
        status: 'draft',
      }),
    });
    const draftData = await draftRes.json();
    if (!draftRes.ok || !draftData.post?._id) {
      throw new Error(`Draft post creation failed: ${JSON.stringify(draftData)}`);
    }
    draftPostId = draftData.post._id;
    console.log(`   ✅ API returned draft post ID: ${draftPostId}`);

    // Direct MongoDB verification in posts collection
    const draftInDb = await db.collection('posts').findOne({ _id: new mongoose.Types.ObjectId(draftPostId) });
    if (!draftInDb) {
      throw new Error(`FAILED: Draft post not found in MongoDB 'posts' collection!`);
    }
    if (draftInDb.status !== 'draft') {
      throw new Error(`FAILED: Post status in DB is '${draftInDb.status}', expected 'draft'!`);
    }
    if (draftInDb.title !== 'Draft Persistence Test Post') {
      throw new Error(`FAILED: Title in DB mismatch!`);
    }
    console.log(`   ✅ Confirmed document in 'posts' collection:`);
    console.log(`      _id: ${draftInDb._id}`);
    console.log(`      userId: ${draftInDb.userId}`);
    console.log(`      title: "${draftInDb.title}"`);
    console.log(`      status: "${draftInDb.status}"`);
    console.log(`      platforms: [${draftInDb.selectedPlatforms.join(', ')}]`);

    // -------------------------------------------------------------
    // Test 4: Create a scheduled post and confirm its scheduled time and status are saved
    // -------------------------------------------------------------
    console.log('\n--- 4. Create a scheduled post and confirm scheduled time & status ---');
    const targetScheduledTime = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours in future
    const schedRes = await fetch(`${BASE_URL}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        title: 'Scheduled Persistence Test Post',
        content: 'This post is scheduled for future delivery via MongoDB scheduler.',
        hashtags: ['Scheduled', 'Persistence'],
        selectedPlatforms: ['twitter'],
        status: 'scheduled',
        scheduledAt: targetScheduledTime.toISOString(),
      }),
    });
    const schedData = await schedRes.json();
    if (!schedRes.ok || !schedData.post?._id) {
      throw new Error(`Scheduled post creation failed: ${JSON.stringify(schedData)}`);
    }
    scheduledPostId = schedData.post._id;
    console.log(`   ✅ API returned scheduled post ID: ${scheduledPostId}`);

    // Direct MongoDB verification in posts collection
    const schedInDb = await db.collection('posts').findOne({ _id: new mongoose.Types.ObjectId(scheduledPostId) });
    if (!schedInDb) {
      throw new Error(`FAILED: Scheduled post not found in MongoDB 'posts' collection!`);
    }
    if (schedInDb.status !== 'scheduled') {
      throw new Error(`FAILED: Post status in DB is '${schedInDb.status}', expected 'scheduled'!`);
    }
    if (!schedInDb.scheduledAt) {
      throw new Error(`FAILED: scheduledAt is null or missing in MongoDB!`);
    }
    const dbTime = new Date(schedInDb.scheduledAt).getTime();
    const reqTime = targetScheduledTime.getTime();
    if (Math.abs(dbTime - reqTime) > 1000) {
      throw new Error(`FAILED: scheduledAt in DB (${schedInDb.scheduledAt}) does not match requested time!`);
    }
    console.log(`   ✅ Confirmed document in 'posts' collection:`);
    console.log(`      _id: ${schedInDb._id}`);
    console.log(`      status: "${schedInDb.status}"`);
    console.log(`      scheduledAt: ${new Date(schedInDb.scheduledAt).toISOString()} (Time precision verified)`);

    // -------------------------------------------------------------
    // Test 5: Reload the application and confirm saved posts remain visible
    // -------------------------------------------------------------
    console.log('\n--- 5. Reload application (GET /api/posts) and confirm posts remain visible ---');
    const listRes = await fetch(`${BASE_URL}/posts`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const listData = await listRes.json();
    if (!listRes.ok || !Array.isArray(listData.posts)) {
      throw new Error(`Fetch posts failed: ${JSON.stringify(listData)}`);
    }
    const foundDraft = listData.posts.find((p) => p._id === draftPostId);
    const foundSched = listData.posts.find((p) => p._id === scheduledPostId);
    if (!foundDraft || !foundSched) {
      throw new Error(`FAILED: Reload did not return saved posts from MongoDB! (Found draft: ${Boolean(foundDraft)}, found sched: ${Boolean(foundSched)})`);
    }
    console.log(`   ✅ Retrieved ${listData.posts.length} posts from MongoDB query.`);
    console.log(`   ✅ Verified draft post is visible: "${foundDraft.title}" (${foundDraft.status})`);
    console.log(`   ✅ Verified scheduled post is visible: "${foundSched.title}" (${foundSched.status})`);

    // -------------------------------------------------------------
    // Test 6: Verify editing or rescheduling updates existing document without duplicates
    // -------------------------------------------------------------
    console.log('\n--- 6. Verify edit & reschedule updates existing document (no duplicates) ---');
    const postCountBefore = await db.collection('posts').countDocuments({ userId: new mongoose.Types.ObjectId(testUserId) });

    // 6a: Edit draft post
    const updatedContent = 'Updated content: verified database persistence without duplicate document creation!';
    const editRes = await fetch(`${BASE_URL}/posts/${draftPostId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        title: 'Edited Draft Title',
        content: updatedContent,
      }),
    });
    const editData = await editRes.json();
    if (!editRes.ok || editData.post?.title !== 'Edited Draft Title') {
      throw new Error(`Edit failed: ${JSON.stringify(editData)}`);
    }

    // 6b: Reschedule scheduled post
    const newScheduledTime = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours in future
    const reschedRes = await fetch(`${BASE_URL}/posts/${scheduledPostId}/reschedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        scheduledAt: newScheduledTime.toISOString(),
      }),
    });
    const reschedData = await reschedRes.json();
    if (!reschedRes.ok || reschedData.post?.status !== 'scheduled') {
      throw new Error(`Reschedule failed: ${JSON.stringify(reschedData)}`);
    }

    // Direct MongoDB verification of update-in-place
    const postCountAfter = await db.collection('posts').countDocuments({ userId: new mongoose.Types.ObjectId(testUserId) });
    if (postCountBefore !== postCountAfter) {
      throw new Error(`FAILED: Duplicate documents created! Count before: ${postCountBefore}, count after: ${postCountAfter}`);
    }

    const draftUpdatedInDb = await db.collection('posts').findOne({ _id: new mongoose.Types.ObjectId(draftPostId) });
    if (draftUpdatedInDb.title !== 'Edited Draft Title' || draftUpdatedInDb.content !== updatedContent) {
      throw new Error(`FAILED: Edited draft document was not updated in MongoDB!`);
    }

    const schedUpdatedInDb = await db.collection('posts').findOne({ _id: new mongoose.Types.ObjectId(scheduledPostId) });
    const newDbTime = new Date(schedUpdatedInDb.scheduledAt).getTime();
    if (Math.abs(newDbTime - newScheduledTime.getTime()) > 1000) {
      throw new Error(`FAILED: Rescheduled time was not updated in MongoDB!`);
    }

    console.log(`   ✅ Post count unchanged: ${postCountBefore} -> ${postCountAfter} (Zero duplicate documents created).`);
    console.log(`   ✅ Existing draft document [${draftPostId}] updated in-place: "${draftUpdatedInDb.title}"`);
    console.log(`   ✅ Existing scheduled document [${scheduledPostId}] rescheduled in-place to: ${newScheduledTime.toISOString()}`);

    // -------------------------------------------------------------
    // Test 7: Confirm social account metadata is persisted only through real connection flow
    // -------------------------------------------------------------
    console.log('\n--- 7. Confirm social account metadata persisted in `socialaccounts` ---');
    const connectRes = await fetch(`${BASE_URL}/social/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        provider: 'twitter',
        providerAccountId: 'tw_test_audit_987',
        accountDisplayName: 'Persistence Twitter (@pers_tw)',
        accountUsername: 'pers_tw',
        isSimulated: true,
      }),
    });
    const connectData = await connectRes.json();
    if (!connectRes.ok || !connectData.account?._id) {
      throw new Error(`Connect account failed: ${JSON.stringify(connectData)}`);
    }
    socialAccountId = connectData.account._id;

    // Direct MongoDB check in socialaccounts collection
    const accInDb = await db.collection('socialaccounts').findOne({ _id: new mongoose.Types.ObjectId(socialAccountId) });
    if (!accInDb) {
      throw new Error(`FAILED: Social account document not found in MongoDB 'socialaccounts' collection!`);
    }
    if (accInDb.provider !== 'twitter' || accInDb.connectionStatus !== 'connected') {
      throw new Error(`FAILED: Provider or connectionStatus invalid in MongoDB!`);
    }
    console.log(`   ✅ Confirmed document in 'socialaccounts' collection:`);
    console.log(`      _id: ${accInDb._id}`);
    console.log(`      provider: "${accInDb.provider}"`);
    console.log(`      providerAccountId: "${accInDb.providerAccountId}"`);
    console.log(`      displayName: "${accInDb.accountDisplayName}"`);
    console.log(`      connectionStatus: "${accInDb.connectionStatus}"`);

    // Verify GET /api/social/accounts returns it
    const accListRes = await fetch(`${BASE_URL}/social/accounts`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const accListData = await accListRes.json();
    const foundAcc = accListData.accounts?.find((a) => a._id === socialAccountId);
    if (!foundAcc) {
      throw new Error(`FAILED: Social accounts API did not return connected account!`);
    }
    if (foundAcc.encryptedCredentials) {
      throw new Error(`SECURITY VIOLATION: encryptedCredentials exposed in social account API response!`);
    }
    console.log(`   ✅ GET /api/social/accounts retrieved account cleanly. Zero secrets exposed.`);

    // Disconnect account and verify status update in MongoDB
    const disRes = await fetch(`${BASE_URL}/social/accounts/${socialAccountId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const disData = await disRes.json();
    if (!disRes.ok || !disData.success) {
      throw new Error(`Disconnect failed: ${JSON.stringify(disData)}`);
    }

    const disInDb = await db.collection('socialaccounts').findOne({ _id: new mongoose.Types.ObjectId(socialAccountId) });
    if (!disInDb || disInDb.connectionStatus !== 'disconnected') {
      throw new Error(`FAILED: connectionStatus not updated to 'disconnected' in MongoDB! Current: ${disInDb?.connectionStatus}`);
    }
    console.log(`   ✅ Account disconnected: MongoDB connectionStatus successfully updated to: "${disInDb.connectionStatus}"`);

    // -------------------------------------------------------------
    // Test 8: Check dashboard, queue, and history data come from MongoDB
    // -------------------------------------------------------------
    console.log('\n--- 8. Check dashboard, queue, and history data come from MongoDB ---');

    // 8a: Dashboard stats
    const dashRes = await fetch(`${BASE_URL}/dashboard/stats`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const dashData = await dashRes.json();
    if (!dashRes.ok || !dashData.stats) {
      throw new Error(`Dashboard stats failed: ${JSON.stringify(dashData)}`);
    }

    // Direct MongoDB aggregation comparison
    const mongoCounts = await db.collection('posts').aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(testUserId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]).toArray();

    const expectedDrafts = mongoCounts.find((c) => c._id === 'draft')?.count || 0;
    const expectedScheduled = mongoCounts.find((c) => c._id === 'scheduled')?.count || 0;
    const expectedTotal = mongoCounts.reduce((acc, c) => acc + c.count, 0);

    if (
      dashData.stats.draft !== expectedDrafts ||
      dashData.stats.scheduled !== expectedScheduled ||
      dashData.stats.total !== expectedTotal
    ) {
      throw new Error(`FAILED: Dashboard stats (${JSON.stringify(dashData.stats)}) do not match MongoDB aggregation (${JSON.stringify(mongoCounts)})!`);
    }
    console.log(`   ✅ Dashboard stats match exact MongoDB documents: total=${dashData.stats.total}, draft=${dashData.stats.draft}, scheduled=${dashData.stats.scheduled}`);

    // 8b: Scheduled queue query
    const queueRes = await fetch(`${BASE_URL}/posts?status=scheduled`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const queueData = await queueRes.json();
    if (!queueRes.ok || queueData.count !== 1 || queueData.posts[0]?._id !== scheduledPostId) {
      throw new Error(`Queue query failed: ${JSON.stringify(queueData)}`);
    }
    console.log(`   ✅ Scheduled Queue query returned exactly 1 scheduled post from MongoDB: "${queueData.posts[0].title}"`);

    // 8c: Post history pagination query
    const histRes = await fetch(`${BASE_URL}/posts?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const histData = await histRes.json();
    if (!histRes.ok || histData.total !== 2 || histData.posts.length !== 2) {
      throw new Error(`History query failed: ${JSON.stringify(histData)}`);
    }
    console.log(`   ✅ Post History query returned exactly 2 persisted posts from MongoDB (total=${histData.total}).`);

    console.log('\n================================================================');
    console.log('🎉 ALL 8 PERSISTENCE AUDIT TESTS EXECUTED AND PASSED WITH 100% SUCCESS!');
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n❌ Persistence audit failed:', err.message);
    process.exitCode = 1;
  } finally {
    // Clean up ONLY the temporary test documents created during this test
    console.log('🧹 Cleaning up temporary persistence test documents (preserving all existing database records)...');
    if (draftPostId) await db.collection('posts').deleteOne({ _id: new mongoose.Types.ObjectId(draftPostId) });
    if (scheduledPostId) await db.collection('posts').deleteOne({ _id: new mongoose.Types.ObjectId(scheduledPostId) });
    if (socialAccountId) await db.collection('socialaccounts').deleteOne({ _id: new mongoose.Types.ObjectId(socialAccountId) });
    if (testUserId) await db.collection('users').deleteOne({ _id: new mongoose.Types.ObjectId(testUserId) });
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB. Verification test finished cleanly.');
  }
}

runPersistenceVerification();
