import 'dotenv/config';
import { createApp } from './app';
import { connectDB } from './core/db';
import { resetAndSeedDatabase } from './modules/seed/service';
import { ExpeditionModel } from './modules/expeditions/model';

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  try {
    await connectDB();

    // Check if initial seed is needed
    const expCount = await ExpeditionModel.countDocuments();
    if (expCount === 0) {
      console.log('[Bootstrap] Empty database detected. Seeding baseline polar world...');
      await resetAndSeedDatabase('System Bootstrap');
    }

    const app = createApp();
    const portNumber = Number(PORT);
    app.listen(portNumber, '0.0.0.0', () => {
      console.log(`=======================================================`);
      console.log(`❄️  POLAR-OPS OPERATIONAL API READY ON PORT ${portNumber}`);
      console.log(`📡 Base API endpoint: http://0.0.0.0:${portNumber}/api/v1`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('[Bootstrap] Failed to start server:', err);
    process.exit(1);
  }
}

bootstrap();
