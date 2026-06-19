'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  Settings,
  AlertTriangle,
  QrCode,
  Download,
  Smartphone,
  ExternalLink,
} from 'lucide-react';
import {
  api,
  type User,
  type QrData,
  type RestaurantSettings,
} from '@/lib/api';

export default function SettingsPage() {
  const [user] = useState<User | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem('user');
    return stored ? (JSON.parse(stored) as User) : null;
  });
  const [qrData, setQrData] = useState<QrData | null>(null);
  const [qrLoading, setQrLoading] = useState(true);
  const [scanPhone, setScanPhone] = useState('');
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [gatingToggling, setGatingToggling] = useState(false);
  const [recoveryOffer, setRecoveryOffer] = useState('');
  const [savingOffer, setSavingOffer] = useState(false);
  const [offerSaved, setOfferSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([api.qr.get(), api.restaurant.getSettings()])
      .then(([qr, s]) => {
        if (cancelled) return;
        setQrData(qr);
        setSettings(s);
        setRecoveryOffer(s.recoveryOffer || '');
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setQrLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function toggleGating() {
    if (!settings) return;
    setGatingToggling(true);
    try {
      const updated = await api.restaurant.updateSettings({
        gatingEnabled: !settings.gatingEnabled,
      });
      setSettings({ ...settings, ...updated });
    } catch (err) {
      console.error('Failed to toggle gating:', err);
    } finally {
      setGatingToggling(false);
    }
  }

  async function saveRecoveryOffer() {
    setSavingOffer(true);
    setOfferSaved(false);
    try {
      await api.restaurant.updateSettings({
        recoveryOffer: recoveryOffer.trim() || null,
      });
      setOfferSaved(true);
      setTimeout(() => setOfferSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save offer:', err);
    } finally {
      setSavingOffer(false);
    }
  }

  async function handleSimulateScan() {
    if (!scanPhone.trim()) return;
    setScanning(true);
    setScanResult(null);
    try {
      const result = await api.surveys.simulateScan(scanPhone.trim());
      setScanResult(
        `Survey sent to ${scanPhone.trim()} (${result.simulated ? 'simulated' : 'live'})`,
      );
      setScanPhone('');
    } catch (err) {
      setScanResult(
        `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    } finally {
      setScanning(false);
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Restaurant Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Restaurant Profile
        </h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Name</span>
            <span className="font-medium text-gray-900">
              {user.restaurant?.name}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Location</span>
            <span className="font-medium text-gray-900">
              {user.restaurant?.location}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Plan</span>
            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-orange-50 text-orange-700 rounded-full capitalize">
              Growth
            </span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-gray-500">Owner</span>
            <span className="font-medium text-gray-900">{user.name}</span>
          </div>
        </div>
      </div>

      {/* QR Code for Feedback */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <QrCode className="w-4 h-4 text-emerald-600" />
          Feedback QR Code
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Print this QR code on tables or bills. When a customer scans it, they
          open WhatsApp and send &quot;Hi&quot; — Sitara automatically sends them
          a feedback survey.
        </p>

        {qrLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
          </div>
        ) : qrData ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              {/* QR Image */}
              <div className="bg-white border-2 border-gray-100 rounded-xl p-4 flex-shrink-0">
                <Image
                  src={qrData.dataUrl}
                  alt="Feedback QR Code"
                  width={192}
                  height={192}
                  unoptimized
                />
                <p className="text-center text-xs font-medium text-gray-500 mt-2">
                  {qrData.restaurantName}
                </p>
              </div>

              {/* Info + Actions */}
              <div className="flex-1 space-y-3">
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                  <p className="text-xs text-emerald-800">
                    <span className="font-semibold">How it works:</span> Customer
                    scans QR → WhatsApp opens with &quot;Hi&quot; → Sitara
                    auto-sends a star-rating survey → feedback appears in your
                    Reviews inbox.
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <ExternalLink className="w-3 h-3" />
                  <a
                    href={qrData.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-600 hover:underline"
                  >
                    {qrData.whatsappUrl}
                  </a>
                </div>

                <button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = qrData.dataUrl;
                    link.download = 'sitara-feedback-qr.png';
                    link.click();
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Download QR Code
                </button>
              </div>
            </div>

            {/* Simulate QR Scan */}
            <div className="border-t border-gray-100 pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                Test: Simulate a QR Scan
              </h4>
              <p className="text-xs text-gray-500 mb-3">
                Enter a phone number to simulate a customer scanning the QR code
                and sending &quot;Hi&quot; on WhatsApp. A survey will be
                auto-sent.
              </p>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={scanPhone}
                  onChange={(e) => setScanPhone(e.target.value)}
                  placeholder="+91 9592319964"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-gray-900 placeholder:text-gray-400"
                />
                <button
                  onClick={handleSimulateScan}
                  disabled={scanning || !scanPhone.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-lg transition cursor-pointer whitespace-nowrap"
                >
                  {scanning ? 'Scanning...' : 'Simulate Scan'}
                </button>
              </div>
              {scanResult && (
                <p
                  className={`text-xs mt-2 ${
                    scanResult.startsWith('Error')
                      ? 'text-red-600'
                      : 'text-green-600'
                  }`}
                >
                  {scanResult}
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Failed to load QR code.</p>
        )}
      </div>

      {/* Review Gating */}
      <div className={`bg-white rounded-xl border p-5 ${settings?.gatingEnabled ? 'border-amber-300' : 'border-gray-200'}`}>
        <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Review Gating
        </h3>

        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-sm font-medium text-gray-700">Enable review gating</span>
            <p className="text-xs text-gray-500 mt-0.5">
              {settings?.gatingEnabled
                ? 'ON — Happy customers (4-5★) get a Google review link. Unhappy ones (1-3★) are handled privately.'
                : 'OFF — All survey feedback is recorded but no Google nudges are sent.'}
            </p>
          </div>
          <button
            onClick={toggleGating}
            disabled={gatingToggling}
            className={`w-11 h-6 rounded-full relative transition cursor-pointer flex-shrink-0 ${
              settings?.gatingEnabled ? 'bg-orange-500' : 'bg-gray-300'
            }`}
          >
            <div
              className={`w-4 h-4 bg-white rounded-full absolute top-1 shadow transition-all ${
                settings?.gatingEnabled ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg mb-4">
          <p className="text-xs text-amber-800">
            <span className="font-semibold">Warning:</span> Selectively routing
            customers to Google based on their rating may violate Google&apos;s
            review policies. Enabling this feature carries a risk of penalties to
            your Google Business listing. Use at your own discretion.
          </p>
        </div>

        {/* Recovery Offer */}
        <div className="border-t border-gray-100 pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-1">
            Recovery Offer (for unhappy customers)
          </h4>
          <p className="text-xs text-gray-500 mb-3">
            When a customer gives 1-3 stars, Sitara will auto-send this offer as an
            apology. Leave empty to skip the auto-reply.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={recoveryOffer}
              onChange={(e) => setRecoveryOffer(e.target.value)}
              placeholder="e.g. 20% off your next visit"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-gray-900 placeholder:text-gray-400"
            />
            <button
              onClick={saveRecoveryOffer}
              disabled={savingOffer}
              className="px-4 py-2 text-sm font-medium bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white rounded-lg transition cursor-pointer whitespace-nowrap"
            >
              {savingOffer ? 'Saving...' : offerSaved ? 'Saved!' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
