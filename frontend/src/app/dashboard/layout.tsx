'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  MessageSquareText,
  AlertTriangle,
  Settings,
  LogOut,
  Star,
  Menu,
  X,
  SendHorizonal,
  CreditCard,
  Shield,
  MapPin,
  ChevronDown,
  Plus,
} from 'lucide-react';
import {
  api,
  type User,
  type LocationInfo,
  type SwitchLocationResult,
} from '@/lib/api';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/reviews', label: 'Reviews', icon: MessageSquareText },
  { href: '/dashboard/surveys', label: 'Surveys', icon: SendHorizonal },
  { href: '/dashboard/alerts', label: 'Alerts', icon: AlertTriangle },
  { href: '/dashboard/billing', label: 'Billing', icon: CreditCard },
  { href: '/dashboard/compliance', label: 'Compliance', icon: Shield },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user] = useState<User | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem('user');
    return stored ? (JSON.parse(stored) as User) : null;
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [locations, setLocations] = useState<LocationInfo[]>([]);
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);
  const [addingLocation, setAddingLocation] = useState(false);
  const [newLocName, setNewLocName] = useState('');
  const [newLocAddress, setNewLocAddress] = useState('');

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    api.restaurant.listLocations().then(setLocations).catch(console.error);
  }, [user, router]);

  async function handleSwitchLocation(loc: LocationInfo) {
    if (user?.restaurant?.id === loc.id) {
      setLocationDropdownOpen(false);
      return;
    }
    try {
      const result = await api.restaurant.switchLocation(loc.id);
      const fullResult = result as SwitchLocationResult & {
        access_token?: string;
        user?: User;
      };
      if (fullResult.access_token) {
        localStorage.setItem('token', fullResult.access_token);
      }
      if (fullResult.user) {
        localStorage.setItem('user', JSON.stringify(fullResult.user));
      }
      setLocationDropdownOpen(false);
      window.location.reload();
    } catch (err) {
      console.error('Failed to switch location:', err);
    }
  }

  async function handleAddLocation() {
    if (!newLocName.trim() || !newLocAddress.trim()) return;
    try {
      const loc = await api.restaurant.addLocation({
        name: newLocName.trim(),
        location: newLocAddress.trim(),
      });
      setLocations((prev) => [...prev, loc]);
      setNewLocName('');
      setNewLocAddress('');
      setAddingLocation(false);
    } catch (err) {
      console.error('Failed to add location:', err);
    }
  }

  function handleLogout() {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    router.push('/login');
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star className="w-6 h-6 text-orange-500 fill-orange-500" />
              <span className="text-xl font-bold text-gray-900">Sitara</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? 'bg-orange-50 text-orange-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-100">
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-medium text-gray-900">{user.name}</p>
            <p className="text-xs text-gray-500">{user.restaurant?.name}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition w-full cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-3 flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-600 hover:text-gray-900"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <div className="relative inline-block">
              <button
                onClick={() => setLocationDropdownOpen(!locationDropdownOpen)}
                className="flex items-center gap-2 hover:bg-gray-50 rounded-lg px-2 py-1 -ml-2 transition cursor-pointer"
              >
                <MapPin className="w-4 h-4 text-orange-500" />
                <div className="text-left">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {user.restaurant?.name}
                  </h2>
                  <p className="text-xs text-gray-500">{user.restaurant?.location}</p>
                </div>
                {locations.length > 1 && (
                  <ChevronDown className="w-4 h-4 text-gray-400 ml-1" />
                )}
              </button>

              {locationDropdownOpen && locations.length > 0 && (
                <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-50">
                  <div className="p-2">
                    <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Locations
                    </p>
                    {locations.map((loc) => (
                      <button
                        key={loc.id}
                        onClick={() => handleSwitchLocation(loc)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition flex items-center gap-2 cursor-pointer ${
                          user.restaurant?.id === loc.id
                            ? 'bg-orange-50 text-orange-700'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium">{loc.name}</p>
                          <p className="text-xs text-gray-500">{loc.location}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-gray-100 p-2">
                    {!addingLocation ? (
                      <button
                        onClick={() => setAddingLocation(true)}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add location
                      </button>
                    ) : (
                      <div className="px-3 py-2 space-y-2">
                        <input
                          value={newLocName}
                          onChange={(e) => setNewLocName(e.target.value)}
                          placeholder="Restaurant name"
                          className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg"
                        />
                        <input
                          value={newLocAddress}
                          onChange={(e) => setNewLocAddress(e.target.value)}
                          placeholder="Area, City"
                          className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleAddLocation}
                            className="flex-1 px-2 py-1.5 text-xs font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 cursor-pointer"
                          >
                            Add
                          </button>
                          <button
                            onClick={() => setAddingLocation(false)}
                            className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          {locations.length > 1 && (
            <span className="text-xs px-2 py-1 bg-purple-50 text-purple-600 rounded-full font-medium">
              {locations.length} locations
            </span>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
