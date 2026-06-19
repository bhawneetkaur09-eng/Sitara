import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BillingPage from '../page';

jest.mock('@/lib/api', () => ({
  api: {
    billing: {
      getCurrent: jest.fn(),
      getPlans: jest.fn(),
      changePlan: jest.fn(),
    },
  },
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/dashboard/billing',
}));

import { api } from '@/lib/api';
const mockGetCurrent = api.billing.getCurrent as jest.Mock;
const mockGetPlans = api.billing.getPlans as jest.Mock;

const mockPlans = [
  {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 0,
    priceAnnual: 0,
    features: ['50 surveys/month', '1 location', 'Basic analytics'],
  },
  {
    id: 'growth',
    name: 'Growth',
    priceMonthly: 1999,
    priceAnnual: 19990,
    features: ['500 surveys/month', '3 locations', 'AI replies', 'Advanced analytics'],
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthly: 4999,
    priceAnnual: 49990,
    features: ['Unlimited surveys', '10 locations', 'Priority support', 'Custom integrations'],
  },
];

const mockBilling = {
  currentPlan: mockPlans[0],
  usage: { surveysThisMonth: 23, locations: 1 },
  billingCycle: 'monthly',
  nextBillingDate: '2024-02-15',
  paymentMethod: null,
};

describe('BillingPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrent.mockResolvedValue(mockBilling);
    mockGetPlans.mockResolvedValue(mockPlans);
  });

  it('renders current plan info', async () => {
    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Current Plan').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('Starter').length).toBeGreaterThan(0);
    expect(screen.getByText('23')).toBeInTheDocument();
  });

  it('renders 3 plan tiers', async () => {
    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('₹1999')).toBeInTheDocument();
    });
    expect(screen.getByText('₹4999')).toBeInTheDocument();
  });

  it('opens checkout modal on plan click', async () => {
    const user = userEvent.setup();
    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('Switch to Growth')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Switch to Growth'));

    await waitFor(() => {
      expect(screen.getByText('Subscribe to Growth')).toBeInTheDocument();
    });
  });

  it('shows payment method selection (UPI/Card)', async () => {
    const user = userEvent.setup();
    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('Switch to Growth')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Switch to Growth'));

    await waitFor(() => {
      expect(screen.getByText('UPI')).toBeInTheDocument();
      expect(screen.getByText('Card')).toBeInTheDocument();
    });
  });

  it('shows UPI ID input when UPI is selected', async () => {
    const user = userEvent.setup();
    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('Switch to Growth')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Switch to Growth'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/yourname@paytm/)).toBeInTheDocument();
    });
  });

  it('shows card form when Card is selected', async () => {
    const user = userEvent.setup();
    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('Switch to Growth')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Switch to Growth'));

    await waitFor(() => {
      expect(screen.getByText('Card')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Card'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/4111 1111 1111 1111/)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/MM\/YY/)).toBeInTheDocument();
    });
  });

  it('shows billing cycle toggle in modal', async () => {
    const user = userEvent.setup();
    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('Switch to Growth')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Switch to Growth'));

    await waitFor(() => {
      expect(screen.getByText(/Monthly/)).toBeInTheDocument();
      expect(screen.getByText(/Annual/)).toBeInTheDocument();
    });
  });
});
