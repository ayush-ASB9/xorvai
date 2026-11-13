import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIdeaInput, isValidHttpUrl } from '../src/utils/validation.js';
import { buildEvidenceSet } from '../src/analysis/evidence.js';
import { findContradictions } from '../src/analysis/contradictions.js';
import { determineVerdict } from '../src/analysis/verdict.js';
import { orchestrateAnalysis } from '../src/agents/orchestrator.js';
import { runResearch } from '../src/agents/research.js';
import { assessTeamFit } from '../src/analysis/teamFit.js';
import { deriveCookOpportunities } from '../src/analysis/cook.js';

test('URL validation rejects invalid or private URLs', () => {
  assert.equal(isValidHttpUrl('https://example.com'), true);
  assert.equal(isValidHttpUrl('ftp://example.com'), false);
  assert.equal(isValidHttpUrl('not-a-url'), false);
  assert.equal(isValidHttpUrl('http://localhost:3000'), false);
});

test('Input normalization accepts valid idea data', () => {
  const normalized = normalizeIdeaInput({ idea: 'AI compliance workflow', startupUrl: 'https://example.com' });
  assert.equal(normalized.idea, 'AI compliance workflow');
  assert.equal(normalized.depth, 'STANDARD');
});

test('Evidence normalization preserves classification and provenance', () => {
  const evidence = buildEvidenceSet([{ claim: 'Demand is real', classification: 'FACT', source: { title: 'Example page', url: 'https://example.com', publisher: 'Example', accessedAt: '2026-01-01T00:00:00Z' } }]);
  assert.equal(evidence[0].classification, 'FACT');
  assert.equal(evidence[0].source.url, 'https://example.com');
});

test('Contradiction engine can represent a direct contradiction', () => {
  const evidence = [{ claim: 'Customers need this now', contradicts: ['Customers already solve this with spreadsheets.'], source: { url: 'https://example.com' } }];
  const contradictions = findContradictions(evidence);
  assert.equal(contradictions.length, 1);
  assert.equal(contradictions[0].severity, 'MEDIUM');
});

test('Verdict logic can choose KILL or BUILD', () => {
  assert.equal(determineVerdict({ contradictions: [{}, {}], unknown: [{}, {}] }).verdict, 'KILL');
  assert.equal(determineVerdict({ contradictions: [], unknown: [] }).verdict, 'BUILD');
});

// Answers the requests research makes: Google News RSS, Hacker News, GitHub, a founder page,
// and the AI gateway, which plans queries and then screens the numbered results.
function fakeResearchWeb({ hackerNewsStatus = 200, tavilyStatus = 200 } = {}) {
  const calls = { searches: [], prompts: [], tavilyKeys: [] };
  const fetch = async (url, init = {}) => {
    const target = new URL(String(url));
    if (target.hostname === 'gateway.example') {
      const body = JSON.parse(init.body);
      const prompt = body.messages[0].content;
      calls.prompts.push(prompt);
      const properties = body.output_config.format.schema.properties;
      let answer;
      if (properties.demand) {
        answer = { demand: ['society maintenance dues', '"RWA" collections in Indian housing societies today'], 'current-behavior': ['society maintenance excel'], competition: ['society management app', 'MyGate'], 'negative-evidence': ['maintenance app complaints'] };
      } else if (properties.evidence) {
        const indexOf = (title) => Number(prompt.match(new RegExp(`\\[(\\d+)\\][^\\n]*\\n${title}`))[1]);
        answer = { evidence: [
          { index: indexOf('acme/society-billing'), claim: 'An open-source society billing tool already exists.', classification: 'FACT', stance: 'contradicts', assumption: 'no free alternative', strength: 4, reasoning: 'A free substitute caps pricing.' },
          { index: indexOf('Residents protest unpaid maintenance'), claim: 'Societies struggle to collect dues.', classification: 'SIGNAL', stance: 'supports', assumption: 'collection is painful', strength: 3, reasoning: 'Shows the pain is real.' },
        ] };
      } else {
        answer = { verdict: 'REWORK', reasoning: 'Mixed evidence.', strongest_evidence: [], strongest_contradiction: [], biggest_unknown: 'Pricing', kill_conditions: [], confidence: 0.6 };
      }
      return Response.json({ content: [{ type: 'text', text: JSON.stringify(answer) }], stop_reason: 'end_turn' });
    }

    if (target.hostname === 'api.tavily.com') {
      const body = JSON.parse(init.body);
      calls.searches.push(['Web', body.query]);
      calls.tavilyKeys.push(init.headers.Authorization);
      if (tavilyStatus !== 200) return Response.json({ detail: { error: 'limit' } }, { status: tavilyStatus });
      return Response.json({ results: [{ title: 'Why RWAs still chase dues on WhatsApp', url: `https://www.blog.example/${encodeURIComponent(body.query)}`, content: 'Treasurers in 40 Pune societies said they reconcile UPI screenshots by hand.', published_date: 'Mon, 02 Nov 2026 10:00:00 GMT' }] });
    }
    if (target.hostname === 'news.google.com') {
      calls.searches.push(['Google News', target.searchParams.get('q')]);
      return new Response(`<rss><channel><item><title>Residents protest unpaid maintenance - City Times</title><link>https://news.example/maintenance</link><pubDate>Tue, 03 Nov 2026 08:00:00 GMT</pubDate><source url="https://news.example">City Times</source></item></channel></rss>`);
    }
    if (target.hostname === 'hn.algolia.com') {
      calls.searches.push(['Hacker News', target.searchParams.get('query')]);
      return hackerNewsStatus === 200 ? Response.json({ hits: [{ objectID: '42', title: 'Ask HN: Running a housing society', points: 12, num_comments: 7, created_at: '2026-10-01T00:00:00Z' }] }) : new Response('', { status: hackerNewsStatus });
    }
    if (target.hostname === 'api.github.com') {
      calls.searches.push(['GitHub', target.searchParams.get('q')]);
      return Response.json({ items: [{ full_name: 'acme/society-billing', html_url: 'https://github.com/acme/society-billing', stargazers_count: 310, description: 'Maintenance billing for housing societies', pushed_at: '2026-09-01T00:00:00Z' }] });
    }
    if (target.hostname === 'startup.example') {
      return new Response('<html><head><title>SocietyPay</title></head><body><script>trackVisitor()</script><p>Collect society dues over UPI.</p></body></html>');
    }
    return new Response('', { status: 404 });
  };
  return { calls, fetch };
}

test('Research searches the web with planned queries and keeps the screened evidence', async () => {
  const { createAIProvider } = await import('../src/ai/provider.js');
  const web = fakeResearchWeb({ hackerNewsStatus: 503 });
  const originalFetch = global.fetch;
  global.fetch = web.fetch;

  try {
    const ai = await createAIProvider({ ANTHROPIC_API_KEY: 'key', ANTHROPIC_BASE_URL: 'https://gateway.example' });
    const research = await runResearch({ idea: 'UPI maintenance collection for housing societies', startupUrl: 'https://startup.example/' }, ai);

    // Every planned query runs, cut to 5 words without quotes; GitHub runs only for competitors.
    const newsQueries = web.calls.searches.filter(([source]) => source === 'Google News').map(([, query]) => query);
    assert.deepEqual(newsQueries.slice(0, 2), ['society maintenance dues', 'RWA collections in Indian housing']);
    assert.deepEqual(web.calls.searches.filter(([source]) => source === 'GitHub'), [['GitHub', 'society management app'], ['GitHub', 'MyGate']]);

    // The founder's page reaches the screening prompt as text, without its script.
    const screening = web.calls.prompts.find((prompt) => prompt.includes('Results:'));
    assert.match(screening, /Collect society dues over UPI/);
    assert.doesNotMatch(screening, /trackVisitor/);

    // Results the model dropped, such as the founder's page, are not evidence; kept ones carry its stance and strength.
    assert.deepEqual(research.evidence.map((item) => item.url), ['https://github.com/acme/society-billing', 'https://news.example/maintenance']);
    assert.deepEqual(research.evidence[0].contradicts, ['no free alternative']);
    assert.equal(research.evidence[0].evidenceStrength, 4);
    assert.deepEqual(research.evidence[1].supports, ['collection is painful']);
    assert.ok(research.limitations.some((line) => /Hacker News search for ".+" failed: HTTP 503/.test(line)));
    assert.equal(research.missions.find((mission) => mission.missionType === 'competition').query, 'society management app · MyGate');
  } finally {
    global.fetch = originalFetch;
  }
});

test('Web search runs once per mission with TAVILY_API_KEY and reports a used-up quota', async () => {
  const { createAIProvider } = await import('../src/ai/provider.js');
  const originalFetch = global.fetch;

  try {
    const web = fakeResearchWeb();
    global.fetch = web.fetch;
    const ai = await createAIProvider({ ANTHROPIC_API_KEY: 'key', ANTHROPIC_BASE_URL: 'https://gateway.example' });
    await runResearch({ idea: 'UPI maintenance collection for housing societies' }, ai, { TAVILY_API_KEY: 'tvly-test' });

    // The first planned query of each mission, not every query, spends quota.
    assert.deepEqual(web.calls.searches.filter(([source]) => source === 'Web').map(([, query]) => query), ['society maintenance dues', 'society maintenance excel', 'society management app', 'maintenance app complaints']);
    assert.ok(web.calls.tavilyKeys.every((header) => header === 'Bearer tvly-test'));
    const screening = web.calls.prompts.find((prompt) => prompt.includes('Results:'));
    assert.match(screening, /Web · blog\.example · 2026-11-02/);
    assert.match(screening, /reconcile UPI screenshots by hand/);

    const exhausted = fakeResearchWeb({ tavilyStatus: 432 });
    global.fetch = exhausted.fetch;
    const research = await runResearch({ idea: 'UPI maintenance collection for housing societies' }, ai, { TAVILY_API_KEY: 'tvly-test' });
    assert.ok(research.limitations.some((line) => /Web search for ".+" failed: the monthly Tavily search quota is used up/.test(line)));

    const keyless = fakeResearchWeb();
    global.fetch = keyless.fetch;
    await runResearch({ idea: 'UPI maintenance collection for housing societies' }, ai, {});
    assert.equal(keyless.calls.searches.filter(([source]) => source === 'Web').length, 0);
  } finally {
    global.fetch = originalFetch;
  }
});

test('Research without an AI key still searches and lists unscreened results', async () => {
  const { createAIProvider } = await import('../src/ai/provider.js');
  const web = fakeResearchWeb();
  const originalFetch = global.fetch;
  global.fetch = web.fetch;

  try {
    const research = await runResearch({ idea: 'An app that helps housing societies collect maintenance over UPI' }, await createAIProvider({}));
    assert.ok(web.calls.searches.every(([, query]) => query === 'housing societies collect maintenance'));
    assert.deepEqual(research.evidence.map((item) => item.url).sort(), ['https://github.com/acme/society-billing', 'https://news.example/maintenance', 'https://news.ycombinator.com/item?id=42']);
    assert.ok(research.evidence.every((item) => item.classification === 'UNKNOWN' && item.evidenceStrength === 1));
    assert.ok(research.limitations.some((line) => /without a relevance check/.test(line)));
  } finally {
    global.fetch = originalFetch;
  }
});

test('Contradictory evidence stays visible to the analysis pipeline', () => {
  const contradictions = findContradictions([
    { claim: 'Users need this now', contradicts: ['Users already solve this with spreadsheets.'] },
  ]);

  assert.equal(contradictions.length, 1);
  assert.match(contradictions[0].whyItMatters, /challenged/i);
});

test('Capability mapping makes the startup requirement explicit and strategic', () => {
  const mapping = assessTeamFit([
    {
      requiredCapability: 'Existing creator community',
      teamSignal: 'The team runs an active public community with regular posts and members.',
      evidence: [{ title: 'Official community page', url: 'https://example.com/community' }],
      transferability: 'Strong for founder-led distribution.',
      gap: 'No proof that these members match the exact target buyer profile.',
      unknown: false,
    }
  ], [
    {
      startup_requirement: 'Creator acquisition',
      required_capability: 'Existing creator community',
      team_evidence: [{ title: 'Official community page', url: 'https://example.com/community' }],
      evidence_source: 'Official community page',
      demonstrated_capability: 'proven capability',
      possible_leverage: 'Could potentially acquire initial users through founder-led distribution',
      gap: 'Whether community members have the exact target profile',
      unknown: 'Whether community members have the exact target profile',
      strategic_implication: 'Test distribution before building the full product.'
    }
  ]);

  assert.equal(mapping[0].startup_requirement, 'Creator acquisition');
  assert.equal(mapping[0].required_capability, 'Existing creator community');
  assert.equal(mapping[0].demonstrated_capability, 'proven capability');
  assert.ok(mapping[0].strategic_implication.includes('Test distribution'));
});

test('Cook opportunities generate strategic, evidence-grounded product ideas', () => {
  const opportunities = deriveCookOpportunities([
    {
      startup_requirement: 'Creator acquisition',
      required_capability: 'Existing creator community',
      team_evidence: [{ title: 'Official community page', url: 'https://example.com/community' }],
      evidence_source: 'Official community page',
      demonstrated_capability: 'proven capability',
      possible_leverage: 'Could potentially acquire initial users through founder-led distribution',
      gap: 'Whether community members have the exact target profile',
      unknown: 'Whether community members have the exact target profile',
      strategic_implication: 'Test distribution before building the full product.'
    }
  ], [{
    problem: 'Creators need a simpler way to manage audience feedback and launch coordination.',
    distribution: 'founder-led distribution through the existing creator community',
    product: 'a lightweight workflow and launch coordination tool'
  }]);

  assert.ok(opportunities.length >= 3 && opportunities.length <= 7);
  assert.ok(opportunities.every((opportunity) => typeof opportunity.title === 'string'));
  assert.ok(opportunities.every((opportunity) => Array.isArray(opportunity.required_capabilities)));
  assert.ok(opportunities.every((opportunity) => typeof opportunity.why_this_team === 'string'));
  assert.ok(opportunities.every((opportunity) => typeof opportunity.biggest_risk === 'string'));
  assert.ok(opportunities.every((opportunity) => typeof opportunity.cheapest_test === 'string'));
});

test('Waitlist users persist in Upstash Redis across register, admin list, and delete', async () => {
  const { default: api } = await import('../src/api.js');
  const originalFetch = global.fetch;
  const savedEnv = { ...process.env };
  const hash = new Map();
  global.fetch = async (url, init) => {
    assert.equal(String(url), 'https://redis.example');
    assert.equal(init.headers.Authorization, 'Bearer redis-token');
    const [command, , field, value] = JSON.parse(init.body);
    const results = {
      HGET: () => hash.get(field) ?? null,
      HSET: () => (hash.set(field, value), 1),
      HDEL: () => Number(hash.delete(field)),
      HGETALL: () => [...hash].flat(),
    };
    return Response.json({ result: results[command]() });
  };
  Object.assign(process.env, { UPSTASH_REDIS_REST_URL: 'https://redis.example', UPSTASH_REDIS_REST_TOKEN: 'redis-token', ADMIN_TOKEN: 'admin-secret' });

  const call = async (method, path, body, headers = {}) => {
    const response = await api.fetch(new Request(`http://localhost${path}`, { method, headers: { 'content-type': 'application/json', ...headers }, body: body && JSON.stringify(body) }));
    return { status: response.status, json: await response.json() };
  };
  const admin = { Authorization: 'Bearer admin-secret' };

  try {
    assert.equal((await call('POST', '/api/register', { email: ' Ayush@Example.com ' })).json.data.users, 1);
    assert.equal((await call('POST', '/api/register', { email: 'ayush@example.com' })).json.data.users, 1);
    assert.equal((await call('POST', '/api/register', { email: 'second@example.com' })).json.data.users, 2);

    assert.equal((await call('GET', '/api/admin/users')).status, 401);
    const listed = await call('GET', '/api/admin/users', undefined, admin);
    assert.deepEqual(listed.json.data.map((user) => user.email).sort(), ['ayush@example.com', 'second@example.com']);

    await call('DELETE', '/api/admin/users', { email: 'second@example.com' }, admin);
    assert.equal((await call('GET', '/api/stats')).json.data.users, 1);
    assert.deepEqual([...hash.keys()], ['ayush@example.com']);
  } finally {
    global.fetch = originalFetch;
    process.env = savedEnv;
  }
});

test('Orchestrator uses the Claude judge verdict from the configured Anthropic-compatible gateway', async () => {
  const originalFetch = global.fetch;
  let sent;
  global.fetch = async (url, init) => {
    if (String(url) !== 'https://gateway.example/v1/messages') return new Response('', { status: 404 });
    sent = { headers: init.headers, body: JSON.parse(init.body) };
    const verdict = { verdict: 'KILL', reasoning: 'Spreadsheets already solve it.', strongest_evidence: [], strongest_contradiction: ['Substitutes exist'], biggest_unknown: 'Willingness to pay', kill_conditions: ['No switching'], confidence: 0.8 };
    return Response.json({ content: [{ type: 'text', text: JSON.stringify(verdict) }], stop_reason: 'end_turn' });
  };

  try {
    const result = await orchestrateAnalysis({ idea: 'AI compliance workflow' }, { ANTHROPIC_API_KEY: 'test-key', ANTHROPIC_BASE_URL: 'https://gateway.example/' });
    assert.equal(sent.headers['x-api-key'], 'test-key');
    assert.equal(sent.body.model, 'claude-sonnet-5-5');
    assert.equal(sent.body.output_config.format.type, 'json_schema');
    assert.equal(result.aiProvider, 'anthropic');
    assert.equal(result.verdict.verdict, 'KILL');
    assert.equal(result.judge.reasoning, 'Spreadsheets already solve it.');
    assert.equal(result.verdict.confidence, 0.8);
  } finally {
    global.fetch = originalFetch;
  }
});

test('Orchestrator falls back to the local judge when the Anthropic call fails', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => Response.json({ error: { message: 'invalid x-api-key' } }, { status: 401 });

  try {
    const result = await orchestrateAnalysis({ idea: 'AI compliance workflow' }, { ANTHROPIC_API_KEY: 'bad-key' });
    assert.match(result.generatedModel.error, /401: invalid x-api-key/);
    assert.equal(['BUILD', 'REWORK', 'KILL'].includes(result.verdict.verdict), true);
  } finally {
    global.fetch = originalFetch;
  }
});

test('Orchestrator returns structured analysis for a valid input', async () => {
  const originalFetch = global.fetch;
  global.fetch = fakeResearchWeb().fetch;

  try {
    const result = await orchestrateAnalysis({ idea: 'AI compliance workflow', startupUrl: 'https://example.com' }, {});
    assert.equal(result.thesis.idea, 'AI compliance workflow');
    assert.equal(Array.isArray(result.evidence), true);
    assert.equal(Array.isArray(result.contradictions), true);
    assert.equal(['BUILD', 'REWORK', 'KILL'].includes(result.verdict.verdict), true);
  } finally {
    global.fetch = originalFetch;
  }
});
