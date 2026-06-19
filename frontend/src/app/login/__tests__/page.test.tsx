import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '../page';

jest.mock('@/lib/api', () => ({
  api: {
    auth: {
      login: jest.fn(),
    },
  },
}));

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/login',
}));

const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn((key: string) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

import { api } from '@/lib/api';
const mockLogin = api.auth.login as jest.Mock;

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.clear();
  });

  it('renders login form with email and password fields', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows demo credentials', () => {
    render(<LoginPage />);
    expect(screen.getByText(/demo credentials/i)).toBeInTheDocument();
    expect(screen.getByText(/owner@spicegarden\.in/)).toBeInTheDocument();
  });

  it('submits and stores token/user in localStorage', async () => {
    const user = userEvent.setup();
    const mockUser = { id: '1', email: 'test@test.com', name: 'Test', role: 'owner' };
    mockLogin.mockResolvedValueOnce({ access_token: 'tok123', user: mockUser });

    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'test@test.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@test.com', 'password123');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('token', 'tok123');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockUser));
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows error message on failed login', async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValueOnce(new Error('Invalid credentials'));

    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'wrong@test.com');
    await user.type(screen.getByLabelText(/password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('has link to register page', () => {
    render(<LoginPage />);
    const link = screen.getByRole('link', { name: /create one/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/register');
  });
});
