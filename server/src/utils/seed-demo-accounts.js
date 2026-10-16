import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import User from '../models/User.js';
import SocialAccount from '../models/SocialAccount.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const seedAccounts = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_social_scheduler';
  await mongoose.connect(uri);

  const student = await User.findOne({ email: 'student@ai-scheduler.edu' });
  if (!student) {
    console.error('Demo student not found.');
    return;
  }

  const existingCount = await SocialAccount.countDocuments({ userId: student._id });
  if (existingCount === 0) {
    await SocialAccount.create([
      {
        userId: student._id,
        provider: 'twitter',
        providerAccountId: 'tw_student_dev',
        accountDisplayName: 'Student Dev (@student_dev)',
        accountUsername: 'student_dev',
        isSimulated: true,
        connectionStatus: 'connected',
        lastSyncAt: new Date(),
      },
      {
        userId: student._id,
        provider: 'linkedin',
        providerAccountId: 'li_student_developer',
        accountDisplayName: 'Student Developer (Computer Engineering)',
        accountUsername: 'student-dev-profile',
        isSimulated: true,
        connectionStatus: 'connected',
        lastSyncAt: new Date(),
      },
    ]);
    console.log('✅ Seeded Twitter & LinkedIn connected accounts for demo student.');
  } else {
    console.log(`ℹ️ Demo student already has ${existingCount} social account(s).`);
  }

  await mongoose.connection.close();
};

seedAccounts().catch(console.error);
