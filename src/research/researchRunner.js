import { normalizeResearchResult } from './sourceNormalizer.js';

export async function runResearchSources(sources = []) {
  const results = [];

  const tasks = sources.map(async (source) => {
    try {
      const adapter = source.adapter || source.runner;
      if (!adapter || typeof adapter !== 'function') {
        return {
          ok: false,
          source: { url: source.url || '', title: source.title || 'Unknown source', status: 'unavailable' },
          data: [],
          error: 'No valid adapter available',
        };
      }

      const response = await adapter(source.url, source.options || {});
      return normalizeResearchResult(response);
    } catch (error) {
      return {
        ok: false,
        source: { url: source.url || '', title: source.title || 'Unknown source', status: 'unavailable' },
        data: [],
        error: error?.message || 'Unknown research error',
      };
    }
  });

  const settled = await Promise.all(tasks);
  for (const item of settled) {
    if (item && Array.isArray(item.data)) {
      results.push(...item.data);
    }
  }

  return results;
}
