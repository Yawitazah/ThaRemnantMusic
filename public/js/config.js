// Supabase connection.
// The publishable ("anon") key is safe in client code — it is public by design.
// Write access is gated by Row Level Security: only signed-in accounts can change data.
// A server can override these at runtime by defining window.__CONFIG__ before this loads.

const injected = (typeof window !== 'undefined' && window.__CONFIG__) || {};

export const SUPABASE_URL =
  injected.SUPABASE_URL || 'https://upfqppdfckqehzgsosdi.supabase.co';

export const SUPABASE_ANON_KEY =
  injected.SUPABASE_ANON_KEY || 'sb_publishable_c0j0FTpd3X-joAr673KR4A_NmMGSP7u';

// Benchmarks used across tabs when the DB has not been re-pulled.
export const FALLBACK_BENCHMARKS = {
  gtAvg: 17140,
  musicAvg: 1406,
  priorAvg: 8109,
  noRemedyBig: 4797,
  noRemedySmall: 972,
  featureAvg: 10514,
  topTenAvg: 50245,
};
