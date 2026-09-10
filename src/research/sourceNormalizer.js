export function normalizeSource(raw = {}) {
  const url = typeof raw.url === 'string' ? raw.url.trim() : '';
  const title = typeof raw.title === 'string' ? raw.title.trim() || 'Untitled source' : 'Untitled source';

  return {
    url,
    title,
    publisher: raw.publisher || 'Unknown publisher',
    source_type: raw.source_type || raw.sourceType || 'unknown',
    retrieved_at: raw.retrieved_at || raw.retrievedAt || new Date().toISOString(),
    text: typeof raw.text === 'string' ? raw.text : '',
    metadata: {
      ...raw.metadata,
      source_quality: raw.metadata?.source_quality || raw.source_quality || 'unknown',
      is_official: Boolean(raw.metadata?.is_official ?? raw.is_official ?? false),
      is_primary: Boolean(raw.metadata?.is_primary ?? raw.is_primary ?? false),
    },
    status: raw.status || 'available',
    error: raw.error || null,
  };
}

export function normalizeResearchResult(result = {}) {
  const source = normalizeSource(result.source || result);
  return {
    ok: Boolean(result.ok),
    source,
    data: Array.isArray(result.data) ? result.data : [],
    error: result.error || null,
  };
}
