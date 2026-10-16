import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { User, SocialAccount, Post } from '../models/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const testModels = async () => {
  console.log('🧪 Starting Database Models Verification Test...');
  await connectDB();

  try {
    // 1. Test User model creation and toJSON password suppression
    console.log('1️⃣ Testing User Schema...');
    const testEmail = `test_${Date.now()}@example.com`;
    const user = await User.create({
      name: 'Aditya Sharma',
      email: testEmail,
      passwordHash: '$2a$10$e8wVdK0.1983m4G87Zfakehashforverification',
    });
    console.log('   ✅ User created successfully with ID:', user._id);

    const userJson = user.toJSON();
    if (userJson.passwordHash) {
      throw new Error('Security flaw: passwordHash was not stripped from toJSON!');
    }
    console.log('   🔒 Security check passed: passwordHash is stripped in serialized output.');

    // 2. Test SocialAccount model creation
    console.log('2️⃣ Testing SocialAccount Schema...');
    const socialAccount = await SocialAccount.create({
      userId: user._id,
      provider: 'twitter',
      providerAccountId: 'tw_123456789',
      accountDisplayName: 'Aditya Sharma (Tech)',
      accountUsername: 'aditya_tech',
      connectionStatus: 'connected',
    });
    console.log('   ✅ SocialAccount created with ID:', socialAccount._id);

    // 3. Test Post model creation
    console.log('3️⃣ Testing Post Schema...');
    const post = await Post.create({
      userId: user._id,
      title: 'B.Tech Mini Project Launch',
      content: 'Excited to announce our AI-Powered Social Media Scheduler project built with React, Vite, Node, and MongoDB Atlas! #Tech #AI #FullStack',
      hashtags: ['Tech', 'AI', 'FullStack'],
      selectedPlatforms: ['twitter', 'linkedin'],
      status: 'scheduled',
      scheduledAt: new Date(Date.now() + 86400000), // Tomorrow
      mediaUrls: [
        {
          url: '/uploads/sample-diagram.png',
          filename: 'sample-diagram.png',
          mimeType: 'image/png',
          size: 1048576,
        },
      ],
    });
    console.log('   ✅ Post created with ID:', post._id);
    console.log('   📅 Post Scheduled for:', post.scheduledAt);

    // 4. Clean up test documents
    console.log('4️⃣ Cleaning up test records...');
    await Post.findByIdAndDelete(post._id);
    await SocialAccount.findByIdAndDelete(socialAccount._id);
    await User.findByIdAndDelete(user._id);
    console.log('   🧹 Test cleanup completed cleanly.');

    console.log('🎉 All 3 Mongoose Models (User, SocialAccount, Post) validated and working perfectly!');
  } catch (err) {
    console.error('❌ Model verification failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected test runner.');
  }
};

testModels();
