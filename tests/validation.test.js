import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIdeaInput, isValidHttpUrl } from '../src/utils/validation.js';
import { buildEvidenceSet } from '../src/analysis/evidence.js';
import { findContradictions } from '../src/analysis/contradictions.js';
import { determineVerdict } from '../src/analysis/verdict.js';
import { orchestrateAnalysis } from '../src/agents/orchestrator.js';
import { directFetchSource } from '../src/research/sources/directFetch.js';
import { deduplicateEvidence } from '../src/research/evidenceExtractor.js';
import { runResearchSources } from '../src/research/researchRunner.js';
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

test('Research source succeeds for a valid public URL', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => new Response('<html><body><h1>Demand is real</h1><p>People need this.</p></body></html>', { status: 200 });

  try {
    const result = await directFetchSource('https://example.com');
    assert.equal(result.ok, true);
    assert.equal(Array.isArray(result.data), true);
    assert.ok(result.data.length > 0);
    assert.equal(result.source.status, 'available');
  } finally {
    global.fetch = originalFetch;
  }
});

test('Research source fails gracefully when the fetch rejects', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => { throw new Error('network down'); };

  try {
    const result = await directFetchSource('https://example.com');
    assert.equal(result.ok, false);
    assert.match(result.error, /network down/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('Malformed HTML is normalized into a safe text snippet', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => new Response('<html><body><script>bad()</script><div>We observed <b>urgent</b> demand in the market.</div></body></html>', { status: 200 });

  try {
    const result = await directFetchSource('https://example.com');
    assert.equal(result.ok, true);
    assert.ok(result.data[0].excerpt.includes('urgent') || result.data[0].excerpt.length > 0);
  } finally {
    global.fetch = originalFetch;
  }
});

test('Duplicate evidence is deduplicated after extraction', () => {
  const deduped = deduplicateEvidence([
    { claim: 'Demand is real', source: { url: 'https://example.com' } },
    { claim: 'Demand is real', source: { url: 'https://example.com' } },
  ]);

  assert.equal(deduped.length, 1);
});

test('Contradictory evidence stays visible to the analysis pipeline', () => {
  const contradictions = findContradictions([
    { claim: 'Users need this now', contradicts: ['Users already solve this with spreadsheets.'] },
  ]);

  assert.equal(contradictions.length, 1);
  assert.match(contradictions[0].whyItMatters, /challenged/i);
});

test('Inaccessible local URLs are rejected before research starts', async () => {
  const result = await directFetchSource('http://localhost:3000');
  assert.equal(result.ok, false);
  assert.equal(result.error, 'Invalid URL');
});

test('Empty research result returns an empty list', async () => {
  const results = await runResearchSources([]);
  assert.deepEqual(results, []);
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
  const result = await orchestrateAnalysis({ idea: 'AI compliance workflow', startupUrl: 'https://example.com' }, {});
  assert.equal(result.thesis.idea, 'AI compliance workflow');
  assert.equal(Array.isArray(result.evidence), true);
  assert.equal(Array.isArray(result.contradictions), true);
  assert.equal(['BUILD', 'REWORK', 'KILL'].includes(result.verdict.verdict), true);
});
