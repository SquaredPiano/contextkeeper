import { Connection, PublicKey, clusterApiUrl, LAMPORTS_PER_SOL } from '@solana/web3.js';

export class SolanaService {
  private connection: Connection;
  private publicKey: PublicKey | null = null;

  constructor(endpoint: string = clusterApiUrl('devnet')) {
    this.connection = new Connection(endpoint, 'confirmed');
  }

  public async connect(publicKeyString: string): Promise<void> {
    try {
      this.publicKey = new PublicKey(publicKeyString);
      console.log(`[Solana] Connected to wallet: ${this.publicKey.toBase58()}`);
    } catch (error) {
      console.error('[Solana] Invalid public key', error);
      throw new Error('Invalid public key');
    }
  }

  public async getBalance(): Promise<number> {
    if (!this.publicKey) {
      throw new Error('Wallet not connected');
    }
    const balance = await this.connection.getBalance(this.publicKey);
    return balance / LAMPORTS_PER_SOL;
  }

  public isConnected(): boolean {
    return !!this.publicKey;
  }
}
