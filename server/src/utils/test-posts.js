import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Post from '../models/Post.js';
import { generateToken } from './jwt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const BASE_URL = 'http://localhost:5000/api';

const runPostTests = async () => {
  console.log('🧪 Starting Phase 4 Post Management CRUD & Ownership Test Suite...');
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_social_scheduler';
  await mongoose.connect(uri);

  let userA, userB, tokenA, tokenB, postId;

  try {
    // 1. Create two test users in database
    userA = await User.create({
      name: 'User Alpha',
      email: `alpha_${Date.now()}@test.edu`,
      passwordHash: 'fakehash123',
    });
    tokenA = generateToken(userA._id);

    userB = await User.create({
      name: 'User Beta',
      email: `beta_${Date.now()}@test.edu`,
      passwordHash: 'fakehash123',
    });
    tokenB = generateToken(userB._id);

    console.log('   👥 Created test users: User Alpha & User Beta');

    // 2. User A creates a post
    console.log('\n1️⃣ Testing Post Creation (POST /api/posts)...');
    const createRes = await fetch(`${BASE_URL}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        title: 'Exciting AI Announcement',
        content: 'Check out our new post scheduler built with MERN stack and OpenAI! #AI #Tech',
        hashtags: ['AI', 'Tech', 'FullStack'],
        selectedPlatforms: ['twitter', 'linkedin'],
        status: 'draft',
      }),
    });
    const createData = await createRes.json();
    if (createRes.status !== 201 || !createData.success || !createData.post) {
      throw new Error(`Create post failed: ${JSON.stringify(createData)}`);
    }
    postId = createData.post._id;
    console.log('   ✅ Post created successfully with ID:', postId);
    console.log('   📝 Title:', createData.post.title);
    console.log('   🏷️ Platforms:', createData.post.selectedPlatforms.join(', '));

    // 3. User A retrieves post by ID
    console.log('\n2️⃣ Testing Get Post by ID (GET /api/posts/:id)...');
    const getRes = await fetch(`${BASE_URL}/posts/${postId}`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const getData = await getRes.json();
    if (getRes.status === 200 && getData.post?.title === 'Exciting AI Announcement') {
      console.log('   ✅ Get post by ID verified for owner (User Alpha).');
    } else {
      throw new Error(`Get post failed: ${JSON.stringify(getData)}`);
    }

    // 4. User A updates post to scheduled
    console.log('\n3️⃣ Testing Update Post (PUT /api/posts/:id)...');
    const futureDate = new Date(Date.now() + 2 * 86400000).toISOString(); // 2 days in future
    const updateRes = await fetch(`${BASE_URL}/posts/${postId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        title: 'Updated AI Announcement Title',
        status: 'scheduled',
        scheduledAt: futureDate,
      }),
    });
    const updateData = await updateRes.json();
    if (updateRes.status === 200 && updateData.post?.status === 'scheduled') {
      console.log('   ✅ Post updated successfully. New status: scheduled, time:', updateData.post.scheduledAt);
    } else {
      throw new Error(`Update post failed: ${JSON.stringify(updateData)}`);
    }

    // 5. User A gets post list
    console.log('\n4️⃣ Testing List Posts (GET /api/posts)...');
    const listRes = await fetch(`${BASE_URL}/posts?status=scheduled`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const listData = await listRes.json();
    if (listRes.status === 200 && listData.posts?.length > 0) {
      console.log('   ✅ User Alpha post feed retrieved with stats. Total posts:', listData.total);
    } else {
      throw new Error(`List posts failed: ${JSON.stringify(listData)}`);
    }

    // 6. Security & Ownership Check: User B attempts to access User A's post
    console.log('\n5️⃣ Testing Ownership Isolation: User Beta tries to read User Alpha post...');
    const bGetRes = await fetch(`${BASE_URL}/posts/${postId}`, {
      headers: { 'Authorization': `Bearer ${tokenB}` },
    });
    const bGetData = await bGetRes.json();
    if (bGetRes.status === 404 && !bGetData.success) {
      console.log('   🔒 Security check passed: User Beta denied access to User Alpha post (HTTP 404).');
    } else {
      throw new Error(`Security breach: User Beta was able to view User Alpha post! Status: ${bGetRes.status}`);
    }

    // 7. Security Check: User B attempts to delete User A's post
    console.log('\n6️⃣ Testing Ownership Isolation: User Beta tries to delete User Alpha post...');
    const bDelRes = await fetch(`${BASE_URL}/posts/${postId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenB}` },
    });
    if (bDelRes.status === 404) {
      console.log('   🔒 Security check passed: User Beta cannot delete User Alpha post (HTTP 404).');
    } else {
      throw new Error(`Security breach: User Beta was able to delete User Alpha post! Status: ${bDelRes.status}`);
    }

    // 8. User A deletes post
    console.log('\n7️⃣ Testing Delete Post (DELETE /api/posts/:id)...');
    const delRes = await fetch(`${BASE_URL}/posts/${postId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const delData = await delRes.json();
    if (delRes.status === 200 && delData.success) {
      console.log('   ✅ User Alpha successfully deleted their post.');
    } else {
      throw new Error(`Delete post failed: ${JSON.stringify(delData)}`);
    }

    // 9. Dashboard stats verification
    console.log('\n8️⃣ Testing Dashboard Stats (GET /api/dashboard/stats)...');
    const dashRes = await fetch(`${BASE_URL}/dashboard/stats`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const dashData = await dashRes.json();
    if (dashRes.status === 200 && dashData.success && dashData.stats) {
      console.log('   ✅ Dashboard stats returned:', JSON.stringify(dashData.stats));
    } else {
      throw new Error(`Dashboard stats failed: ${JSON.stringify(dashData)}`);
    }

    console.log('\n🎉 ALL 8 POST CRUD & OWNERSHIP ISOLATION TESTS PASSED WITH 100% SUCCESS!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exitCode = 1;
  } finally {
    // Cleanup test users and posts
    if (userA) await User.findByIdAndDelete(userA._id);
    if (userB) await User.findByIdAndDelete(userB._id);
    if (postId) await Post.findByIdAndDelete(postId);
    await mongoose.connection.close();
    console.log('🧹 Cleaned up test data.');
  }
};

runPostTests();
