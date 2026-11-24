import cron, { ScheduledTask } from 'node-cron';
import { syncAllActiveTenants } from './syncEngine.js';

let cronTask: ScheduledTask | null = null;

export function startSyncScheduler(): void {
  if (cronTask) {
    console.log('[Scheduler] Background sync scheduler already running.');
    return;
  }

  // Schedule to run every 60 seconds: */1 * * * *
  cronTask = cron.schedule('*/1 * * * *', async () => {
    try {
      const res = await syncAllActiveTenants();
      if (res.syncedCount > 0) {
        console.log(`[Scheduler] 60s Cron Sync completed: ${res.syncedCount} active tenants synced.`);
      }
      if (res.errors.length > 0) {
        console.warn(`[Scheduler] Cron Sync encountered ${res.errors.length} tenant errors:`, res.errors);
      }
    } catch (err) {
      console.error('[Scheduler] Unexpected error during sync cron job:', err);
    }
  });

  console.log('[Scheduler] Background Google Sheets sync scheduler initialized (cadence: 60s).');
}

export function stopSyncScheduler(): void {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    console.log('[Scheduler] Background sync scheduler stopped.');
  }
}
