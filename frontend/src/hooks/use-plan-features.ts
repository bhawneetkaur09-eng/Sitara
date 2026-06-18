'use client';

import { useEffect, useState } from 'react';
import { api, type PlanFeatures } from '@/lib/api';

let cachedFeatures: PlanFeatures | null = null;

export function usePlanFeatures() {
  const [features, setFeatures] = useState<PlanFeatures | null>(cachedFeatures);
  const [loading, setLoading] = useState(!cachedFeatures);

  useEffect(() => {
    if (cachedFeatures) return;
    api.billing
      .getFeatures()
      .then((f) => {
        cachedFeatures = f;
        setFeatures(f);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const hasFeature = (feature: string) =>
    features?.features.includes(feature) ?? false;

  return { features, loading, hasFeature, plan: features?.plan ?? 'starter' };
}
