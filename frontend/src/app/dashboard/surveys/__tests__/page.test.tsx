import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SurveysPage from '../page';

jest.mock('@/lib/api', () => ({
  api: {
    surveys: {
      stats: jest.fn(),
      list: jest.fn(),
      send: jest.fn(),
      simulateRating: jest.fn(),
      simulateScan: jest.fn(),
    },
  },
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/dashboard/surveys',
}));

import { api } from '@/lib/api';
const mockStats = api.surveys.stats as jest.Mock;
const mockList = api.surveys.list as jest.Mock;
const mockSend = api.surveys.send as jest.Mock;

const mockStatsData = {
  total: 25,
  sentToday: 5,
  sentThisWeek: 12,
  sentThisMonth: 25,
  responded: 18,
  responseRate: 72,
  avgRating: 4.2,
};

const mockSurveys = [
  {
    id: 's1',
    restaurantId: 'rest1',
    customerId: 'c1',
    channel: 'manual',
    rating: 4,
    feedback: 'Great food!',
    status: 'rated',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:30:00Z',
    customer: { id: 'c1', phone: '+919876543210', name: 'Amit Patel' },
  },
  {
    id: 's2',
    restaurantId: 'rest1',
    customerId: 'c2',
    channel: 'manual',
    rating: null,
    feedback: null,
    status: 'sent',
    createdAt: '2024-01-15T09:00:00Z',
    updatedAt: '2024-01-15T09:00:00Z',
    customer: { id: 'c2', phone: '+919876543211', name: 'Priya Shah' },
  },
];

describe('SurveysPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStats.mockResolvedValue(mockStatsData);
    mockList.mockResolvedValue({ surveys: mockSurveys, total: 2 });
  });

  it('renders stats cards (sent today, response rate, etc.)', async () => {
    render(<SurveysPage />);

    await waitFor(() => {
      expect(screen.getByText('Sent Today')).toBeInTheDocument();
    });
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Response Rate')).toBeInTheDocument();
    expect(screen.getByText('72%')).toBeInTheDocument();
    expect(screen.getByText('This Week')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('renders send survey form', async () => {
    render(<SurveysPage />);

    await waitFor(() => {
      expect(screen.getByText('Send Test Survey')).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText(/\+91 98765 43210/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/amit patel/i)).toBeInTheDocument();
    expect(screen.getByText('Send Survey')).toBeInTheDocument();
  });

  it('shows survey list with status badges', async () => {
    render(<SurveysPage />);

    await waitFor(() => {
      expect(screen.getByText('Amit Patel')).toBeInTheDocument();
    });
    expect(screen.getByText('Priya Shah')).toBeInTheDocument();
    expect(screen.getByText('rated')).toBeInTheDocument();
    expect(screen.getByText('sent')).toBeInTheDocument();
  });

  it('has simulate rating UI for unrated surveys', async () => {
    render(<SurveysPage />);

    await waitFor(() => {
      expect(screen.getByText('Simulate Rating')).toBeInTheDocument();
    });
  });

  it('sends survey when form is submitted', async () => {
    const user = userEvent.setup();
    mockSend.mockResolvedValueOnce({
      surveyId: 's3',
      messageId: 'msg1',
      simulated: true,
      phone: '+919876543212',
      status: 'sent',
    });

    render(<SurveysPage />);

    await waitFor(() => {
      expect(screen.getByText('Send Survey')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/\+91 98765 43210/), '+919876543212');
    await user.click(screen.getByText('Send Survey'));

    await waitFor(() => {
      expect(mockSend).toHaveBeenCalledWith('+919876543212', undefined);
    });
  });
});
