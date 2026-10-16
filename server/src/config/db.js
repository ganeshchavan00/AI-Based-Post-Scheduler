import mongoose from 'mongoose';

/**
 * Connect to MongoDB instance (Atlas or local) with error handling & event hooks
 */
export const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_social_scheduler';
  
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of hanging
    });

    console.log(`🍃 MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    console.warn('⚠️ Server will continue running, but database operations will fail until MongoDB is connected.');
    console.warn('👉 For MongoDB Atlas, please set MONGODB_URI in server/.env with your cluster connection string.');
    return null;
  }
};

// Monitor Mongoose connection events
mongoose.connection.on('connected', () => {
  console.log('🍃 Mongoose event: Connected to MongoDB.');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose event error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ Mongoose event: Disconnected from MongoDB.');
});

/**
 * Helper to get active database health details
 */
export const getDBHealth = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const stateCode = mongoose.connection.readyState;
  const isConnected = stateCode === 1;

  return {
    state: states[stateCode] || 'unknown',
    isConnected,
    host: isConnected ? mongoose.connection.host : null,
    name: isConnected ? mongoose.connection.name : null,
    port: isConnected ? mongoose.connection.port : null,
  };
};

export default connectDB;
