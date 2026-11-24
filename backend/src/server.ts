import { createApp } from './app.js';
import { config } from './config/index.js';
import { startSyncScheduler } from './services/scheduler.js';

const app = createApp();

app.listen(config.port, () => {
  console.log(`[Server] Lead Follow-Up API running on port ${config.port} (${config.nodeEnv})`);
  startSyncScheduler();
});

