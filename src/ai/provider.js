function parseJsonText(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  const jsonStart = trimmed.indexOf('{');
  const jsonEnd = trimmed.lastIndexOf('}');

  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    const candidate = trimmed.slice(jsonStart, jsonEnd + 1);
    try {
      return JSON.parse(candidate);
    } catch (error) {
      return null;
    }
  }

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    return null;
  }
}

export function validateStructuredObject(payload, expected = []) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return false;
  }

  if (!expected.length) return true;
  return expected.every((key) => Object.prototype.hasOwnProperty.call(payload, key));
}

export class AIProvider {
  async generate(prompt) {
    throw new Error('AIProvider.generate() is not implemented.');
  }

  async generateJSON(prompt, schema = {}) {
    throw new Error('AIProvider.generateJSON() is not implemented.');
  }

  async healthCheck() {
    return 'not-implemented';
  }
}

export class MockAIProvider extends AIProvider {
  constructor() {
    super();
    this.mode = 'mock';
  }

  async generate(prompt) {
    return `mock-response:${String(prompt).slice(0, 180)}`;
  }

  async generateJSON(prompt, schema = {}) {
    const raw = await this.generate(prompt);
    const parsed = parseJsonText(raw);

    if (parsed && validateStructuredObject(parsed, Object.keys(schema || {}))) {
      return { ...parsed, mode: 'mock', generatedAt: new Date().toISOString() };
    }

    if (parsed) {
      return {
        mode: 'mock',
        data: parsed,
        schema,
        verdict: 'UNKNOWN',
        reason: 'Structured JSON was present but failed validation; unknown status returned.',
        generatedAt: new Date().toISOString(),
      };
    }

    return {
      mode: 'mock',
      schema,
      prompt,
      verdict: 'UNKNOWN',
      reason: 'Mock AI fallback produced non-JSON text; safe unknown was returned instead of hallucinating.',
      generatedAt: new Date().toISOString(),
    };
  }

  async healthCheck() {
    return { status: 'ok', mode: 'mock', label: 'local-deterministic-fallback' };
  }
}

export async function createAIProvider(env = {}) {
  if (typeof env?.AI !== 'undefined' && typeof env.AI.run === 'function') {
    const { CloudflareAIProvider } = await import('./cloudflare.js');
    return new CloudflareAIProvider(env);
  }
  return new MockAIProvider();
}
