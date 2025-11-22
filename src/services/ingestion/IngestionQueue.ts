import { IStorageService, EventRecord, ActionRecord } from '../interfaces';
import { SessionManager } from '../../managers/SessionManager';

export type IngestionTask = 
  | { type: 'event'; data: Omit<EventRecord, 'id'> }
  | { type: 'action'; data: Omit<ActionRecord, 'id' | 'embedding'> };

export class IngestionQueue {
  private queue: IngestionTask[] = [];
  private isProcessing: boolean = false;
  private readonly BATCH_SIZE = 10;
  private readonly PROCESS_INTERVAL_MS = 500;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(
    private storage: IStorageService,
    private sessionManager: SessionManager
  ) {}

  public start(): void {
    if (this.processingInterval) { return; }
    this.processingInterval = setInterval(() => this.processQueue(), this.PROCESS_INTERVAL_MS);
  }

  public stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  public enqueue(task: IngestionTask): void {
    this.queue.push(task);
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) { return; }
    this.isProcessing = true;

    try {
      const batch = this.queue.splice(0, this.BATCH_SIZE);
      const batchSize = batch.length;
      
      console.log(`[IngestionQueue] Processing batch of ${batchSize} tasks (${this.queue.length} remaining in queue)`);
      
      // Process batch
      // Note: LanceDB might support batch inserts, but our interface might not.
      // For now, we'll process sequentially or in parallel promises.
      
      let successCount = 0;
      let errorCount = 0;
      
      const promises = batch.map(async (task) => {
        try {
          if (task.type === 'event') {
            await this.storage.logEvent(task.data);
            successCount++;
          } else if (task.type === 'action') {
            await this.storage.addAction(task.data);
            successCount++;
          }
        } catch (error) {
          errorCount++;
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`[IngestionQueue] Failed to process ingestion task (${task.type}): ${errorMsg}`, error);
          
          // Log task details for debugging
          if (task.type === 'event') {
            console.error(`[IngestionQueue] Failed event: ${task.data.event_type} - ${task.data.file_path}`);
          } else {
            console.error(`[IngestionQueue] Failed action: ${task.data.description}`);
          }
          
          // Optionally re-queue if it's a transient error, but be careful of infinite loops
        }
      });

      await Promise.all(promises);

      if (successCount > 0) {
        console.log(`[IngestionQueue] Successfully processed ${successCount}/${batchSize} tasks`);
      }
      if (errorCount > 0) {
        console.warn(`[IngestionQueue] Failed to process ${errorCount}/${batchSize} tasks`);
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[IngestionQueue] Error processing ingestion queue: ${errorMsg}`, error);
    } finally {
      this.isProcessing = false;
    }
  }
}
