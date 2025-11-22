import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SolanaService } from './solana';
import { Connection, PublicKey } from '@solana/web3.js';

// Mock @solana/web3.js
vi.mock('@solana/web3.js', () => {
  const ConnectionMock = vi.fn();
  ConnectionMock.prototype.getBalance = vi.fn();
  
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
});
