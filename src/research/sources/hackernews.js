import { normalizeSource } from '../sourceNormalizer.js';

export async function hackernewsSource(url, options = {}) {
  const target = typeof url === 'string' ? url.trim() : '';
  if (!target) {
    return { ok: false, source: normalizeSource({ url: target, title: 'Hacker News source', source_type: 'community', status: 'unavailable' }), data: [], error: 'No URL supplied' };
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
        title: 'Hacker News discussion',
        publisher: 'Hacker News',
        source_type: 'community',
        retrieved_at: new Date().toISOString(),
        text,
        metadata: { source_quality: 'community', is_official: false, is_primary: false },
        status: response.ok ? 'available' : 'unavailable',
      }),
      data: response.ok ? [{ claim: 'Community discussion or commentary may reveal demand, pain points, and adoption concerns.', source: normalizeSource({ url: target, title: 'Hacker News discussion', publisher: 'Hacker News', source_type: 'community', retrieved_at: new Date().toISOString(), text, metadata: { source_quality: 'community', is_official: false, is_primary: false }, status: 'available' }), evidence_strength: 2, classification: 'SIGNAL', url: target, excerpt: text.slice(0, 400), reasoning: 'Community discussion is a useful signal for customer pain and market perception but not proof of product-market fit.', related_assumptions: [] }] : [],
      error: response.ok ? null : `HTTP ${response.status}`,
    };
  } catch (error) {
    return { ok: false, source: normalizeSource({ url: target, title: 'Hacker News source', source_type: 'community', status: 'unavailable' }), data: [], error: error?.message || 'Fetch failed' };
  }
}
