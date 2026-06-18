'use client';

import { useEffect, useState } from 'react';
import { Star, MessageSquareText, ShieldAlert, AlertTriangle } from 'lucide-react';
import { api, type ReviewStats } from '@/lib/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

function KpiCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-500">{title}</span>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [openAlerts, setOpenAlerts] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [statsData, alertsData] = await Promise.all([
          api.reviews.stats(),
          api.alerts.count(),
        ]);
        setStats(statsData);
        setOpenAlerts(alertsData.count);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (!stats) return <p className="text-gray-500">Failed to load dashboard data.</p>;

  const chartData = stats.distribution.map((d) => ({
    name: `${d.rating} Star`,
    count: d.count,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Average Rating"
          value={`${stats.avgRating} / 5`}
          icon={Star}
          color="bg-yellow-50 text-yellow-600"
        />
        <KpiCard
          title="Total Reviews"
          value={stats.total}
          icon={MessageSquareText}
          color="bg-blue-50 text-blue-600"
        />
        <KpiCard
          title="Negatives Intercepted"
          value={stats.negativesIntercepted}
          icon={ShieldAlert}
          color="bg-green-50 text-green-600"
        />
        <KpiCard
          title="Open Alerts"
          value={openAlerts}
          icon={AlertTriangle}
          color="bg-red-50 text-red-600"
        />
      </div>

      {/* Rating Distribution Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-4">
          Rating Distribution
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#f97316" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Per-Source Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.bySource.map((s) => {
          const labels: Record<string, string> = {
            google: 'Google',
            facebook: 'Facebook',
            whatsapp: 'WhatsApp Feedback',
          };
          const accents: Record<string, string> = {
            google: 'border-l-blue-500',
            facebook: 'border-l-indigo-500',
            whatsapp: 'border-l-emerald-500',
          };
          return (
            <div
              key={s.source}
              className={`bg-white rounded-xl border border-gray-200 border-l-4 ${accents[s.source] || ''} p-5`}
            >
              <span className="text-sm font-semibold text-gray-700">
                {labels[s.source] || s.source}
              </span>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {s.count > 0 ? s.avgRating.toFixed(1) : '—'}
              </p>
              <p className="text-sm text-gray-500">{s.count} reviews</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
