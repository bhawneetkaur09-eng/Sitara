'use client';

import { useEffect, useState } from 'react';
import { Check, CreditCard, Zap, X, Smartphone, IndianRupee, ShieldCheck, Receipt } from 'lucide-react';
import { api, type PlanTier, type BillingInfo } from '@/lib/api';

type PaymentMethod = 'upi' | 'card';
type CheckoutStep = 'payment' | 'processing' | 'success';

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [plans, setPlans] = useState<PlanTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Checkout modal state
  const [checkoutPlan, setCheckoutPlan] = useState<PlanTier | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const [upiId, setUpiId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>('payment');
  const [checkoutError, setCheckoutError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [b, p] = await Promise.all([
          api.billing.getCurrent(),
          api.billing.getPlans(),
        ]);
        setBilling(b);
        setPlans(p);
      } catch (err) {
        console.error('Failed to load billing:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function openCheckout(plan: PlanTier) {
    if (billing?.currentPlan.id === plan.id) return;
    setCheckoutPlan(plan);
    setCheckoutStep('payment');
    setCheckoutError('');
    setBillingCycle('monthly');
    setPaymentMethod('upi');
    setUpiId('');
    setCardNumber('');
    setCardExpiry('');
    setCardCvv('');
    setCardName('');
  }

  function closeCheckout() {
    setCheckoutPlan(null);
  }

  async function handlePay() {
    setCheckoutError('');

    if (paymentMethod === 'upi') {
      if (!upiId.includes('@')) {
        setCheckoutError('Please enter a valid UPI ID (e.g. yourname@paytm)');
        return;
      }
    } else {
      if (cardNumber.replace(/\s/g, '').length < 16) {
        setCheckoutError('Please enter a valid 16-digit card number');
        return;
      }
      if (!cardExpiry.match(/^\d{2}\/\d{2}$/)) {
        setCheckoutError('Expiry must be in MM/YY format');
        return;
      }
      if (cardCvv.length < 3) {
        setCheckoutError('Please enter a valid CVV');
        return;
      }
      if (!cardName.trim()) {
        setCheckoutError('Please enter the name on card');
        return;
      }
    }

    setCheckoutStep('processing');

    // Simulate payment processing delay
    await new Promise((r) => setTimeout(r, 2000));

    try {
      const result = await api.billing.changePlan(checkoutPlan!.id);
      const updated = await api.billing.getCurrent();
      setBilling(updated);
      setCheckoutStep('success');
      setSuccessMsg(result.message);
      setTimeout(() => setSuccessMsg(null), 6000);
    } catch (err) {
      console.error('Payment failed:', err);
      setCheckoutStep('payment');
      setCheckoutError('Payment failed. Please try again.');
    }
  }

  function getPrice(plan: PlanTier) {
    return billingCycle === 'monthly' ? plan.priceMonthly : plan.priceAnnual;
  }

  function getGst(plan: PlanTier) {
    return Math.round(getPrice(plan) * 0.18);
  }

  function getTotal(plan: PlanTier) {
    return getPrice(plan) + getGst(plan);
  }

  function formatCard(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
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
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
        <p className="text-sm text-gray-500">Manage your subscription plan</p>
      </div>

      {successMsg && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
          <span className="flex-shrink-0 w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
            ✓
          </span>
          <div>
            <p className="text-sm font-medium text-green-800">Plan updated successfully</p>
            <p className="text-xs text-green-600 mt-0.5">{successMsg}</p>
          </div>
        </div>
      )}

      {/* Current Plan */}
      {billing && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Current Plan
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Next billing: {billing.nextBillingDate}
              </p>
            </div>
            <span className="inline-flex items-center px-3 py-1 text-sm font-semibold bg-orange-50 text-orange-700 rounded-full capitalize">
              {billing.currentPlan.name}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">Surveys this month</p>
              <p className="text-lg font-bold text-gray-900">
                {billing.usage.surveysThisMonth}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">Locations</p>
              <p className="text-lg font-bold text-gray-900">
                {billing.usage.locations}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Plan Tiers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const isCurrent = billing?.currentPlan.id === plan.id;
          const isPopular = 'popular' in plan && plan.popular;
          return (
            <div
              key={plan.id}
              className={`bg-white rounded-xl border-2 p-5 relative ${
                isCurrent
                  ? 'border-orange-400'
                  : isPopular
                    ? 'border-purple-300'
                    : 'border-gray-200'
              }`}
            >
              {isPopular && !isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 text-xs font-semibold bg-purple-500 text-white rounded-full">
                  Most Popular
                </span>
              )}
              {isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 text-xs font-semibold bg-orange-500 text-white rounded-full">
                  Current Plan
                </span>
              )}

              <h3 className="text-lg font-bold text-gray-900 mt-2">
                {plan.name}
              </h3>
              <div className="mt-2">
                <span className="text-3xl font-bold text-gray-900">
                  ₹{plan.priceMonthly}
                </span>
                <span className="text-sm text-gray-500">/month</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                or ₹{plan.priceAnnual}/year (save ₹{plan.priceMonthly * 12 - plan.priceAnnual})
              </p>

              <ul className="mt-4 space-y-2">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => openCheckout(plan)}
                disabled={isCurrent}
                className={`w-full mt-5 px-4 py-2 text-sm font-medium rounded-lg transition cursor-pointer ${
                  isCurrent
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : isPopular
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-gray-900 hover:bg-gray-800 text-white'
                } disabled:opacity-50`}
              >
                {isCurrent ? 'Current Plan' : `Switch to ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Razorpay Notice */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-500" />
          Payment Integration
        </h3>
        <p className="text-sm text-gray-600">
          In production, Sitara uses <span className="font-medium">Razorpay</span> for
          subscription billing with UPI Autopay, cards, and net banking. During
          development, payments are simulated — no real charges are made.
        </p>
        <p className="text-xs text-gray-400 mt-2">
          GST-compliant invoices are auto-generated for each billing cycle.
        </p>
      </div>

      {/* Checkout Modal */}
      {checkoutPlan && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

            {/* Processing */}
            {checkoutStep === 'processing' && (
              <div className="p-10 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900">Processing payment...</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {paymentMethod === 'upi'
                    ? `Verifying UPI payment from ${upiId}`
                    : `Charging card ending in ${cardNumber.slice(-4)}`}
                </p>
                <p className="text-xs text-gray-400 mt-3">
                  Dev mode — simulating Razorpay payment gateway
                </p>
              </div>
            )}

            {/* Success */}
            {checkoutStep === 'success' && (
              <div className="p-10 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Payment successful!</h3>
                <p className="text-sm text-gray-500 mt-1">
                  You are now on the <span className="font-semibold text-gray-900">{checkoutPlan.name}</span> plan.
                </p>

                <div className="mt-6 p-4 bg-gray-50 rounded-xl text-left">
                  <div className="flex items-center gap-2 mb-3">
                    <Receipt className="w-4 h-4 text-gray-400" />
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice Summary</p>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">{checkoutPlan.name} plan ({billingCycle})</span>
                      <span className="text-gray-900 font-medium">₹{getPrice(checkoutPlan)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">GST (18%)</span>
                      <span className="text-gray-900 font-medium">₹{getGst(checkoutPlan)}</span>
                    </div>
                    <div className="border-t border-gray-200 pt-1.5 flex justify-between font-semibold">
                      <span className="text-gray-900">Total charged</span>
                      <span className="text-gray-900">₹{getTotal(checkoutPlan)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-3">
                    Invoice #INV-SIM-0001 &middot; GST-compliant
                  </p>
                </div>

                <button
                  onClick={closeCheckout}
                  className="mt-6 w-full py-2.5 px-4 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            )}

            {/* Payment Form */}
            {checkoutStep === 'payment' && (
              <>
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900">Subscribe to {checkoutPlan.name}</h3>
                  <button onClick={closeCheckout} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-5 space-y-5">
                  {/* Billing Cycle Toggle */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Billing cycle</p>
                    <div className="flex bg-gray-100 rounded-lg p-1">
                      <button
                        onClick={() => setBillingCycle('monthly')}
                        className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition cursor-pointer ${
                          billingCycle === 'monthly'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500'
                        }`}
                      >
                        Monthly — ₹{checkoutPlan.priceMonthly}/mo
                      </button>
                      <button
                        onClick={() => setBillingCycle('annual')}
                        className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition cursor-pointer ${
                          billingCycle === 'annual'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500'
                        }`}
                      >
                        Annual — ₹{Math.round(checkoutPlan.priceAnnual / 12)}/mo
                      </button>
                    </div>
                    {billingCycle === 'annual' && (
                      <p className="text-xs text-green-600 mt-1.5 font-medium">
                        You save ₹{checkoutPlan.priceMonthly * 12 - checkoutPlan.priceAnnual}/year with annual billing
                      </p>
                    )}
                  </div>

                  {/* Payment Method */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Payment method</p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setPaymentMethod('upi')}
                        className={`flex items-center gap-2 p-3 border-2 rounded-lg text-sm font-medium transition cursor-pointer ${
                          paymentMethod === 'upi'
                            ? 'border-orange-400 bg-orange-50 text-orange-700'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <Smartphone className="w-4 h-4" />
                        UPI
                      </button>
                      <button
                        onClick={() => setPaymentMethod('card')}
                        className={`flex items-center gap-2 p-3 border-2 rounded-lg text-sm font-medium transition cursor-pointer ${
                          paymentMethod === 'card'
                            ? 'border-orange-400 bg-orange-50 text-orange-700'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <CreditCard className="w-4 h-4" />
                        Card
                      </button>
                    </div>
                  </div>

                  {/* UPI Form */}
                  {paymentMethod === 'upi' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">UPI ID</label>
                      <input
                        type="text"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        placeholder="yourname@paytm"
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-gray-900 placeholder:text-gray-400"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Works with GPay, PhonePe, Paytm, BHIM, and all UPI apps
                      </p>
                    </div>
                  )}

                  {/* Card Form */}
                  {paymentMethod === 'card' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Card number</label>
                        <input
                          type="text"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(formatCard(e.target.value))}
                          placeholder="4111 1111 1111 1111"
                          maxLength={19}
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-gray-900 placeholder:text-gray-400 font-mono"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Expiry</label>
                          <input
                            type="text"
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(e.target.value.replace(/[^\d/]/g, '').slice(0, 5))}
                            placeholder="MM/YY"
                            maxLength={5}
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-gray-900 placeholder:text-gray-400 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">CVV</label>
                          <input
                            type="password"
                            value={cardCvv}
                            onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            placeholder="123"
                            maxLength={4}
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-gray-900 placeholder:text-gray-400 font-mono"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name on card</label>
                        <input
                          type="text"
                          value={cardName}
                          onChange={(e) => setCardName(e.target.value)}
                          placeholder="Rajesh Kumar"
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-gray-900 placeholder:text-gray-400"
                        />
                      </div>
                      <p className="text-xs text-gray-400">
                        Test card: 4111 1111 1111 1111, any future expiry, any CVV
                      </p>
                    </div>
                  )}

                  {checkoutError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      {checkoutError}
                    </div>
                  )}

                  {/* Order Summary */}
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Order summary</p>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">{checkoutPlan.name} ({billingCycle})</span>
                        <span className="text-gray-900">₹{getPrice(checkoutPlan)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">GST (18%)</span>
                        <span className="text-gray-900">₹{getGst(checkoutPlan)}</span>
                      </div>
                      <div className="border-t border-gray-200 pt-1.5 flex justify-between font-semibold">
                        <span className="text-gray-900">Total</span>
                        <span className="text-gray-900">₹{getTotal(checkoutPlan)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Pay Button */}
                  <button
                    onClick={handlePay}
                    className="w-full py-3 px-4 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <IndianRupee className="w-4 h-4" />
                    Pay ₹{getTotal(checkoutPlan)}
                  </button>

                  <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Secured by Razorpay &middot; 256-bit SSL encryption
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
