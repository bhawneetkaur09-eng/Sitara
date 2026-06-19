import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AlertsPage from '../page';

jest.mock('@/lib/api', () => ({
  api: {
    alerts: {
      list: jest.fn(),
      count: jest.fn(),
      resolve: jest.fn(),
    },
  },
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/dashboard/alerts',
}));

import { api } from '@/lib/api';
const mockList = api.alerts.list as jest.Mock;
const mockResolve = api.alerts.resolve as jest.Mock;

const mockAlerts = [
  {
    id: 'a1',
    restaurantId: 'rest1',
    surveyId: 's1',
    rating: 2,
    reason: 'Cold food',
    tableOrSource: 'Table 5',
    customerPhone: '+919876543210',
    status: 'open',
    resolveNote: null,
    createdAt: '2024-01-15T10:00:00Z',
    resolvedAt: null,
  },
  {
    id: 'a2',
    restaurantId: 'rest1',
    surveyId: 's2',
    rating: 1,
    reason: 'Rude staff',
    tableOrSource: 'Table 3',
    customerPhone: null,
    status: 'resolved',
    resolveNote: 'Spoke with staff and apologized.',
    createdAt: '2024-01-14T10:00:00Z',
    resolvedAt: '2024-01-14T12:00:00Z',
  },
];

describe('AlertsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockList.mockResolvedValue(mockAlerts);
  });

  it('renders alert list', async () => {
    render(<AlertsPage />);

    await waitFor(() => {
      expect(screen.getByText('2-star rating')).toBeInTheDocument();
      expect(screen.getByText('1-star rating')).toBeInTheDocument();
    });
  });

  it('shows filter tabs (All, Open, Resolved)', async () => {
    render(<AlertsPage />);

    await waitFor(() => {
      expect(screen.getByText('All')).toBeInTheDocument();
    });
    expect(screen.getByText(/open/i)).toBeInTheDocument();
    expect(screen.getByText(/resolved/i)).toBeInTheDocument();
  });

  it('shows resolve form with note textarea', async () => {
    const user = userEvent.setup();
    render(<AlertsPage />);

    await waitFor(() => {
      expect(screen.getByText('2-star rating')).toBeInTheDocument();
    });

    const resolveButtons = screen.getAllByText('Resolve');
    await user.click(resolveButtons[0]);

    expect(screen.getByPlaceholderText(/what action did you take/i)).toBeInTheDocument();
  });

  it('shows recovery nudge checkbox for alerts with phone', async () => {
    const user = userEvent.setup();
    render(<AlertsPage />);

    await waitFor(() => {
      expect(screen.getByText('2-star rating')).toBeInTheDocument();
    });

    const resolveButtons = screen.getAllByText('Resolve');
    await user.click(resolveButtons[0]);

    expect(screen.getByText(/send them a google review link/i)).toBeInTheDocument();
  });

  it('calls resolve API with note and nudge setting', async () => {
    const user = userEvent.setup();
    mockResolve.mockResolvedValueOnce({ ...mockAlerts[0], status: 'resolved', resolveNote: 'Fixed' });
    mockList
      .mockResolvedValueOnce(mockAlerts)
      .mockResolvedValueOnce([]);

    render(<AlertsPage />);

    await waitFor(() => {
      expect(screen.getByText('2-star rating')).toBeInTheDocument();
    });

    const resolveButtons = screen.getAllByText('Resolve');
    await user.click(resolveButtons[0]);

    const textarea = screen.getByPlaceholderText(/what action did you take/i);
    await user.type(textarea, 'Apologized to customer');

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    const submitResolve = screen.getAllByText('Resolve');
    await user.click(submitResolve[0]);

    await waitFor(() => {
      expect(mockResolve).toHaveBeenCalledWith('a1', 'Apologized to customer', true);
    });
  });

  it('shows reason for alert', async () => {
    render(<AlertsPage />);

    await waitFor(() => {
      expect(screen.getByText(/reason: cold food/i)).toBeInTheDocument();
      expect(screen.getByText(/reason: rude staff/i)).toBeInTheDocument();
    });
  });
});
