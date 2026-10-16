import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Post from '../models/Post.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const seedPost = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_social_scheduler';
  await mongoose.connect(uri);

  const student = await User.findOne({ email: 'student@ai-scheduler.edu' });
  if (!student) {
    console.error('Demo student not found. Run seed-demo-user first.');
    return;
  }

  // Check if student already has posts
  const count = await Post.countDocuments({ userId: student._id });
  if (count === 0) {
    await Post.create([
      {
        userId: student._id,
        title: 'B.Tech Mini Project Milestone Announcement',
        content: 'Thrilled to unveil our AI-Powered Social Media Post Scheduler! Designed and engineered with React 19, Tailwind CSS v4, Node.js, Express, and MongoDB Atlas. Features real-time AI caption generation and multi-platform preview.',
        hashtags: ['ComputerEngineering', 'FullStack', 'AI', 'MERN'],
        selectedPlatforms: ['twitter', 'linkedin'],
        status: 'scheduled',
        scheduledAt: new Date(Date.now() + 24 * 3600 * 1000), // Tomorrow
      },
      {
        userId: student._id,
        title: 'Weekly Tech Insights: React 19 & Vite 8',
        content: 'Vite 8 combined with React 19 provides lightning-fast HMR and microsecond build times for modern full-stack web applications. Have you migrated your projects yet?',
        hashtags: ['React19', 'Vite', 'Frontend'],
        selectedPlatforms: ['twitter'],
        status: 'draft',
      },
      {
        userId: student._id,
        title: 'Social Media Strategy in 2026',
        content: 'Consistency and contextual tone make all the difference. Leveraging AI for tailored audience engagement helps streamline multi-channel posting.',
        hashtags: ['Marketing', 'AI', 'Productivity'],
        selectedPlatforms: ['linkedin', 'facebook'],
        status: 'published',
        publishedAt: new Date(),
      },
    ]);
    console.log('✅ Seeded 3 diverse sample posts for demo student (Scheduled, Draft, Published).');
  } else {
    console.log(`ℹ️ Demo student already has ${count} post(s).`);
  }

  await mongoose.connection.close();
};

seedPost().catch(console.error);
