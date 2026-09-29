import mongoose from 'mongoose';
import { initClock } from './clock';

let memoryServer: any = null;

export async function connectDB(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/polar-ops';

  try {
    // Attempt connecting to specified URI with a short timeout
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
    console.log(`[DB] Connected successfully to MongoDB at ${uri}`);
  } catch (err: any) {
    console.warn(`[DB] Could not connect to external MongoDB at ${uri}. Launching local embedded MongoMemoryServer...`);
    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      memoryServer = await MongoMemoryServer.create();
      const memUri = memoryServer.getUri();
      await mongoose.connect(memUri);
      console.log(`[DB] Connected successfully to embedded MongoMemoryServer at ${memUri}`);
    } catch (memErr) {
      console.error('[DB] Critical: Failed to launch MongoMemoryServer', memErr);
      throw memErr;
    }
  }

  // Initialize clock after DB is up
  await initClock();
  return mongoose;
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
  }
}
