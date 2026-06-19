'use client';

import { useEffect, useState, useCallback } from 'react';
import { Star, Send, Filter, Sparkles, RefreshCw, Lock } from 'lucide-react';
import { api, type Review } from '@/lib/api';
import { usePlanFeatures } from '@/hooks/use-plan-features';

const SOURCE_TABS = ['all', 'google', 'facebook', 'whatsapp'] as const;

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${
            i <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'
          }`}
        />
      ))}
    </div>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  google: 'Google',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
};

function SourceBadge({ source }: { source: string }) {
  const colors: Record<string, string> = {
    google: 'bg-blue-50 text-blue-700 border-blue-200',
    facebook: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    whatsapp: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${
        colors[source] || 'bg-gray-50 text-gray-700 border-gray-200'
      }`}
    >
      {SOURCE_LABELS[source] || source}
    </span>
  );
}

function SentimentBadge({ sentiment }: { sentiment: string | null }) {
  if (!sentiment) return null;
  const colors: Record<string, string> = {
    positive: 'text-green-600',
    neutral: 'text-gray-500',
    negative: 'text-red-600',
  };
  return (
    <span className={`text-xs font-medium ${colors[sentiment] || ''}`}>
      {sentiment}
    </span>
  );
}

export default function ReviewsPage() {
  const { hasFeature } = usePlanFeatures();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [source, setSource] = useState<string>('all');
  const [sort, setSort] = useState<'newest' | 'lowest'>('newest');
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [draftingId, setDraftingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.reviews.list({ source, sort, limit: 50 });
      setReviews(data.reviews);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to load reviews:', err);
    } finally {
      setLoading(false);
    }
  }, [source, sort]);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  async function handleReply(reviewId: string) {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      await api.reviews.reply(reviewId, replyText);
      setReplyingTo(null);
      setReplyText('');
      loadReviews();
    } catch (err) {
      console.error('Failed to send reply:', err);
    } finally {
      setSending(false);
    }
  }

  async function handleDraftReply(reviewId: string) {
    setDraftingId(reviewId);
    try {
      const result = await api.reviews.draftReply(reviewId);
      setReplyingTo(reviewId);
      setReplyText(result.draftReply);
    } catch (err) {
      console.error('Failed to draft reply:', err);
    } finally {
      setDraftingId(null);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      await api.reviews.sync();
      loadReviews();
    } catch (err) {
      console.error('Failed to sync:', err);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reviews</h1>
          <p className="text-sm text-gray-500">{total} total reviews</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition cursor-pointer text-gray-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync'}
          </button>
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as 'newest' | 'lowest')}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700"
          >
            <option value="newest">Newest first</option>
            <option value="lowest">Lowest rating</option>
          </select>
        </div>
      </div>

      {/* Source Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit flex-wrap">
        {SOURCE_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setSource(tab)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition cursor-pointer ${
              source === tab
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'all' ? 'All' : SOURCE_LABELS[tab] || tab}
          </button>
        ))}
      </div>

      {/* Review Cards */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
        </div>
      ) : reviews.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No reviews found.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="bg-white rounded-xl border border-gray-200 p-5"
            >
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <SourceBadge source={review.source} />
                <StarRating rating={review.rating} />
                <SentimentBadge sentiment={review.sentiment} />
                {review.replied && (
                  <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                    Replied
                  </span>
                )}
              </div>

              <p className="text-sm font-medium text-gray-900 mb-1">
                {review.author}
              </p>
              <p className="text-sm text-gray-600 mb-2">{review.text}</p>
              <p className="text-xs text-gray-400">
                {new Date(review.postedAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>

              {review.replyText && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-500 mb-1">Your reply</p>
                  <p className="text-sm text-gray-700">{review.replyText}</p>
                </div>
              )}

              {!review.replied && (
                <div className="mt-3">
                  {replyingTo === review.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write your reply..."
                        rows={3}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none text-gray-900 placeholder:text-gray-400"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReply(review.id)}
                          disabled={sending || !replyText.trim()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-lg transition cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          {sending ? 'Sending...' : 'Post Reply'}
                        </button>
                        <button
                          onClick={() => {
                            setReplyingTo(null);
                            setReplyText('');
                          }}
                          className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <button
                        onClick={() => setReplyingTo(review.id)}
                        className="text-sm font-medium text-orange-600 hover:text-orange-700 transition cursor-pointer"
                      >
                        Reply
                      </button>
                      <button
                        onClick={() => hasFeature('ai_reply') ? handleDraftReply(review.id) : alert('Upgrade to Growth plan to use AI replies')}
                        disabled={draftingId === review.id}
                        className={`inline-flex items-center gap-1 text-sm font-medium transition cursor-pointer disabled:opacity-50 ${
                          hasFeature('ai_reply') ? 'text-purple-600 hover:text-purple-700' : 'text-gray-400'
                        }`}
                      >
                        {hasFeature('ai_reply') ? <Sparkles className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                        {draftingId === review.id ? 'Drafting...' : 'Draft with AI'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
