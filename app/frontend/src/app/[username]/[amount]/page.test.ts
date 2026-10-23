import { describe, expect, it } from 'vitest';
import { generateMetadata } from './page';

describe('payment-link metadata', () => {
  it('generates the expected title and description from route params', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ username: 'yourname', amount: '50' }),
      searchParams: Promise.resolve({ asset: 'USDC' }),
    });

    expect(metadata.title).toBe('Send 50 USDC to yourname via QuickEx');
    expect(metadata.description).toBe(
      'Click to pay instantly on the Stellar network. No sign-up required.'
    );
    expect(metadata.twitter?.card).toBe('summary_large_image');
  });
});