import { makeEvidence } from '../schemas/report.js';

export function classifyClaim(claim) {
  if (!claim || typeof claim !== 'string') return 'UNKNOWN';
  const normalized = claim.trim();
  if (normalized.toUpperCase().includes('MAYBE') || normalized.toUpperCase().includes('LIKELY') || normalized.toUpperCase().includes('POSSIBLY')) return 'ASSUMPTION';
  if (normalized.toUpperCase().includes('WE OBSERVED') || normalized.toUpperCase().includes('DATA') || normalized.toUpperCase().includes('DOCUMENTED')) return 'FACT';
  if (normalized.toUpperCase().includes('SIGNAL') || normalized.toUpperCase().includes('INDICATION')) return 'SIGNAL';
  return 'UNKNOWN';
}

export function buildEvidenceSet(items = []) {
  return items.map((item, index) => makeEvidence({
    id: `e-${index + 1}`,
    claim: item.claim || 'Claim missing',
    classification: item.classification || item.type || classifyClaim(item.claim),
    type: item.type || item.classification || classifyClaim(item.claim),
    source: item.source || {},
    url: item.url || item.source?.url || '',
    excerpt: item.excerpt || item.text || '',
    reasoning: item.reasoning || 'Evidence is being normalized into the standard XORVAI evidence format.',
    evidenceStrength: item.evidenceStrength ?? item.evidence_strength ?? 2,
    evidence_strength: item.evidence_strength ?? item.evidenceStrength ?? 2,
    confidence: item.confidence ?? 0.5,
    supports: item.supports || [],
    contradicts: item.contradicts || [],
    related_assumptions: item.related_assumptions || [],
  }));
}
