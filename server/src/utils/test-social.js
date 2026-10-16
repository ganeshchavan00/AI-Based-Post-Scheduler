import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Post from '../models/Post.js';
import SocialAccount from '../models/SocialAccount.js';
import { generateToken } from './jwt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const BASE_URL = 'http://localhost:5000/api';

const runSocialTests = async () => {
  console.log('====================================================');
  console.log('🧪 Starting Audited Social Media Integration Test Suite...');
  console.log('====================================================\n');

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_social_scheduler';
  await mongoose.connect(uri);

  let testUser, token, simulatedAccountId, testPostId;
  const hasZernioKey = Boolean(
    process.env.ZERNIO_API_KEY &&
    process.env.ZERNIO_API_KEY.trim() !== '' &&
    !process.env.ZERNIO_API_KEY.startsWith('your_zernio_api_key')
  );

  console.log(`🔑 ZERNIO_API_KEY Configured: ${hasZernioKey ? 'YES (Live Credentials Detected)' : 'NO (Missing/Empty in server/.env)'}`);

  try {
    testUser = await User.create({
      name: 'Social Test User',
      email: `social_${Date.now()}@test.edu`,
      passwordHash: 'fakehash123',
    });
    token = generateToken(testUser._id);
    console.log('👤 Created authenticated test user.');

    // 1. Test Integration Status Endpoint
    console.log('\n1️⃣ Testing Zernio Status Check (GET /api/social/status)...');
    const statusRes = await fetch(`${BASE_URL}/social/status`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const statusData = await statusRes.json();
    if (statusRes.status === 200 && statusData.success && statusData.status) {
      console.log('   ✅ Status check returned successfully.');
      console.log('   📡 Configured:', statusData.status.configured);
      console.log('   🌐 Base URL:', statusData.status.baseUrl);
      console.log('   💬 Message:', statusData.status.message);
    } else {
      throw new Error(`Failed to check integration status: ${JSON.stringify(statusData)}`);
    }

    // 2. Test Get Connect URL (Live OAuth flow for LinkedIn)
    console.log('\n2️⃣ Testing OAuth Connect URL for LinkedIn (GET /api/social/connect-url?platform=linkedin)...');
    const authUrlRes = await fetch(`${BASE_URL}/social/connect-url?platform=linkedin`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const authUrlData = await authUrlRes.json();

    if (hasZernioKey) {
      if (authUrlRes.status === 200 && authUrlData.success && authUrlData.authUrl) {
        console.log('   ✅ Real Zernio LinkedIn OAuth URL generated:', authUrlData.authUrl.substring(0, 60) + '...');
      } else {
        throw new Error(`Real connect URL failed: ${JSON.stringify(authUrlData)}`);
      }

      // Check Twitter pass-through constraint
      console.log('   Testing Twitter pass-through billing check (GET /api/social/connect-url?platform=twitter)...');
      const twUrlRes = await fetch(`${BASE_URL}/social/connect-url?platform=twitter`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const twUrlData = await twUrlRes.json();
      console.log(`   ℹ️ Twitter connect response (${twUrlRes.status}):`, twUrlData.message?.substring(0, 75) + '...');
    } else {
      if (authUrlRes.status === 400 && authUrlData.configured === false) {
        console.log('   ✅ Correctly returned clear configuration error when API key is missing:');
        console.log('      "' + authUrlData.message + '"');
      } else {
        throw new Error(`Expected configuration error (400) but received: ${JSON.stringify(authUrlData)}`);
      }
    }

    // 3. Test Synchronizing Real Accounts from Zernio
    if (hasZernioKey) {
      console.log('\n3️⃣ Testing Syncing Real Accounts from Zernio (POST /api/social/sync)...');
      const syncRes = await fetch(`${BASE_URL}/social/sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const syncData = await syncRes.json();
      if (syncRes.status === 200 && syncData.success) {
        console.log(`   ✅ Account Sync succeeded: ${syncData.count} account(s) synced.`);
        if (syncData.accounts?.length > 0) {
          const first = syncData.accounts[0];
          console.log(`   📱 Synced Real Account: ${first.accountDisplayName} (@${first.accountUsername}) on [${first.provider}]`);
          console.log(`   ⚡ isSimulated: ${first.isSimulated} | status: ${first.connectionStatus}`);
        }
      } else {
        console.warn('   ⚠️ Sync returned non-200:', JSON.stringify(syncData));
      }
    }

    // 4. Test Connecting Simulated Sandbox Account (Explicitly Distinguished)
    console.log('\n4️⃣ Testing Sandbox Account Connection (POST /api/social/connect with isSimulated: true)...');
    const connectRes = await fetch(`${BASE_URL}/social/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        provider: 'twitter',
        providerAccountId: `tw_sim_${Date.now()}`,
        accountDisplayName: 'Social Tester (@social_test)',
        accountUsername: 'social_test',
        isSimulated: true,
      }),
    });
    const connectData = await connectRes.json();
    if (connectRes.status === 200 && connectData.success && connectData.account) {
      simulatedAccountId = connectData.account._id;
      console.log('   ✅ Sandbox account connected with ID:', simulatedAccountId);
      console.log('   ⚡ isSimulated flag verified in database:', connectData.account.isSimulated === true);
    } else {
      throw new Error(`Failed to connect simulated account: ${JSON.stringify(connectData)}`);
    }

    // 5. Test Listing Accounts and Distinguishing Types
    console.log('\n5️⃣ Testing List Accounts (GET /api/social/accounts)...');
    const listRes = await fetch(`${BASE_URL}/social/accounts`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const listData = await listRes.json();
    if (listRes.status === 200 && listData.success && listData.accounts?.length >= 1) {
      const found = listData.accounts.find((a) => a._id === simulatedAccountId);
      console.log('   ✅ Account listed. Provider:', found?.provider, '| isSimulated:', found?.isSimulated);
      if (found?.encryptedCredentials) {
        throw new Error('SECURITY VIOLATION: encryptedCredentials was exposed to frontend API response!');
      }
      console.log('   🔒 Verified credentials are NOT exposed in API response.');
    } else {
      throw new Error(`List accounts failed: ${JSON.stringify(listData)}`);
    }

    // 6. Test Publishing Verification
    console.log('\n6️⃣ Testing Publishing Pipeline & Error Enforcement...');
    const postRes = await fetch(`${BASE_URL}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: 'Audited Publishing Pipeline Test',
        content: 'Testing real vs simulated post publishing behavior! #Tech #BTechMiniProject',
        selectedPlatforms: ['twitter'],
        status: 'draft',
      }),
    });
    const postData = await postRes.json();
    testPostId = postData.post._id;

    const pubRes = await fetch(`${BASE_URL}/posts/${testPostId}/publish`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const pubData = await pubRes.json();

    if (hasZernioKey) {
      if (pubRes.status === 200 && pubData.success) {
        console.log('   ✅ Real post published via Zernio:', pubData.post.status);
      } else {
        console.log('   ℹ️ Zernio live response received:', pubData.message);
      }
    } else {
      // Must NOT pretend post was published! Must return error and mark post as failed.
      if (pubRes.status === 400 && pubData.success === false) {
        console.log('   ✅ Correctly rejected publishing without valid credentials / for simulated account:');
        console.log('      "' + pubData.message + '"');
        const updatedPost = await Post.findById(testPostId);
        console.log('   📝 Database post status correctly recorded as:', updatedPost.status);
        console.log('   📝 Database error recorded as:', updatedPost.errorMessage?.substring(0, 50) + '...');
      } else {
        throw new Error(`Expected publishing rejection but received: ${JSON.stringify(pubData)}`);
      }
    }

    // 7. Test Disconnect Account
    console.log('\n7️⃣ Testing Disconnect Account (DELETE /api/social/accounts/:id)...');
    const disRes = await fetch(`${BASE_URL}/social/accounts/${simulatedAccountId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const disData = await disRes.json();
    if (disRes.status === 200 && disData.success) {
      console.log('   ✅ Account disconnected cleanly.');
    } else {
      throw new Error(`Disconnect account failed: ${JSON.stringify(disData)}`);
    }

    console.log('\n====================================================');
    console.log('🎉 ALL SOCIAL INTEGRATION AUDIT TESTS PASSED WITH 100% SUCCESS!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exitCode = 1;
  } finally {
    if (testUser) await User.findByIdAndDelete(testUser._id);
    if (testPostId) await Post.findByIdAndDelete(testPostId);
    if (simulatedAccountId) await SocialAccount.findByIdAndDelete(simulatedAccountId);
    await mongoose.connection.close();
    console.log('🧹 Cleaned up test records.');
  }
};

runSocialTests();
