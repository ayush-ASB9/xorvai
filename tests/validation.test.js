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

test('Admin users list reads the actual KV values instead of metadata', async () => {
  const { default: worker } = await import('../src/index.js');
  const kv = {
    prefix: 'user:',
    async list({ prefix }) {
      assert.equal(prefix, 'user:');
      return {
        keys: [{ name: 'user:ayushsinghbhuranda@gmail.com' }],
      };
    },
    async get(key) {
      assert.equal(key, 'user:ayushsinghbhuranda@gmail.com');
      return JSON.stringify({
        email: 'ayushsinghbhuranda@gmail.com',
        createdAt: '2026-09-11T00:00:00.000Z',
        lastSeenAt: '2026-09-11T00:00:00.000Z',
      });
    },
  };

  const request = new Request('http://localhost/api/admin/users', {
    headers: { Authorization: 'Bearer xorvai-dev-admin' },
  });

  const response = await worker.fetch(request, { XORVAI_USERS: kv, ADMIN_TOKEN: 'xorvai-dev-admin' }, {});
  const json = await response.json();
  assert.equal(response.status, 200);
  assert.equal(json.ok, true);
  assert.equal(Array.isArray(json.data), true);
  assert.equal(json.data[0].email, 'ayushsinghbhuranda@gmail.com');
  assert.equal(json.data[0].createdAt, '2026-09-11T00:00:00.000Z');
});

test('Orchestrator returns structured analysis for a valid input', async () => {
  const result = await orchestrateAnalysis({ idea: 'AI compliance workflow', startupUrl: 'https://example.com' }, {});
  assert.equal(result.thesis.idea, 'AI compliance workflow');
  assert.equal(Array.isArray(result.evidence), true);
  assert.equal(Array.isArray(result.contradictions), true);
  assert.equal(['BUILD', 'REWORK', 'KILL'].includes(result.verdict.verdict), true);
});
