'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { api } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    restaurantName: '',
    restaurantLocation: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const result = await api.auth.register(form);
      localStorage.setItem('user', JSON.stringify(result.user));
      localStorage.setItem('token', result.access_token);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <Star className="w-8 h-8 text-orange-500 fill-orange-500" />
            <h1 className="text-3xl font-bold text-gray-900">Sitara</h1>
          </div>
          <p className="text-gray-600">Restaurant Reputation Platform</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8"
        >
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Create your account
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Your Name
              </label>
              <input
                id="name"
                type="text"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="Rajesh Kumar"
                required
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-gray-900 placeholder:text-gray-400"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="you@restaurant.in"
                required
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-gray-900 placeholder:text-gray-400"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                placeholder="At least 6 characters"
                required
                minLength={6}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-gray-900 placeholder:text-gray-400"
              />
            </div>

            <hr className="border-gray-200" />

            <div>
              <label htmlFor="restaurantName" className="block text-sm font-medium text-gray-700 mb-1">
                Restaurant Name
              </label>
              <input
                id="restaurantName"
                type="text"
                value={form.restaurantName}
                onChange={(e) => update('restaurantName', e.target.value)}
                placeholder="Spice Garden"
                required
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-gray-900 placeholder:text-gray-400"
              />
            </div>

            <div>
              <label htmlFor="restaurantLocation" className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <input
                id="restaurantLocation"
                type="text"
                value={form.restaurantLocation}
                onChange={(e) => update('restaurantLocation', e.target.value)}
                placeholder="Koramangala, Bangalore"
                required
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-gray-900 placeholder:text-gray-400"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 py-2.5 px-4 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-medium rounded-lg transition cursor-pointer"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>

          <p className="mt-4 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link
              href="/login"
              className="text-orange-600 hover:text-orange-700 font-medium"
            >
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
