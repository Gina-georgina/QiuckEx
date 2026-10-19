import { render, screen } from '@testing-library/react';
import EarningsCard from '../src/components/EarningsCard';

describe('EarningsCard', () => {
  it('shows 0.00 USDC when there are no transactions', () => {
    render(<EarningsCard transactions={[]} />);

    expect(screen.getByText('0.00 USDC')).toBeInTheDocument();
  });
});
