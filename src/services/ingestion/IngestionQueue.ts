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
      
      // Process batch
      // Note: LanceDB might support batch inserts, but our interface might not.
      // For now, we'll process sequentially or in parallel promises.
      
      const promises = batch.map(async (task) => {
        try {
          if (task.type === 'event') {
            await this.storage.logEvent(task.data);
          } else if (task.type === 'action') {
            await this.storage.addAction(task.data);
          }
        } catch (error) {
          console.error(`Failed to process ingestion task (${task.type}):`, error);
          // Optionally re-queue if it's a transient error, but be careful of infinite loops
        }
      });

      await Promise.all(promises);

    } catch (error) {
      console.error('Error processing ingestion queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }
}
