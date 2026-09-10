import { AIProvider, validateStructuredObject } from './provider.js';

function parseJsonCandidate(value) {
  if (!value || typeof value !== 'string') return null;
  const text = value.trim();
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    const candidate = text.slice(jsonStart, jsonEnd + 1);
    try {
      return JSON.parse(candidate);
    } catch (error) {
      return null;
    }
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

export class CloudflareAIProvider extends AIProvider {
  constructor(env) {
    super();
    this.ai = env.AI;
    this.mode = 'cloudflare';
  }

  async healthCheck() {
    if (!this.ai || typeof this.ai.run !== 'function') {
      return { status: 'unavailable', mode: 'cloudflare', label: 'binding-not-configured' };
    }
    return { status: 'ok', mode: 'cloudflare', label: 'cloudflare-ai-enabled' };
  }

  async generate(prompt) {
    if (!this.ai || typeof this.ai.run !== 'function') {
      return `cloudflare-ai-not-configured:${String(prompt).slice(0, 180)}`;
    }

    const result = await this.ai.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'user', content: String(prompt) }],
    });

    return result?.answer || result?.output || JSON.stringify(result || {});
  }

  async generateJSON(prompt, schema = {}) {
    if (!this.ai || typeof this.ai.run !== 'function') {
      return {
        mode: 'mock',
        schema,
        prompt,
        verdict: 'UNKNOWN',
        reason: 'Cloudflare AI binding unavailable, using safe local fallback.',
        generatedAt: new Date().toISOString(),
      };
    }

    const generated = await this.generate(prompt);
    const parsed = parseJsonCandidate(generated);
    if (parsed && validateStructuredObject(parsed, Object.keys(schema || {}))) {
      return { ...parsed, mode: 'cloudflare', generatedAt: new Date().toISOString() };
    }

    return {
      mode: 'cloudflare',
      schema,
      prompt,
      verdict: 'UNKNOWN',
      reason: 'Cloudflare AI model returned malformed or non-structured JSON; safe unknown returned.',
      raw: generated,
      generatedAt: new Date().toISOString(),
    };
  }
}
