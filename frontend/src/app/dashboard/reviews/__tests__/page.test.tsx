import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReviewsPage from '../page';

jest.mock('@/lib/api', () => ({
  api: {
    reviews: {
      list: jest.fn(),
      stats: jest.fn(),
      reply: jest.fn(),
      draftReply: jest.fn(),
      sync: jest.fn(),
    },
  },
}));

jest.mock('@/hooks/use-plan-features', () => ({
  usePlanFeatures: () => ({
    hasFeature: (f: string) => f === 'ai_reply',
    features: { features: ['ai_reply'], plan: 'growth', limits: { surveysPerMonth: 500, locations: 3 } },
    loading: false,
    plan: 'growth',
  }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/dashboard/reviews',
}));

import { api } from '@/lib/api';
const mockList = api.reviews.list as jest.Mock;
const mockDraftReply = api.reviews.draftReply as jest.Mock;

const mockReviews = [
  {
    id: 'r1',
    restaurantId: 'rest1',
    source: 'google',
    author: 'Amit Patel',
    rating: 5,
    text: 'Amazing food and great service!',
    language: 'en',
    sentiment: 'positive',
    postedAt: '2024-01-15T10:00:00Z',
    replied: false,
    replyText: null,
    repliedAt: null,
  },
  {
    id: 'r2',
    restaurantId: 'rest1',
    source: 'facebook',
    author: 'Priya Shah',
    rating: 2,
    text: 'Food was cold and service was slow.',
    language: 'en',
    sentiment: 'negative',
    postedAt: '2024-01-14T10:00:00Z',
    replied: true,
    replyText: 'We apologize for the experience.',
    repliedAt: '2024-01-14T12:00:00Z',
  },
  {
    id: 'r3',
    restaurantId: 'rest1',
    source: 'whatsapp',
    author: 'Rahul Kumar',
    rating: 4,
    text: 'Good biryani, will come again.',
    language: 'en',
    sentiment: 'positive',
    postedAt: '2024-01-13T10:00:00Z',
    replied: false,
    replyText: null,
    repliedAt: null,
  },
];

describe('ReviewsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockList.mockResolvedValue({ reviews: mockReviews, total: 3 });
  });

  it('renders reviews list', async () => {
    render(<ReviewsPage />);

    await waitFor(() => {
      expect(screen.getByText('Amit Patel')).toBeInTheDocument();
      expect(screen.getByText('Priya Shah')).toBeInTheDocument();
      expect(screen.getByText('Rahul Kumar')).toBeInTheDocument();
    });
  });

  it('shows source filter tabs (All, Google, Facebook, WhatsApp)', async () => {
    render(<ReviewsPage />);

    await waitFor(() => {
      expect(screen.getByText('All')).toBeInTheDocument();
    });
    expect(screen.getByText('Google')).toBeInTheDocument();
    expect(screen.getByText('Facebook')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
  });

  it('renders source badges on reviews', async () => {
    render(<ReviewsPage />);

    await waitFor(() => {
      expect(screen.getByText('Amit Patel')).toBeInTheDocument();
    });

    const googleBadges = screen.getAllByText('Google');
    expect(googleBadges.length).toBeGreaterThan(0);
  });

  it('opens reply form on Reply button click', async () => {
    const user = userEvent.setup();
    render(<ReviewsPage />);

    await waitFor(() => {
      expect(screen.getByText('Amit Patel')).toBeInTheDocument();
    });

    const replyButtons = screen.getAllByText('Reply');
    await user.click(replyButtons[0]);

    expect(screen.getByPlaceholderText(/write your reply/i)).toBeInTheDocument();
    expect(screen.getByText('Post Reply')).toBeInTheDocument();
  });

  it('shows "Draft with AI" button', async () => {
    render(<ReviewsPage />);

    await waitFor(() => {
      expect(screen.getByText('Amit Patel')).toBeInTheDocument();
    });

    const draftButtons = screen.getAllByText('Draft with AI');
    expect(draftButtons.length).toBeGreaterThan(0);
  });

  it('calls draftReply when Draft with AI is clicked', async () => {
    const user = userEvent.setup();
    mockDraftReply.mockResolvedValueOnce({
      reviewId: 'r1',
      draftReply: 'Thank you for your kind words!',
      provider: 'openai',
    });

    render(<ReviewsPage />);

    await waitFor(() => {
      expect(screen.getByText('Amit Patel')).toBeInTheDocument();
    });

    const draftButtons = screen.getAllByText('Draft with AI');
    await user.click(draftButtons[0]);

    await waitFor(() => {
      expect(mockDraftReply).toHaveBeenCalledWith('r1');
    });
  });
});
