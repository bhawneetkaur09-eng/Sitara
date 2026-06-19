'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  SendHorizonal,
  Star,
  BarChart3,
  Phone,
  User,
  CheckCircle2,
  Clock,
  Zap,
} from 'lucide-react';
import { api, type Survey, type SurveyStats } from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  sent: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  rated: 'bg-blue-50 text-blue-700 border-blue-200',
  routed_public: 'bg-green-50 text-green-700 border-green-200',
  routed_private: 'bg-red-50 text-red-700 border-red-200',
  completed: 'bg-gray-50 text-gray-700 border-gray-200',
};

function StatCard({
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
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-500">{title}</span>
        <div className={`p-1.5 rounded-lg ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

export default function SurveysPage() {
  const [stats, setStats] = useState<SurveyStats | null>(null);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [phone, setPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    surveyId: string;
    simulated: boolean;
  } | null>(null);

  const [simulateSurveyId, setSimulateSurveyId] = useState<string | null>(null);
  const [simulateRating, setSimulateRating] = useState(0);
  const [simulateFeedback, setSimulateFeedback] = useState('');
  const [simulating, setSimulating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsData, surveysData] = await Promise.all([
        api.surveys.stats(),
        api.surveys.list({ limit: 20 }),
      ]);
      setStats(statsData);
      setSurveys(surveysData.surveys);
      setTotal(surveysData.total);
    } catch (err) {
      console.error('Failed to load surveys:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSend() {
    if (!phone.trim()) return;
    setSending(true);
    setSendResult(null);
    try {
      const result = await api.surveys.send(phone.trim(), customerName.trim() || undefined);
      setSendResult({ surveyId: result.surveyId, simulated: result.simulated });
      setPhone('');
      setCustomerName('');
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to send survey');
    } finally {
      setSending(false);
    }
  }

  async function handleSimulateRating() {
    if (!simulateSurveyId || simulateRating < 1) return;
    setSimulating(true);
    try {
      await api.surveys.simulateRating(
        simulateSurveyId,
        simulateRating,
        simulateFeedback.trim() || undefined,
      );
      setSimulateSurveyId(null);
      setSimulateRating(0);
      setSimulateFeedback('');
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to simulate rating');
    } finally {
      setSimulating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">WhatsApp Surveys</h1>
        <p className="text-sm text-gray-500">
          Send feedback surveys and track responses
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            title="Sent Today"
            value={stats.sentToday}
            icon={SendHorizonal}
            color="bg-blue-50 text-blue-600"
          />
          <StatCard
            title="This Week"
            value={stats.sentThisWeek}
            icon={BarChart3}
            color="bg-purple-50 text-purple-600"
          />
          <StatCard
            title="Response Rate"
            value={`${stats.responseRate}%`}
            icon={CheckCircle2}
            color="bg-green-50 text-green-600"
          />
          <StatCard
            title="Avg Rating"
            value={stats.avgRating > 0 ? `${stats.avgRating} / 5` : '—'}
            icon={Star}
            color="bg-yellow-50 text-yellow-600"
          />
        </div>
      )}

      {/* Send Survey Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-orange-500" />
          Send Test Survey
        </h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-gray-900 placeholder:text-gray-400"
              />
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Customer Name (optional)
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Amit Patel"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-gray-900 placeholder:text-gray-400"
              />
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleSend}
              disabled={sending || !phone.trim()}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-lg transition cursor-pointer whitespace-nowrap"
            >
              <SendHorizonal className="w-4 h-4" />
              {sending ? 'Sending...' : 'Send Survey'}
            </button>
          </div>
        </div>

        {sendResult && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
            <p className="font-medium text-green-800">
              Survey sent! {sendResult.simulated && '(Simulated — no real WhatsApp message)'}
            </p>
            <p className="text-green-600 text-xs mt-1">
              Survey ID: {sendResult.surveyId}
            </p>
          </div>
        )}
      </div>

      {/* Recent Surveys */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">
            Recent Surveys ({total})
          </h3>
        </div>

        {surveys.length === 0 ? (
          <p className="p-5 text-gray-500 text-center">
            No surveys sent yet. Use the form above to send a test survey.
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {surveys.map((survey) => (
              <div key={survey.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      {survey.customer.name || survey.customer.phone}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${
                        STATUS_COLORS[survey.status] || STATUS_COLORS.sent
                      }`}
                    >
                      {survey.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {survey.customer.phone}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(survey.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="capitalize">{survey.channel}</span>
                  </div>
                  {survey.rating !== null && (
                    <div className="flex items-center gap-1 mt-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${
                            i <= survey.rating!
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-gray-200'
                          }`}
                        />
                      ))}
                      {survey.feedback && (
                        <span className="text-xs text-gray-500 ml-2">
                          &quot;{survey.feedback}&quot;
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Simulate rating button for unrated surveys */}
                {survey.rating === null && (
                  <div>
                    {simulateSurveyId === survey.id ? (
                      <div className="flex flex-col gap-2 min-w-[200px]">
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <button
                              key={i}
                              onClick={() => setSimulateRating(i)}
                              className="cursor-pointer"
                            >
                              <Star
                                className={`w-5 h-5 transition ${
                                  i <= simulateRating
                                    ? 'text-yellow-400 fill-yellow-400'
                                    : 'text-gray-300 hover:text-yellow-300'
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={simulateFeedback}
                          onChange={(e) => setSimulateFeedback(e.target.value)}
                          placeholder="Feedback (optional)"
                          className="px-2 py-1 text-xs border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleSimulateRating}
                            disabled={simulating || simulateRating < 1}
                            className="px-3 py-1 text-xs font-medium bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-md cursor-pointer"
                          >
                            {simulating ? 'Saving...' : 'Submit'}
                          </button>
                          <button
                            onClick={() => {
                              setSimulateSurveyId(null);
                              setSimulateRating(0);
                              setSimulateFeedback('');
                            }}
                            className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setSimulateSurveyId(survey.id)}
                        className="text-xs font-medium text-orange-600 hover:text-orange-700 cursor-pointer whitespace-nowrap"
                      >
                        Simulate Rating
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
