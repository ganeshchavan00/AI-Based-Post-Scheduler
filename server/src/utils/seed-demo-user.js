import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const seed = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_social_scheduler';
  await mongoose.connect(uri);

  const demoEmail = 'student@ai-scheduler.edu';
  const existing = await User.findOne({ email: demoEmail });

  if (existing) {
    console.log(`ℹ️ Demo user (${demoEmail}) already exists in database.`);
  } else {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Student@1234', salt);
    const user = await User.create({
      name: 'Student Developer',
      email: demoEmail,
      passwordHash,
    });
    console.log(`✅ Demo user seeded successfully: ${user.name} (${user.email})`);
  }

  await mongoose.connection.close();
};

seed().catch(console.error);
