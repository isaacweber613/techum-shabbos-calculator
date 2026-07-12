export const MAX_SNAPSHOT_BYTES = 5_000_000;

export type RegistrySubmission = {
  slug: string;
  cityLabel: string;
  snapshot: Record<string, unknown>;
  review: {
    reviewerName: string;
    reviewedAt: string;
    decision: 'approved' | 'approved-with-conditions';
    conditions?: string;
    sourceNotes: string;
  };
};

export function validateRegistrySubmission(raw: unknown): { ok: true; value: RegistrySubmission; snapshotJson: string } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'object required' };
  const input = raw as Record<string, unknown>;
  const slug = typeof input.slug === 'string' ? input.slug.trim().toLowerCase() : '';
  const cityLabel = typeof input.cityLabel === 'string' ? input.cityLabel.trim() : '';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) return { ok: false, error: 'invalid slug' };
  if (!cityLabel || cityLabel.length > 200) return { ok: false, error: 'invalid cityLabel' };
  if (!input.snapshot || typeof input.snapshot !== 'object' || Array.isArray(input.snapshot)) return { ok: false, error: 'snapshot object required' };
  const review = input.review;
  if (!review || typeof review !== 'object' || Array.isArray(review)) return { ok: false, error: 'review metadata required' };
  const r = review as Record<string, unknown>;
  const reviewerName = typeof r.reviewerName === 'string' ? r.reviewerName.trim() : '';
  const reviewedAt = typeof r.reviewedAt === 'string' ? r.reviewedAt.trim() : '';
  const decision = r.decision;
  const sourceNotes = typeof r.sourceNotes === 'string' ? r.sourceNotes.trim() : '';
  const conditions = typeof r.conditions === 'string' ? r.conditions.trim() : undefined;
  if (!reviewerName || reviewerName.length > 200) return { ok: false, error: 'reviewerName required' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewedAt) || Number.isNaN(Date.parse(reviewedAt + 'T00:00:00Z'))) return { ok: false, error: 'reviewedAt must be YYYY-MM-DD' };
  if (decision !== 'approved' && decision !== 'approved-with-conditions') return { ok: false, error: 'invalid review decision' };
  if (!sourceNotes || sourceNotes.length > 5000) return { ok: false, error: 'sourceNotes required' };
  if (decision === 'approved-with-conditions' && !conditions) return { ok: false, error: 'conditions required for conditional approval' };
  if (conditions && conditions.length > 5000) return { ok: false, error: 'conditions too long' };
  let snapshotJson: string;
  try { snapshotJson = JSON.stringify(input.snapshot); } catch { return { ok: false, error: 'snapshot must be JSON serializable' }; }
  if (new TextEncoder().encode(snapshotJson).byteLength > MAX_SNAPSHOT_BYTES) return { ok: false, error: 'snapshot exceeds 5 MB' };
  return { ok: true, value: { slug, cityLabel, snapshot: input.snapshot as Record<string, unknown>, review: {
    reviewerName, reviewedAt, decision, ...(conditions ? { conditions } : {}), sourceNotes,
  } }, snapshotJson };
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
