import { normalizeEvidenceItem } from '../normalizer.js';
import { normalizeSource } from '../sourceNormalizer.js';
import { isValidHttpUrl } from '../../utils/validation.js';

export async function githubSource(url, options = {}) {
  const target = typeof url === 'string' ? url.trim() : '';
  if (!target || !isValidHttpUrl(target)) {
    return { ok: false, source: normalizeSource({ url: target, title: 'GitHub source', source_type: 'official', status: 'unavailable' }), data: [], error: 'Invalid URL' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 4000);
    const response = await fetch(target, { signal: controller.signal, headers: { 'User-Agent': 'xorvai-local-research/1.0' } });
    clearTimeout(timeout);
    const text = await response.text();

    if (!response.ok) {
      return { ok: false, source: normalizeSource({ url: target, title: 'GitHub source', publisher: 'GitHub', source_type: 'official', retrieved_at: new Date().toISOString(), text, metadata: { source_quality: 'official', is_official: true, is_primary: false }, status: 'unavailable' }), data: [], error: `HTTP ${response.status}` };
    }

    return {
      ok: true,
      source: normalizeSource({
        url: target,
        title: 'GitHub profile or repository',
        publisher: 'GitHub',
        source_type: 'official',
        retrieved_at: new Date().toISOString(),
        text,
        metadata: { source_quality: 'official', is_official: true, is_primary: false },
        status: 'available',
      }),
      data: [normalizeEvidenceItem({
        claim: 'Public GitHub activity may be evidence of technical capability or prior execution.',
        classification: 'SIGNAL',
        evidenceStrength: 2,
        confidence: 0.6,
        source: normalizeSource({
          url: target,
          title: 'GitHub profile or repository',
          publisher: 'GitHub',
          source_type: 'official',
          retrieved_at: new Date().toISOString(),
          text,
          metadata: { source_quality: 'official', is_official: true, is_primary: false },
          status: 'available',
        }),
        excerpt: text.slice(0, 500),
        reasoning: 'GitHub is public evidence for technical execution, but it is not proof of startup viability or market demand.',
      })],
      error: null,
    };
  } catch (error) {
    return { ok: false, source: normalizeSource({ url: target, title: 'GitHub source', source_type: 'official', status: 'unavailable' }), data: [], error: error?.message || 'Fetch failed' };
  }
}
