export const REPORT_SECTIONS = [
  'THESIS',
  'ASSUMPTIONS',
  'EVIDENCE',
  'CONTRADICTIONS',
  'TEAM',
  'TEAM × STARTUP',
  'WHAT COULD THEY COOK?',
  'BUILD CASE',
  'KILL CASE',
  'KILL CONDITIONS',
  'UNKNOWN',
  'VERDICT',
  'WHAT WOULD CHANGE MY MIND?',
  'NEXT EXPERIMENT',
];

export function makeEvidence(data = {}) {
  const classification = data.classification || data.type || 'UNKNOWN';
  return {
    id: data.id || crypto?.randomUUID ? crypto.randomUUID() : `evidence-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    claim: data.claim || 'Unspecified claim',
    type: classification,
    classification,
    source: {
      title: data.source?.title || 'Unknown source',
      url: data.source?.url || data.url || '',
      publisher: data.source?.publisher || 'Unknown publisher',
      accessedAt: data.source?.accessedAt || new Date().toISOString(),
      sourceType: data.source?.sourceType || 'unknown',
      status: data.source?.status || 'available',
    },
    url: data.url || data.source?.url || '',
    excerpt: data.excerpt || '',
    reasoning: data.reasoning || 'No reasoning provided.',
    evidenceStrength: Number.isFinite(data.evidenceStrength) ? data.evidenceStrength : Number.isFinite(data.evidence_strength) ? data.evidence_strength : 1,
    evidence_strength: Number.isFinite(data.evidence_strength) ? data.evidence_strength : Number.isFinite(data.evidenceStrength) ? data.evidenceStrength : 1,
    confidence: Number.isFinite(data.confidence) ? data.confidence : 0.5,
    supports: Array.isArray(data.supports) ? data.supports : [],
    contradicts: Array.isArray(data.contradicts) ? data.contradicts : [],
    related_assumptions: Array.isArray(data.related_assumptions) ? data.related_assumptions : [],
  };
}

export function makeContradiction(data = {}) {
  return {
    claim: data.claim || 'Unspecified claim',
    counterEvidence: data.counterEvidence || [],
    whyItMatters: data.whyItMatters || 'The thesis may be weaker than assumed.',
    severity: data.severity || 'MEDIUM',
    whatWouldResolveIt: data.whatWouldResolveIt || 'Direct user or market evidence would resolve the contradiction.',
  };
}

export function makeTeamCapability(data = {}) {
  return {
    requiredCapability: data.requiredCapability || 'General capability',
    teamSignal: data.teamSignal || 'No public evidence found.',
    evidence: Array.isArray(data.evidence) ? data.evidence : [],
    transferability: data.transferability || 'Unknown',
    gap: data.gap || 'No clear evidence of this capability.',
    unknown: data.unknown || true,
  };
}

export function makeVerdict(data = {}) {
  return {
    verdict: data.verdict || 'REWORK',
    reasoning: data.reasoning || 'Verdict produced by the adversarial judge.',
    confidence: Number.isFinite(data.confidence) ? data.confidence : 0.5,
  };
}
