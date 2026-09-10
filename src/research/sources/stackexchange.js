import { normalizeSource } from '../sourceNormalizer.js';

export async function stackexchangeSource(url, options = {}) {
  const target = typeof url === 'string' ? url.trim() : '';
  if (!target) {
    return { ok: false, source: normalizeSource({ url: target, title: 'Stack Exchange source', source_type: 'community', status: 'unavailable' }), data: [], error: 'No URL supplied' };
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
        title: 'Stack Exchange discussion',
        publisher: 'Stack Exchange',
        source_type: 'community',
        retrieved_at: new Date().toISOString(),
        text,
        metadata: { source_quality: 'community', is_official: false, is_primary: false },
        status: response.ok ? 'available' : 'unavailable',
      }),
      data: response.ok ? [{ claim: 'Public Q&A content may reveal recurring pain, tool dissatisfaction, or switching friction.', source: normalizeSource({ url: target, title: 'Stack Exchange discussion', publisher: 'Stack Exchange', source_type: 'community', retrieved_at: new Date().toISOString(), text, metadata: { source_quality: 'community', is_official: false, is_primary: false }, status: 'available' }), evidence_strength: 2, classification: 'SIGNAL', url: target, excerpt: text.slice(0, 400), reasoning: 'Community Q&A is a useful signal for real-world pain and user workflows, but it is not equivalent to customer evidence or proof of revenue.', related_assumptions: [] }] : [],
      error: response.ok ? null : `HTTP ${response.status}`,
    };
  } catch (error) {
    return { ok: false, source: normalizeSource({ url: target, title: 'Stack Exchange source', source_type: 'community', status: 'unavailable' }), data: [], error: error?.message || 'Fetch failed' };
  }
}
