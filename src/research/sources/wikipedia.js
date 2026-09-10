import { normalizeSource } from '../sourceNormalizer.js';

export async function wikipediaSource(url, options = {}) {
  const target = typeof url === 'string' ? url.trim() : '';
  if (!target) {
    return { ok: false, source: normalizeSource({ url: target, title: 'Wikipedia source', source_type: 'secondary', status: 'unavailable' }), data: [], error: 'No URL supplied' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 4000);
    const response = await fetch(target, { signal: controller.signal, headers: { 'User-Agent': 'xorvai-local-research/1.0' } });
    clearTimeout(timeout);

    const text = await response.text();
    return {
      ok: response.ok,
      source: normalizeSource({
        url: target,
        title: 'Wikipedia entry',
        publisher: 'Wikipedia',
        source_type: 'secondary',
        retrieved_at: new Date().toISOString(),
        text,
        metadata: { source_quality: 'secondary', is_official: false, is_primary: false },
        status: response.ok ? 'available' : 'unavailable',
      }),
      data: response.ok ? [{ claim: 'Wikipedia content was fetched and can contribute background context when relevant to the startup thesis.', source: normalizeSource({ url: target, title: 'Wikipedia entry', publisher: 'Wikipedia', source_type: 'secondary', retrieved_at: new Date().toISOString(), text, metadata: { source_quality: 'secondary', is_official: false, is_primary: false }, status: 'available' }), evidence_strength: 2, classification: 'SIGNAL', url: target, excerpt: text.slice(0, 400), reasoning: 'Wikipedia provides general background context but should not be treated as primary evidence.', related_assumptions: [] }] : [],
      error: response.ok ? null : `HTTP ${response.status}`,
    };
  } catch (error) {
    return { ok: false, source: normalizeSource({ url: target, title: 'Wikipedia source', source_type: 'secondary', status: 'unavailable' }), data: [], error: error?.message || 'Fetch failed' };
  }
}
