'use client';

import { useEffect, useState } from 'react';
import { Shield, Download, Trash2, Users } from 'lucide-react';
import { api, type ConsentStats } from '@/lib/api';

export default function CompliancePage() {
  const [stats, setStats] = useState<ConsentStats | null>(null);
  const [purging, setPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const s = await api.compliance.consentStats();
        setStats(s);
      } catch (err) {
        console.error('Failed to load consent stats:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handlePurge() {
    setPurging(true);
    setPurgeResult(null);
    try {
      const result = await api.compliance.purgeStale();
      setPurgeResult(result.message);
      const s = await api.compliance.consentStats();
      setStats(s);
    } catch (err) {
      console.error('Purge failed:', err);
      setPurgeResult('Purge failed. Check console for details.');
    } finally {
      setPurging(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const data = await api.compliance.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `customer-data-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
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
        <h1 className="text-2xl font-bold text-gray-900">
          Data Compliance
        </h1>
        <p className="text-sm text-gray-500">
          DPDP Act 2023 compliance dashboard
        </p>
      </div>

      {/* Consent Stats */}
      {stats && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Users className="w-4 h-4" />
            Customer Consent
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">Total Customers</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.totalCustomers}
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-xs text-gray-500">Consented</p>
              <p className="text-2xl font-bold text-green-700">
                {stats.consentedCustomers}
              </p>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <p className="text-xs text-gray-500">Consent Rate</p>
              <p className="text-2xl font-bold text-orange-700">
                {stats.consentRate}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* DPDP Overview */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-blue-500" />
          DPDP Act 2023 — What Sitara Does
        </h3>
        <div className="space-y-3">
          {[
            {
              title: 'Consent Capture',
              desc: 'Before the first survey, customers see: "We\'ll send feedback requests on WhatsApp. Reply STOP anytime." Consent is timestamped.',
              status: 'active',
            },
            {
              title: 'Purpose Limitation',
              desc: 'Phone numbers are used only for feedback surveys. Never shared with third parties or used for marketing.',
              status: 'active',
            },
            {
              title: 'Data Retention (12 months)',
              desc: 'Customer data is purged after 12 months of inactivity. Use the purge button below to clean up stale records.',
              status: 'active',
            },
            {
              title: 'Right to Erasure',
              desc: 'Customers who reply STOP are removed from future surveys. Data export is available for regulatory requests.',
              status: 'active',
            },
            {
              title: 'Breach Notification',
              desc: 'If a breach occurs, the export feature generates a list of affected customers for regulatory reporting.',
              status: 'ready',
            },
          ].map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
            >
              <span
                className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                  item.status === 'active' ? 'bg-green-400' : 'bg-yellow-400'
                }`}
              />
              <div>
                <p className="text-sm font-medium text-gray-900">{item.title}</p>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <Trash2 className="w-4 h-4 text-red-500" />
            Data Retention Purge
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Remove customer records inactive for 12+ months, as required by DPDP
            Act.
          </p>
          <button
            onClick={handlePurge}
            disabled={purging}
            className="px-4 py-2 text-sm font-medium bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition disabled:opacity-50 cursor-pointer"
          >
            {purging ? 'Purging...' : 'Run Purge'}
          </button>
          {purgeResult && (
            <p className="mt-2 text-xs text-gray-600">{purgeResult}</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <Download className="w-4 h-4 text-blue-500" />
            Data Export
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Export all customer data for regulatory requests or breach
            notification.
          </p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-4 py-2 text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition disabled:opacity-50 cursor-pointer"
          >
            {exporting ? 'Exporting...' : 'Export JSON'}
          </button>
        </div>
      </div>
    </div>
  );
}
