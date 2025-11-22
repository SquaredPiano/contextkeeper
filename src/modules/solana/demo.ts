import { SolanaService } from './solana';

async function demo() {
  console.log('◎ Solana Module Demo\n');

  const service = new SolanaService(); // Connects to devnet
  
  // A random public key on Solana (Foundation's vote account or similar, or a random one)
  // Let's use a known active address or just a random one.
  // This is a random address from explorer.solana.com
  const demoKey = '5YNmS1R9nNSCDzb5a7mMJ1dwK9uHeAAF4CmPEwKgV78A'; 
  
  console.log(`Connecting to Devnet...`);
  await service.connect(demoKey);
  
  console.log(`Connected to wallet: ${demoKey}`);
  
  try {
    console.log('Fetching balance...');
    const balance = await service.getBalance();
    console.log(`Balance: ${balance} SOL`);
  } catch (err) {
    console.error('Failed to fetch balance:', err);
  }
  
  console.log('\n✓ Demo complete');
}

demo();
