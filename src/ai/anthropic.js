import { AIProvider, validateStructuredObject } from './provider.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ANTHROPIC');
const DEFAULT_BASE_URL = 'https://api.anthropic.com';
const DEFAULT_MODEL = 'claude-sonnet-5-5';

export class AnthropicProvider extends AIProvider {
  constructor(env) {
    super();
    this.apiKey = env.ANTHROPIC_API_KEY;
    // Any Anthropic-compatible gateway works; the base URL is the part before /v1/messages.
    this.baseUrl = (env.ANTHROPIC_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.model = env.ANTHROPIC_MODEL || DEFAULT_MODEL;
    this.mode = 'anthropic';
  }

  async healthCheck() {
    return { status: 'ok', mode: this.mode, label: 'anthropic-api-key-configured', model: this.model, baseUrl: this.baseUrl };
  }

  async request(prompt, outputConfig) {
    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2026-10-21',
      },
      body: JSON.stringify({
        model: this.model,
        // Adaptive thinking is on by default and counts against max_tokens, so leave room for it.
        max_tokens: 16000,
        messages: [{ role: 'user', content: String(prompt) }],
        ...(outputConfig ? { output_config: outputConfig } : {}),
      }),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`Anthropic API ${response.status}: ${body?.error?.message || response.statusText}`);
    }

    const text = (body.content || []).filter((block) => block.type === 'text').map((block) => block.text).join('');
    return { text, stopReason: body.stop_reason };
  }

  async generate(prompt) {
    const { text } = await this.request(prompt);
    return text;
  }

  async generateJSON(prompt, schema = {}) {
    try {
      const { text, stopReason } = await this.request(prompt, { format: { type: 'json_schema', schema } });
      const parsed = JSON.parse(text);
      if (validateStructuredObject(parsed, schema.required || [])) {
        return { ...parsed, mode: this.mode, model: this.model, generatedAt: new Date().toISOString() };
      }
      throw new Error(`Model output did not match the schema (stop_reason: ${stopReason}).`);
    } catch (error) {
      logger.error('Structured generation failed:', error.message);
      return {
        mode: this.mode,
        model: this.model,
        verdict: 'UNKNOWN',
        reason: 'Anthropic call failed; the deterministic judge result is used instead.',
        error: error.message,
        generatedAt: new Date().toISOString(),
      };
    }
  }
}
