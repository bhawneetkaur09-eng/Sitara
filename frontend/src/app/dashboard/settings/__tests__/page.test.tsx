import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPage from '../page';

jest.mock('@/lib/api', () => ({
  api: {
    qr: {
      get: jest.fn(),
      downloadUrl: jest.fn(() => 'http://localhost:3001/api/qr/download'),
    },
    restaurant: {
      getSettings: jest.fn(),
      updateSettings: jest.fn(),
    },
    surveys: {
      simulateScan: jest.fn(),
    },
  },
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/dashboard/settings',
}));

const mockUser = {
  id: '1',
  email: 'owner@spicegarden.in',
  name: 'Rajesh Kumar',
  role: 'owner',
  restaurantId: 'rest1',
  restaurant: { id: 'rest1', name: 'Spice Garden', location: 'Koramangala, Bangalore' },
};

const mockLocalStorage = (() => {
  let store: Record<string, string> = {
    user: JSON.stringify(mockUser),
    token: 'tok123',
  };
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn((key: string) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

import { api } from '@/lib/api';
const mockQrGet = api.qr.get as jest.Mock;
const mockGetSettings = api.restaurant.getSettings as jest.Mock;
const mockUpdateSettings = api.restaurant.updateSettings as jest.Mock;
const mockSimulateScan = api.surveys.simulateScan as jest.Mock;

const mockQrData = {
  dataUrl: 'data:image/png;base64,fakebase64data',
  whatsappUrl: 'https://wa.me/919876543210?text=Hi',
  restaurantName: 'Spice Garden',
};

const mockSettings = {
  gatingEnabled: false,
  recoveryOffer: null,
  googlePlaceId: null,
  whatsappNumber: '+919876543210',
  voiceSetting: 'friendly',
};

describe('SettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQrGet.mockResolvedValue(mockQrData);
    mockGetSettings.mockResolvedValue(mockSettings);
  });

  it('renders restaurant profile', async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Restaurant Profile')).toBeInTheDocument();
    });
    expect(screen.getByText('Spice Garden')).toBeInTheDocument();
    expect(screen.getByText('Koramangala, Bangalore')).toBeInTheDocument();
    expect(screen.getByText('Rajesh Kumar')).toBeInTheDocument();
  });

  it('shows QR code section', async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Feedback QR Code')).toBeInTheDocument();
    });
    expect(screen.getByAltText('Feedback QR Code')).toBeInTheDocument();
    expect(screen.getByText('Download QR Code')).toBeInTheDocument();
  });

  it('shows review gating toggle', async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Review Gating')).toBeInTheDocument();
    });
    expect(screen.getByText(/enable review gating/i)).toBeInTheDocument();
  });

  it('has simulate scan form', async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText(/simulate a qr scan/i)).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText(/\+91 9592319964/)).toBeInTheDocument();
    expect(screen.getByText('Simulate Scan')).toBeInTheDocument();
  });

  it('toggles review gating when button is clicked', async () => {
    const user = userEvent.setup();
    mockUpdateSettings.mockResolvedValueOnce({ ...mockSettings, gatingEnabled: true });

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Review Gating')).toBeInTheDocument();
    });

    const gatingSection = screen.getByText(/enable review gating/i).closest('div');
    const toggle = gatingSection?.parentElement?.querySelector('button');
    if (toggle) {
      await user.click(toggle);
      await waitFor(() => {
        expect(mockUpdateSettings).toHaveBeenCalledWith({ gatingEnabled: true });
      });
    }
  });

  it('simulates QR scan', async () => {
    const user = userEvent.setup();
    mockSimulateScan.mockResolvedValueOnce({
      surveyId: 's1',
      messageId: 'msg1',
      simulated: true,
      phone: '+919876543210',
      status: 'sent',
    });

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Simulate Scan')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/\+91 9592319964/), '+919876543210');
    await user.click(screen.getByText('Simulate Scan'));

    await waitFor(() => {
      expect(mockSimulateScan).toHaveBeenCalledWith('+919876543210');
    });
  });
});
