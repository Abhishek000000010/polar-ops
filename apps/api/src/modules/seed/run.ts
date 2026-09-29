import 'dotenv/config';
import { connectDB, disconnectDB } from '../../core/db';
import { resetAndSeedDatabase } from './service';

async function main() {
  console.log('[Seed CLI] Initializing database connection...');
  await connectDB();
  console.log('[Seed CLI] Running deterministic seed generator (Seed 47)...');
  const res = await resetAndSeedDatabase('CLI Seed Runner');
  console.log('[Seed CLI] Seed finished successfully:', res);
  await disconnectDB();
  process.exit(0);
}

main().catch(err => {
  console.error('[Seed CLI] Failed:', err);
  process.exit(1);
});
