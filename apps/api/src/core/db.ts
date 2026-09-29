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

  if (isCustomUri) {
    // Explicit cloud database URI (e.g. MongoDB Atlas)
    console.log(`[DB] Connecting to MongoDB Atlas at ${sanitizedUri}...`);
    let lastErr: any = null;

    // Retry up to 3 times with exponential backoff for cloud network handshakes
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await mongoose.connect(uri, {
          serverSelectionTimeoutMS: 15000,
          connectTimeoutMS: 15000
        });
        console.log(`[DB] Connected successfully to MongoDB at ${sanitizedUri}`);
        await initClock();
        return mongoose;
      } catch (err: any) {
        lastErr = err;
        console.warn(`[DB] Connection attempt ${attempt}/3 failed: ${err.message}`);
        if (attempt < 3) {
          await new Promise(res => setTimeout(res, 2000 * attempt));
        }
      }
    }

    console.error(`\n================================================================`);
    console.error(`[DB] CRITICAL: Failed to connect to MongoDB Atlas after 3 attempts.`);
    console.error(`[DB] Reason: ${lastErr?.message}`);
    console.error(`[DB] MongoDB Atlas Network Access whitelist must allow 0.0.0.0/0`);
    console.error(`================================================================\n`);
    throw lastErr;
  }

  // Local development fallback when no MONGODB_URI is provided
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 2500 });
    console.log(`[DB] Connected successfully to local MongoDB at ${sanitizedUri}`);
  } catch (err: any) {
    console.warn(`[DB] Could not connect to local MongoDB. Launching MongoMemoryServer...`);
    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      memoryServer = await MongoMemoryServer.create({
        binary: { version: '7.0.3' }
      });
      const memUri = memoryServer.getUri();
      await mongoose.connect(memUri);
      console.log(`[DB] Connected to embedded MongoMemoryServer at ${memUri}`);
    } catch (memErr) {
      console.error('[DB] Failed to launch MongoMemoryServer', memErr);
      throw memErr;
    }
  }

  await initClock();
  return mongoose;
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
  }
}
