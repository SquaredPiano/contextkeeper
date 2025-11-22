import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SolanaService } from './solana';
import { Connection, PublicKey } from '@solana/web3.js';

// Mock @solana/web3.js
vi.mock('@solana/web3.js', () => {
  const ConnectionMock = vi.fn();
  ConnectionMock.prototype.getBalance = vi.fn();
  ConnectionMock.prototype.requestAirdrop = vi.fn();
  ConnectionMock.prototype.confirmTransaction = vi.fn();
  ConnectionMock.prototype.getSignaturesForAddress = vi.fn();
  ConnectionMock.prototype.getParsedTransactions = vi.fn();
  
  // PublicKey needs to be a class/constructor
  const PublicKeyMock = vi.fn(function(this: any, key: string) {
    this.toBase58 = () => key;
  });

  return {
    Connection: ConnectionMock,
    PublicKey: PublicKeyMock,
    clusterApiUrl: vi.fn(() => 'https://api.devnet.solana.com'),
    LAMPORTS_PER_SOL: 1000000000,
  };
});

describe('SolanaService', () => {
  let service: SolanaService;
  let connectionMock: any;

  beforeEach(() => {
    service = new SolanaService();
    // Get the mock instance from the service
    connectionMock = (service as any).connection;
  });

  it('should initialize with devnet by default', () => {
    expect(service).toBeDefined();
    expect((service as any).connection).toBeDefined();
  });

  it('should connect to a valid wallet', async () => {
    const validKey = 'Hit3Y6p9CqX8...'; // Simplified key
    await service.connect(validKey);
    expect(service.isConnected()).toBe(true);
  });

  it('should throw error for invalid wallet key', async () => {
    // Mock PublicKey constructor to throw for this test case if needed,
    // but our simple mock accepts strings. 
    // Let's simulate the error by mocking the implementation of PublicKey for this test.
    const PublicKeyMock = vi.mocked(PublicKey);
    PublicKeyMock.mockImplementationOnce(function() {
      throw new Error('Invalid public key');
    });

    await expect(service.connect('invalid-key')).rejects.toThrow('Invalid public key');
    expect(service.isConnected()).toBe(false);
  });

  it('should get balance in SOL', async () => {
    const validKey = 'Hit3Y6p9CqX8...';
    await service.connect(validKey);

    // Mock balance response (in lamports)
    connectionMock.getBalance.mockResolvedValue(1500000000); // 1.5 SOL

    const balance = await service.getBalance();
    expect(balance).toBe(1.5);
    expect(connectionMock.getBalance).toHaveBeenCalled();
  });

  it('should throw when getting balance without connection', async () => {
    await expect(service.getBalance()).rejects.toThrow('Wallet not connected');
  });

  it('should request airdrop', async () => {
    const validKey = 'Hit3Y6p9CqX8...';
    await service.connect(validKey);

    connectionMock.requestAirdrop.mockResolvedValue('signature123');
    connectionMock.confirmTransaction.mockResolvedValue(undefined);

    const signature = await service.requestAirdrop(2);
    expect(signature).toBe('signature123');
    expect(connectionMock.requestAirdrop).toHaveBeenCalledWith(expect.any(Object), 2000000000);
    expect(connectionMock.confirmTransaction).toHaveBeenCalledWith('signature123');
  });

  it('should get recent transactions', async () => {
    const validKey = 'Hit3Y6p9CqX8...';
    await service.connect(validKey);

    connectionMock.getSignaturesForAddress.mockResolvedValue([
      { signature: 'sig1' }, { signature: 'sig2' }
    ]);
    connectionMock.getParsedTransactions.mockResolvedValue([
      { transaction: { signatures: ['sig1'] } },
      { transaction: { signatures: ['sig2'] } }
    ]);

    const txs = await service.getRecentTransactions(2);
    expect(txs).toHaveLength(2);
    expect(connectionMock.getSignaturesForAddress).toHaveBeenCalled();
    expect(connectionMock.getParsedTransactions).toHaveBeenCalledWith(['sig1', 'sig2']);
  });
});
