/** Single source of truth for subscription plan data across API and frontends. */

export const PLAN_LABELS = {
  free: 'مجاني',
  starter: 'مبتدئ',
  pro: 'احترافي',
  enterprise: 'مؤسسي',
};

export const PLAN_ORDER = ['free', 'starter', 'pro', 'enterprise'];

/** Limits enforced by the API. */
export const PLAN_DEFINITIONS = {
  free: {
    websites: 1,
    queriesPerMonth: 500,
    documentsPerWebsite: 5,
    apiKeys: 1,
    maxUploadMb: 5,
  },
  starter: {
    websites: 1,
    queriesPerMonth: 10_000,
    documentsPerWebsite: 100,
    apiKeys: 3,
    maxUploadMb: 15,
  },
  pro: {
    websites: 1,
    queriesPerMonth: 50_000,
    documentsPerWebsite: 500,
    apiKeys: 10,
    maxUploadMb: 15,
  },
  enterprise: {
    websites: 1,
    queriesPerMonth: null,
    documentsPerWebsite: null,
    apiKeys: null,
    maxUploadMb: 50,
  },
};

/** Marketing catalog for billing/pricing pages. */
export const PLAN_CATALOG = [
  {
    id: 'free',
    name: 'مجاني',
    monthlyPrice: 0,
    annualPrice: 0,
    price: '٠ ر.س',
    desc: 'للتجربة وموقع واحد',
    features: ['٥٠٠ استعلام/شهر', 'موقع واحد', '٥ مستندات/موقع', 'مفتاح API واحد', 'رفع حتى 5 MB'],
    color: 'var(--text-3)',
  },
  {
    id: 'starter',
    name: 'مبتدئ',
    monthlyPrice: 109,
    annualPrice: 87,
    price: '١٠٩ ر.س',
    desc: 'للمواقع الصغيرة التي بدأت لتوها',
    features: ['١٠٬٠٠٠ استعلام/شهر', 'موقع واحد', '١٠٠ مستند', '٣ مفاتيح API', 'رفع حتى 15 MB'],
    color: 'var(--blue)',
  },
  {
    id: 'pro',
    name: 'احترافي',
    monthlyPrice: 299,
    annualPrice: 239,
    price: '٢٩٩ ر.س',
    desc: 'للشركات والفرق النامية',
    features: ['٥٠٬٠٠٠ استعلام/شهر', 'موقع واحد', '٥٠٠ مستند', '١٠ مفاتيح API', 'تحليلات متقدمة'],
    color: 'var(--accent)',
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'مؤسسي',
    monthlyPrice: null,
    annualPrice: null,
    price: 'مخصص',
    desc: 'للنشر على نطاق واسع',
    features: ['استعلامات بلا حد', 'موقع واحد', 'مستندات بلا حد', 'مفاتيح بلا حد', 'دعم مخصص'],
    color: 'var(--amber)',
  },
];

/** Compact options for admin dropdowns. */
export const PLAN_OPTIONS = PLAN_ORDER.map((id) => ({
  value: id,
  label: PLAN_LABELS[id],
  hint:
    PLAN_DEFINITIONS[id].websites == null
      ? 'بلا حد'
      : `${PLAN_DEFINITIONS[id].websites} موقع${PLAN_DEFINITIONS[id].websites === 1 ? '' : 'ات'}`,
}));

export function normalizePlan(plan) {
  const id = String(plan || 'free').toLowerCase();
  return PLAN_DEFINITIONS[id] ? id : 'free';
}

export function getPlanLimits(plan) {
  const id = normalizePlan(plan);
  return {
    id,
    label: PLAN_LABELS[id],
    ...PLAN_DEFINITIONS[id],
  };
}

/** Monthly recurring revenue in SAR — derived from marketing catalog. */
export const PLAN_MRR_SAR = Object.fromEntries(
  PLAN_ORDER.map((id) => [id, PLAN_CATALOG.find((p) => p.id === id)?.monthlyPrice ?? 0])
);

export function toArabicNumerals(n) {
  return String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
}

/** Pricing page cards — single source aligned with API limits. */
export function getPricingPagePlans() {
  return PLAN_CATALOG.map((plan) => ({
    id: plan.id,
    name: plan.name,
    desc: plan.desc,
    monthlyPrice: plan.monthlyPrice,
    annualPrice: plan.annualPrice,
    currency: 'ر.س',
    period: plan.monthlyPrice === 0 ? '/للأبد' : '/شهر',
    features: plan.features,
    cta: plan.id === 'enterprise' ? 'تواصل معنا' : plan.id === 'free' ? 'ابدأ مجاناً' : 'ابدأ الآن',
    popular: plan.popular || false,
  }));
}

/** Public API response shape for GET /v1/plans */
export function getPublicPlans() {
  return {
    plans: PLAN_ORDER.map((id) => {
      const catalog = PLAN_CATALOG.find((p) => p.id === id);
      const limits = PLAN_DEFINITIONS[id];
      return {
        id,
        label: PLAN_LABELS[id],
        limits,
        marketing: catalog
          ? {
              desc: catalog.desc,
              monthlyPrice: catalog.monthlyPrice,
              annualPrice: catalog.annualPrice,
              price: catalog.price,
              features: catalog.features,
              color: catalog.color,
              popular: catalog.popular || false,
            }
          : null,
      };
    }),
  };
}
