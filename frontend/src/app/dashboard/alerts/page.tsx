'use client';

import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { api, type Alert } from '@/lib/api';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [sendNudge, setSendNudge] = useState(false);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.alerts.list(filter || undefined);
      setAlerts(data);
    } catch (err) {
      console.error('Failed to load alerts:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  async function handleResolve(alertId: string) {
    try {
      await api.alerts.resolve(alertId, resolveNote, sendNudge);
      setResolvingId(null);
      setResolveNote('');
      setSendNudge(false);
      loadAlerts();
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alerts</h1>
          <p className="text-sm text-gray-500">
            Negative feedback from customers
          </p>
        </div>

        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          {['', 'open', 'resolved'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition capitalize cursor-pointer ${
                filter === f
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f || 'All'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <p className="text-gray-500">No alerts. Everything looks good!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`bg-white rounded-xl border p-5 ${
                alert.status === 'open'
                  ? 'border-red-200'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle
                    className={`w-5 h-5 mt-0.5 ${
                      alert.status === 'open'
                        ? 'text-red-500'
                        : 'text-gray-400'
                    }`}
                  />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-900">
                        {alert.rating}-star rating
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          alert.status === 'open'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-green-50 text-green-700'
                        }`}
                      >
                        {alert.status}
                      </span>
                    </div>
                    {alert.reason && (
                      <p className="text-sm text-gray-600 mb-1">
                        Reason: {alert.reason}
                      </p>
                    )}
                    {alert.customerPhone && (
                      <p className="text-xs text-gray-400">
                        Customer: {alert.customerPhone}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(alert.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>

                    {alert.resolveNote && (
                      <div className="mt-2 p-2 bg-green-50 rounded-lg">
                        <p className="text-xs text-green-700">
                          <span className="font-medium">Resolution:</span>{' '}
                          {alert.resolveNote}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {alert.status === 'open' && (
                  <div>
                    {resolvingId === alert.id ? (
                      <div className="space-y-2 w-64">
                        <textarea
                          value={resolveNote}
                          onChange={(e) => setResolveNote(e.target.value)}
                          placeholder="What action did you take?"
                          rows={2}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none resize-none text-gray-900 placeholder:text-gray-400"
                        />
                        {alert.customerPhone && (
                          <label className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={sendNudge}
                              onChange={(e) => setSendNudge(e.target.checked)}
                              className="mt-0.5 rounded border-gray-300 text-orange-500 focus:ring-orange-500 cursor-pointer"
                            />
                            <span className="text-xs text-gray-600">
                              Customer happy? Send them a Google review link
                            </span>
                          </label>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleResolve(alert.id)}
                            className="px-3 py-1 text-xs font-medium bg-green-500 hover:bg-green-600 text-white rounded-lg transition cursor-pointer"
                          >
                            Resolve
                          </button>
                          <button
                            onClick={() => {
                              setResolvingId(null);
                              setSendNudge(false);
                            }}
                            className="px-3 py-1 text-xs font-medium text-gray-500 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setResolvingId(alert.id)}
                        className="px-3 py-1.5 text-sm font-medium text-green-600 hover:bg-green-50 rounded-lg transition cursor-pointer"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
