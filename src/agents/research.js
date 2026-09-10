import { createResearchMissions } from '../research/missions.js';
import { deduplicateSources, normalizeEvidenceItem } from '../research/normalizer.js';
import { directFetchSource } from '../research/sources/directFetch.js';
import { githubSource } from '../research/sources/github.js';
import { createLogger } from '../utils/logger.js';
import { isValidHttpUrl } from '../utils/validation.js';

const logger = createLogger('RESEARCH');

export async function runResearch(input = {}, sourceAdapters = []) {
  const missions = createResearchMissions(input);
  const results = [];

  for (const mission of missions) {
    const adapters = sourceAdapters.length > 0 ? sourceAdapters : [
      { name: 'directFetch', runner: directFetchSource },
      { name: 'github', runner: githubSource },
    ];

    for (const adapter of adapters) {
      try {
        const candidateUrl = input.startupUrl || input.teamUrls?.[0] || 'https://example.com';
        const normalizedUrl = adapter.name === 'github' ? (input.teamUrls?.[0] || candidateUrl) : candidateUrl;
        if (!normalizedUrl || !isValidHttpUrl(normalizedUrl)) {
          continue;
        }

        const adapterResult = await adapter.runner(normalizedUrl, { timeoutMs: 2500 });
        if (adapterResult?.ok === false && adapterResult?.error) {
          logger.warn('Research adapter failed', adapter.name, adapterResult.error);
        }

        if (adapterResult?.data?.length) {
          results.push(...adapterResult.data.map((item) => normalizeEvidenceItem(item)));
        }
      } catch (error) {
        logger.warn('Adapter threw', adapter.name, error?.message || String(error));
      }
    }
  }

  const deduped = deduplicateSources(results.map((item) => ({ ...item, source: item.source || { url: 'unknown' } })));

  return {
    missions,
    evidence: deduped,
    limitations: ['Source access is limited by network and local environment constraints.'],
    stage: 'RESEARCH',
    summary: `Collected ${deduped.length} normalized evidence items across ${missions.length} missions.`,
  };
}
