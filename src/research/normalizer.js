export function normalizeSource(raw = {}) {
  return {
    title: raw.title || 'Untitled source',
    url: raw.url || '',
    sourceType: raw.sourceType || raw.type || 'unknown',
    publisher: raw.publisher || 'Unknown publisher',
    accessedAt: raw.accessedAt || new Date().toISOString(),
    status: raw.status || 'available',
  };
}

export function normalizeEvidenceItem(item = {}) {
  return {
    id: item.id || `raw-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    claim: item.claim || 'Unspecified claim',
    classification: ['FACT', 'SIGNAL', 'ASSUMPTION', 'UNKNOWN'].includes(item.classification) ? item.classification : 'UNKNOWN',
    source: normalizeSource(item.source || {}),
    excerpt: item.excerpt || '',
    reasoning: item.reasoning || 'No reasoning provided.',
    evidenceStrength: Number.isFinite(item.evidenceStrength) ? item.evidenceStrength : 1,
    confidence: Number.isFinite(item.confidence) ? item.confidence : 0.5,
    supports: Array.isArray(item.supports) ? item.supports : [],
    contradicts: Array.isArray(item.contradicts) ? item.contradicts : [],
  };
}

export function deduplicateSources(results = []) {
  const seen = new Set();
  return results.filter((result) => {
    const key = result?.source?.url || result?.url || result?.title || `${Math.random()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
