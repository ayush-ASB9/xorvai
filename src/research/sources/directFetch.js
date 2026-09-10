import { normalizeEvidenceItem } from '../normalizer.js';
import { isValidHttpUrl } from '../../utils/validation.js';
import { normalizeSource } from '../sourceNormalizer.js';

export async function directFetchSource(url, options = {}) {
  const target = typeof url === 'string' ? url.trim() : '';
  if (!target || !isValidHttpUrl(target)) {
    return { ok: false, source: normalizeSource({ url: target, title: 'Invalid URL', status: 'unavailable', source_type: 'unknown' }), data: [], error: 'Invalid URL' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 4000);
    const response = await fetch(target, { signal: controller.signal, headers: { 'User-Agent': 'xorvai-local-research/1.0' } });
    clearTimeout(timeout);

    const text = await response.text();
    const snippet = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 800);

    if (!response.ok) {
      return { ok: false, source: normalizeSource({ url: target, title: 'Direct fetch', publisher: 'remote', source_type: 'unknown', retrieved_at: new Date().toISOString(), text, metadata: { source_quality: 'unknown', is_official: false, is_primary: false }, status: 'unavailable' }), data: [], error: `HTTP ${response.status}` };
    }

    return {
      ok: true,
      source: normalizeSource({
        url: target,
        title: 'Direct fetch',
        publisher: 'remote',
        source_type: 'primary',
        retrieved_at: new Date().toISOString(),
        text,
        metadata: { source_quality: 'primary', is_official: false, is_primary: true },
        status: 'available',
      }),
      data: [normalizeEvidenceItem({
        claim: 'A direct public fetch was successful and contains public text available for review.',
        classification: 'SIGNAL',
        evidenceStrength: 2,
        confidence: 0.55,
        source: normalizeSource({
          url: target,
          title: 'Direct fetch',
          publisher: 'remote',
          source_type: 'primary',
          retrieved_at: new Date().toISOString(),
          text,
          metadata: { source_quality: 'primary', is_official: false, is_primary: true },
          status: 'available',
        }),
        excerpt: snippet,
        reasoning: 'Direct fetching provides evidence only if the public page is actually accessible and the text is relevant to the thesis.',
      })],
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      source: normalizeSource({ url: target, title: 'Direct fetch', source_type: 'unknown', status: 'unavailable' }),
      data: [],
      error: error?.message || 'Fetch failed',
    };
  }
}
