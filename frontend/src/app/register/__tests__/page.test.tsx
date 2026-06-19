import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegisterPage from '../page';

jest.mock('@/lib/api', () => ({
  api: {
    auth: {
      register: jest.fn(),
    },
  },
}));

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/register',
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
const mockRegister = api.auth.register as jest.Mock;

describe('RegisterPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.clear();
  });

  it('renders registration form with all fields', () => {
    render(<RegisterPage />);
    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/restaurant name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/location/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('validates password length (min 6)', async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.type(screen.getByLabelText(/your name/i), 'Test');
    await user.type(screen.getByLabelText(/email/i), 'test@test.com');
    await user.type(screen.getByLabelText(/password/i), '12345');
    await user.type(screen.getByLabelText(/restaurant name/i), 'My Restaurant');
    await user.type(screen.getByLabelText(/location/i), 'Bangalore');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/password must be at least 6 characters/i)).toBeInTheDocument();
    });
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('submits and redirects to dashboard', async () => {
    const user = userEvent.setup();
    const mockUser = { id: '1', email: 'test@test.com', name: 'Test', role: 'owner' };
    mockRegister.mockResolvedValueOnce({ access_token: 'tok456', user: mockUser });

    render(<RegisterPage />);

    await user.type(screen.getByLabelText(/your name/i), 'Test');
    await user.type(screen.getByLabelText(/email/i), 'test@test.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.type(screen.getByLabelText(/restaurant name/i), 'My Restaurant');
    await user.type(screen.getByLabelText(/location/i), 'Bangalore');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        name: 'Test',
        email: 'test@test.com',
        password: 'password123',
        restaurantName: 'My Restaurant',
        restaurantLocation: 'Bangalore',
      });
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('token', 'tok456');
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows error on duplicate email', async () => {
    const user = userEvent.setup();
    mockRegister.mockRejectedValueOnce(new Error('Email already in use'));

    render(<RegisterPage />);

    await user.type(screen.getByLabelText(/your name/i), 'Test');
    await user.type(screen.getByLabelText(/email/i), 'existing@test.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.type(screen.getByLabelText(/restaurant name/i), 'My Restaurant');
    await user.type(screen.getByLabelText(/location/i), 'Bangalore');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText('Email already in use')).toBeInTheDocument();
    });
  });

  it('has link to login page', () => {
    render(<RegisterPage />);
    const link = screen.getByRole('link', { name: /sign in/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/login');
  });
});
