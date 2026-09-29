import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import { initClock } from './clock';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

let memoryServer: any = null;

export async function connectDB(): Promise<typeof mongoose> {
  const isCustomUri = Boolean(process.env.MONGODB_URI);
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/polar-ops';
  const sanitizedUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');

  try {
    // For remote cloud URIs (like MongoDB Atlas), allow sufficient handshake time (15s); for localhost fallback, 2.5s
    const timeout = isCustomUri ? 15000 : 2500;
    await mongoose.connect(uri, { serverSelectionTimeoutMS: timeout });
    console.log(`[DB] Connected successfully to MongoDB at ${sanitizedUri}`);
  } catch (err: any) {
    console.warn(`[DB] Could not connect to external MongoDB at ${sanitizedUri}: ${err.message}. Launching local embedded MongoMemoryServer...`);
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
