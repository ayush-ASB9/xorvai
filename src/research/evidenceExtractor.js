function stripHtml(text = '') {
  return String(text || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sentenceSplit(text = '') {
  return String(text || '')
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

export function extractClaimsFromText(text = '', source = {}, assumptions = []) {
  const cleaned = stripHtml(text);
  const sentences = sentenceSplit(cleaned);

  const claims = sentences.map((sentence, index) => ({
    id: `${source.url || 'source'}-claim-${index + 1}`,
    claim: sentence,
    type: 'UNKNOWN',
    source: {
      title: source.title || 'Unknown source',
      url: source.url || '',
      publisher: source.publisher || 'Unknown publisher',
      accessedAt: source.retrieved_at || new Date().toISOString(),
      sourceType: source.source_type || 'unknown',
      status: source.status || 'available',
    },
    url: source.url || '',
    evidence_strength: 2,
    supports: [],
    contradicts: [],
    related_assumptions: assumptions.slice(0, 2),
    confidence: 0.5,
    notes: 'Claim extracted from public text with no independent verification beyond the source itself.',
  }));

  return claims;
}

export function deduplicateEvidence(items = []) {
  const map = new Map();

  for (const item of items) {
    const key = `${(item.source && item.source.url) || item.url || ''}|${(item.claim || '').trim()}`;
    if (!key) continue;

    if (!map.has(key)) {
      map.set(key, { ...item, source_count: 1 });
      continue;
    }

    const existing = map.get(key);
    existing.source_count = (existing.source_count || 1) + 1;
    existing.supports = Array.from(new Set([...(existing.supports || []), ...(item.supports || [])]));
    existing.contradicts = Array.from(new Set([...(existing.contradicts || []), ...(item.contradicts || [])]));
    existing.related_assumptions = Array.from(new Set([...(existing.related_assumptions || []), ...(item.related_assumptions || [])]));
  }

  return Array.from(map.values());
}

export function extractEvidenceFromSource(source = {}, assumptions = []) {
  const text = source.text || '';
  const claims = extractClaimsFromText(text, source, assumptions);

  return claims.map((item) => ({
    ...item,
    added_by: source.metadata?.source_quality || source.source_type || 'unknown',
    classification: item.claim.toLowerCase().includes('not') || item.claim.toLowerCase().includes('no') ? 'UNKNOWN' : 'SIGNAL',
  }));
}
