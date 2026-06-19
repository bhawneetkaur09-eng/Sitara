import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CompliancePage from '../page';

jest.mock('@/lib/api', () => ({
  api: {
    compliance: {
      consentStats: jest.fn(),
      purgeStale: jest.fn(),
      exportData: jest.fn(),
    },
  },
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/dashboard/compliance',
}));

import { api } from '@/lib/api';
const mockConsentStats = api.compliance.consentStats as jest.Mock;
const mockPurgeStale = api.compliance.purgeStale as jest.Mock;
const mockExportData = api.compliance.exportData as jest.Mock;

const mockStats = {
  totalCustomers: 150,
  consentedCustomers: 132,
  consentRate: 88,
};

describe('CompliancePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConsentStats.mockResolvedValue(mockStats);
  });

  it('renders consent stats', async () => {
    render(<CompliancePage />);

    await waitFor(() => {
      expect(screen.getByText('150')).toBeInTheDocument();
    });
    expect(screen.getByText('132')).toBeInTheDocument();
    expect(screen.getByText('88%')).toBeInTheDocument();
    expect(screen.getByText('Total Customers')).toBeInTheDocument();
    expect(screen.getByText('Consented')).toBeInTheDocument();
    expect(screen.getByText('Consent Rate')).toBeInTheDocument();
  });

  it('has purge button', async () => {
    render(<CompliancePage />);

    await waitFor(() => {
      expect(screen.getByText('Run Purge')).toBeInTheDocument();
    });
  });

  it('has export button', async () => {
    render(<CompliancePage />);

    await waitFor(() => {
      expect(screen.getByText('Export JSON')).toBeInTheDocument();
    });
  });

  it('calls purge API when purge button is clicked', async () => {
    const user = userEvent.setup();
    mockPurgeStale.mockResolvedValueOnce({ purged: 3, message: 'Purged 3 stale records' });
    mockConsentStats.mockResolvedValue({ totalCustomers: 147, consentedCustomers: 130, consentRate: 88 });

    render(<CompliancePage />);

    await waitFor(() => {
      expect(screen.getByText('Run Purge')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Run Purge'));

    await waitFor(() => {
      expect(mockPurgeStale).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('Purged 3 stale records')).toBeInTheDocument();
    });
  });

  it('calls export API when export button is clicked', async () => {
    const user = userEvent.setup();
    mockExportData.mockResolvedValueOnce([{ id: '1', phone: '+919876543210' }]);

    global.URL.createObjectURL = jest.fn(() => 'blob:http://localhost/fake');
    global.URL.revokeObjectURL = jest.fn();

    render(<CompliancePage />);

    await waitFor(() => {
      expect(screen.getByText('Export JSON')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Export JSON'));

    await waitFor(() => {
      expect(mockExportData).toHaveBeenCalled();
    });
  });

  it('renders DPDP compliance information', async () => {
    render(<CompliancePage />);

    await waitFor(() => {
      expect(screen.getAllByText(/DPDP Act 2023/).length).toBeGreaterThan(0);
    });
    expect(screen.getByText('Consent Capture')).toBeInTheDocument();
    expect(screen.getByText('Purpose Limitation')).toBeInTheDocument();
    expect(screen.getByText('Data Retention (12 months)')).toBeInTheDocument();
  });
});
