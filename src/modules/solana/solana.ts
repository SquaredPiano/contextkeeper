import { Connection, PublicKey, clusterApiUrl, LAMPORTS_PER_SOL, ParsedTransactionWithMeta } from '@solana/web3.js';

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
    try {
      const balance = await this.connection.getBalance(this.publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error('[Solana] Failed to get balance', error);
      throw new Error('Failed to get balance');
    }
  }

  public async requestAirdrop(amount: number = 1): Promise<string> {
    if (!this.publicKey) {
      throw new Error('Wallet not connected');
    }
    try {
      console.log(`[Solana] Requesting airdrop of ${amount} SOL...`);
      const signature = await this.connection.requestAirdrop(
        this.publicKey,
        amount * LAMPORTS_PER_SOL
      );
      await this.connection.confirmTransaction(signature);
      console.log(`[Solana] Airdrop successful: ${signature}`);
      return signature;
    } catch (error) {
      console.error('[Solana] Airdrop failed', error);
      throw new Error('Airdrop failed');
    }
  }

  public async getRecentTransactions(limit: number = 5): Promise<ParsedTransactionWithMeta[]> {
    if (!this.publicKey) {
      throw new Error('Wallet not connected');
    }
    try {
      const signatures = await this.connection.getSignaturesForAddress(
        this.publicKey,
        { limit }
      );
      
      const transactions = await this.connection.getParsedTransactions(
        signatures.map(s => s.signature)
      );

      return transactions.filter((t): t is ParsedTransactionWithMeta => t !== null);
    } catch (error) {
      console.error('[Solana] Failed to get transactions', error);
      throw new Error('Failed to get transactions');
    }
  }

  public isConnected(): boolean {
    return !!this.publicKey;
  }
}
