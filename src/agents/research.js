import { createResearchMissions } from '../research/missions.js';
import { fetchPage, searchGitHub, searchGoogleNews, searchHackerNews, searchWeb } from '../research/search.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('RESEARCH');
const SEARCHED_MISSIONS = ['demand', 'current-behavior', 'competition', 'negative-evidence'];
const MAX_EVIDENCE = 15;
const STOPWORDS = new Set('a an and app apps are as at be build builds by can for from help helps in into is it its let lets like of on or our platform service so startup that the their them they this to tool use uses using via we which who will with without you your'.split(' '));

// Without the AI model: the idea's first few content words, so search still runs.
function fallbackQuery(idea = '') {
  const words = String(idea).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((word) => word.length > 1 && !STOPWORDS.has(word));
  return words.slice(0, 4).join(' ') || String(idea).slice(0, 60);
}

function describeIdea(input = {}) {
  return [
    `Idea: ${input.idea}`,
    input.description && `Description: ${input.description}`,
    input.customerProblem && `Customer pain: ${input.customerProblem}`,
    input.context && `Context: ${input.context}`,
  ].filter(Boolean).join('\n');
}

async function planQueries(ai, input) {
  const fallback = [fallbackQuery(input.idea)];
  const queries = { type: 'array', items: { type: 'string' }, description: '2 or 3 queries, each 2 to 4 keywords.' };
  const plan = await ai.generateJSON(`Plan web searches for an adversarial review of the startup idea below. The searches run on a web search engine, Google News, Hacker News and GitHub. The last three return nothing for long queries, so give 2 or 3 queries per mission and keep each to 2 to 4 plain keywords with no quotes or operators. Search for one thing per query: name a single competitor, or a single problem in the words the press and users would use, and add the country or region only when the idea names one. For example, competition for a food delivery idea in India: ["Swiggy", "Zomato", "food delivery app India"].

- demand: people or businesses describing this pain or need
- current-behavior: how people handle the problem today
- competition: existing companies, apps or open-source projects doing this or something close
- negative-evidence: failures, shutdowns, complaints, regulation or costs that threaten the idea

${describeIdea(input)}`, {
    type: 'object',
    properties: Object.fromEntries(SEARCHED_MISSIONS.map((mission) => [mission, queries])),
    required: SEARCHED_MISSIONS,
    additionalProperties: false,
  }, { effort: 'low' });

  // The model sometimes still writes long queries; past 5 words keyword search finds almost nothing.
  return Object.fromEntries(SEARCHED_MISSIONS.map((mission) => {
    const planned = (Array.isArray(plan?.[mission]) ? plan[mission] : [])
      .map((query) => String(query).replace(/["']/g, '').split(/\s+/).filter(Boolean).slice(0, 5).join(' '))
      .filter(Boolean)
      .slice(0, 3);
    return [mission, planned.length ? planned : fallback];
  }));
}

function buildSearches(input, queries, webSearchKey) {
  const searches = [];
  for (const mission of SEARCHED_MISSIONS) {
    // Web search spends the free monthly quota (1,000 searches), so it runs once per mission: about 250 analyses a month.
    if (webSearchKey) {
      const query = queries[mission][0];
      searches.push({ mission, query, source: 'Web', run: () => searchWeb(query, webSearchKey) });
    }
    for (const query of queries[mission]) {
      searches.push({ mission, query, source: 'Google News', run: () => searchGoogleNews(query, 3) });
      searches.push({ mission, query, source: 'Hacker News', run: () => searchHackerNews(query, 2) });
      if (mission === 'competition') searches.push({ mission, query, source: 'GitHub', run: () => searchGitHub(query, 2) });
    }
  }

  // Pages the founder named. normalizeIdeaInput has already rejected private and local URLs.
  const pages = [
    ...[input.startupUrl].filter(Boolean).map((url) => ({ url, mission: 'startup' })),
    ...(input.competitorUrls || []).map((url) => ({ url, mission: 'competition' })),
    ...(input.teamUrls || []).map((url) => ({ url, mission: 'team' })),
  ].slice(0, 5);
  for (const page of pages) {
    searches.push({ mission: page.mission, query: page.url, source: 'Web page', run: () => fetchPage(page.url) });
  }
  return searches;
}

function formatResults(results) {
  return results.map((result, index) => [
    `[${index}] ${result.source} · ${result.publisher}${result.date ? ` · ${result.date}` : ''} · searched for ${result.mission}`,
    result.title,
    result.snippet,
  ].filter(Boolean).join('\n')).join('\n\n');
}

async function assessResults(ai, input, results) {
  const assessment = await ai.generateJSON(`You are screening search results for an adversarial review of a startup idea. Keep only results that bear on whether the idea survives: demand or pain, how people cope today, competitors and substitutes, failed attempts, regulation, or costs. Drop results that only share keywords with the idea. When several results report the same event, keep only the most informative one.

You see each result's title, publisher, date and snippet, not the page itself. Write each claim from that text alone, and leave out any number, name or outcome it does not state.

For each result you keep:
- index: its number in brackets
- claim: one sentence on what the result shows
- classification: FACT when it reports a specific, checkable event or figure, such as a launch, acquisition, shutdown, ruling, funding round or price; SIGNAL when it only indicates demand, pain, behavior or sentiment
- stance: supports when it makes the idea more likely to work, contradicts when it makes it less likely (an entrenched competitor, a failed attempt, a rule, a cost), neutral otherwise
- assumption: the part of the idea it supports or challenges, in a few words
- strength: 1 for a faint or indirect hint, up to 5 for direct, specific evidence
- reasoning: one sentence on why it matters for this idea

${describeIdea(input)}

Results:
${formatResults(results)}`, {
    type: 'object',
    properties: {
      evidence: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            index: { type: 'integer' },
            claim: { type: 'string' },
            classification: { type: 'string', enum: ['FACT', 'SIGNAL'] },
            stance: { type: 'string', enum: ['supports', 'contradicts', 'neutral'] },
            assumption: { type: 'string' },
            strength: { type: 'integer' },
            reasoning: { type: 'string' },
          },
          required: ['index', 'claim', 'classification', 'stance', 'assumption', 'strength', 'reasoning'],
          additionalProperties: false,
        },
      },
    },
    required: ['evidence'],
    additionalProperties: false,
  }, { effort: 'low' });

  return Array.isArray(assessment?.evidence) ? assessment.evidence : null;
}

function toEvidence(result, assessed) {
  const meta = [result.date, result.publisher].filter(Boolean).join(' · ');
  return {
    claim: assessed?.claim || result.title,
    classification: assessed?.classification || 'UNKNOWN',
    source: {
      title: result.title,
      url: result.url,
      publisher: result.publisher,
      accessedAt: new Date().toISOString(),
      sourceType: result.source,
      status: 'available',
    },
    url: result.url,
    excerpt: `${meta}: ${result.title}${result.snippet ? ` — ${result.snippet}` : ''}`,
    reasoning: assessed?.reasoning || `Search result for "${result.query}". Its relevance was not assessed because the AI model was unavailable.`,
    evidenceStrength: assessed ? Math.min(5, Math.max(1, Math.round(Number(assessed.strength) || 1))) : 1,
    supports: assessed?.stance === 'supports' ? [assessed.assumption] : [],
    contradicts: assessed?.stance === 'contradicts' ? [assessed.assumption] : [],
  };
}

// env.TAVILY_API_KEY turns on general web search alongside the keyless sources.
export async function runResearch(input = {}, ai, env = {}) {
  const missions = createResearchMissions(input);
  const queries = await planQueries(ai, input);
  const searches = buildSearches(input, queries, env.TAVILY_API_KEY);
  const settled = await Promise.allSettled(searches.map((search) => search.run()));

  const limitations = [];
  const seen = new Set();
  const results = [];
  settled.forEach((outcome, index) => {
    const search = searches[index];
    if (outcome.status === 'rejected') {
      limitations.push(`${search.source} search for "${search.query}" failed: ${outcome.reason?.message || outcome.reason}`);
      return;
    }
    for (const result of outcome.value) {
      if (!result.url || seen.has(result.url)) continue;
      seen.add(result.url);
      results.push({ ...result, mission: search.mission, query: search.query });
    }
  });
  if (limitations.length) logger.warn(limitations.join('; '));

  const assessments = results.length ? await assessResults(ai, input, results) : [];
  const assessedIndexes = new Set();
  const evidence = assessments
    ? assessments
      .filter((item) => results[item.index] && !assessedIndexes.has(item.index) && assessedIndexes.add(item.index))
      .map((item) => toEvidence(results[item.index], item))
    : results.map((result) => toEvidence(result, null));
  evidence.sort((a, b) => b.evidenceStrength - a.evidenceStrength);
  const kept = evidence.slice(0, MAX_EVIDENCE);

  if (!assessments) limitations.push('The AI model was unavailable, so search results are listed without a relevance check.');
  const challenging = kept.filter((item) => item.contradicts.length).length;
  const supporting = kept.filter((item) => item.supports.length).length;

  return {
    stage: 'RESEARCH',
    missions: missions.map((mission) => ({ ...mission, query: (queries[mission.missionType] || []).join(' · ') })),
    evidence: kept,
    limitations,
    summary: `Ran ${searches.length} searches across ${env.TAVILY_API_KEY ? 'the web, ' : ''}Google News, Hacker News and GitHub and kept ${kept.length} of ${results.length} results: ${supporting} support the idea, ${challenging} challenge it.`,
  };
}
