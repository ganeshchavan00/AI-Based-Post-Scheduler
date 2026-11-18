import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const LOCAL_URI = 'mongodb://localhost:27017/ai_social_scheduler';
const TARGET_URI = process.env.TARGET_MONGODB_URI || process.argv[2];

async function migrateData() {
  console.log('====================================================');
  console.log('🚀 MONGODB ATLAS SAFE NON-DESTRUCTIVE DATA MIGRATION');
  console.log('====================================================\n');

  if (!TARGET_URI || TARGET_URI === LOCAL_URI) {
    console.error('❌ Error: Target MongoDB Atlas connection string is required.');
    console.log('👉 Usage: node src/utils/migrate-to-atlas.js "mongodb+srv://<user>:<password>@cluster.mongodb.net/ai_social_scheduler?retryWrites=true&w=majority"');
    console.log('   or set TARGET_MONGODB_URI in server/.env\n');
    process.exit(1);
  }

  console.log('1️⃣ Connecting to Local MongoDB source:');
  console.log(`   Source URI: ${LOCAL_URI}`);
  const localConn = await mongoose.createConnection(LOCAL_URI, { serverSelectionTimeoutMS: 5000 }).asPromise();
  console.log('   ✅ Connected to local database.\n');

  console.log('2️⃣ Connecting to Target MongoDB Atlas destination:');
  const maskedTarget = TARGET_URI.replace(/:([^@]+)@/, ':****@');
  console.log(`   Destination: ${maskedTarget}`);
  const targetConn = await mongoose.createConnection(TARGET_URI, { serverSelectionTimeoutMS: 10000 }).asPromise();
  console.log('   ✅ Connected to MongoDB Atlas destination.\n');

  const collectionsToMigrate = ['users', 'socialaccounts', 'posts'];
  const migrationSummary = {};

  console.log('3️⃣ Migrating Collections (Non-destructive Upsert Mode)...');

  for (const collName of collectionsToMigrate) {
    const localCollection = localConn.collection(collName);
    const targetCollection = targetConn.collection(collName);

    const localDocs = await localCollection.find({}).toArray();
    const localCount = localDocs.length;
    console.log(`\n📦 Collection: [${collName}]`);
    console.log(`   • Source count: ${localCount} documents`);

    if (localCount === 0) {
      console.log(`   • Skipping empty collection [${collName}].`);
      migrationSummary[collName] = { source: 0, target: 0, migrated: 0 };
      continue;
    }

    let upsertedCount = 0;
    for (const doc of localDocs) {
      await targetCollection.replaceOne({ _id: doc._id }, doc, { upsert: true });
      upsertedCount++;
    }

    const targetCount = await targetCollection.countDocuments();
    console.log(`   • Target count after migration: ${targetCount} documents`);
    console.log(`   ✅ Successfully migrated ${upsertedCount} documents to Atlas.`);

    migrationSummary[collName] = {
      source: localCount,
      target: targetCount,
      migrated: upsertedCount,
    };
  }

  // Create necessary indexes on target Atlas database
  console.log('\n4️⃣ Creating Indexes on Atlas...');
  try {
    await targetConn.collection('users').createIndex({ email: 1 }, { unique: true });
    await targetConn.collection('socialaccounts').createIndex({ userId: 1, provider: 1, providerAccountId: 1 }, { unique: true });
    await targetConn.collection('posts').createIndex({ userId: 1, createdAt: -1 });
    await targetConn.collection('posts').createIndex({ status: 1, scheduledAt: 1 });
    console.log('   ✅ Target database indexes ensured successfully.');
  } catch (idxErr) {
    console.warn('   ⚠️ Index creation note:', idxErr.message);
  }

  console.log('\n====================================================');
  console.log('🎉 MIGRATION COMPLETED SUCCESSFULLY');
  console.log('====================================================');
  console.table(migrationSummary);

  await localConn.close();
  await targetConn.close();
  console.log('🔌 Connections closed cleanly. Local database untouched.\n');
}

migrateData().catch((err) => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
