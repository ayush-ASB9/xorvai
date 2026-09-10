export function isValidHttpUrl(value) {
  if (typeof value !== 'string') return false;
  const candidate = value.trim();
  if (!candidate) return false;

  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') return false;
    if (parsed.hostname.endsWith('.local')) return false;

    const host = parsed.hostname.toLowerCase();
    const ipv4 = host.split('.');
    if (ipv4.length === 4 && ipv4.every((part) => /^\d+$/.test(part))) {
      const octets = ipv4.map(Number);
      if (octets[0] === 10 || octets[0] === 127 || octets[0] === 0 || octets[0] === 169 && octets[1] === 254) {
        return false;
      }
      if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return false;
      if (octets[0] === 192 && octets[1] === 168) return false;
      if (octets[0] === 255 && octets[1] === 255 && octets[2] === 255 && octets[3] === 255) return false;
    }
    return true;
  } catch (error) {
    return false;
  }
}

export function sanitizeIdea(value) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, 2000);
}

export function normalizeIdeaInput(input = {}) {
  const startup = sanitizeIdea(input.startup || input.startupIdea || input.idea || '');
  const idea = sanitizeIdea(input.idea || input.startupIdea || startup);
  const description = typeof input.description === 'string' ? input.description.trim().slice(0, 2500) : '';
  const founderInfo = typeof input.founderInfo === 'string' ? input.founderInfo.trim().slice(0, 2500) : '';
  const founderUrls = Array.isArray(input.founderUrls) ? input.founderUrls.filter(Boolean).slice(0, 5) : [];
  const startupUrl = typeof input.startupUrl === 'string' ? input.startupUrl.trim() : '';
  const competitorUrls = Array.isArray(input.competitorUrls) ? input.competitorUrls.filter(Boolean).slice(0, 5) : [];
  const teamUrls = Array.isArray(input.teamUrls) ? input.teamUrls.filter(Boolean).slice(0, 5) : founderUrls;
  const customerProblem = typeof input.customerProblem === 'string' ? input.customerProblem.trim().slice(0, 2500) : '';
  const context = typeof input.context === 'string' ? input.context.trim().slice(0, 2500) : '';
  const depth = ['QUICK', 'STANDARD', 'DEEP'].includes((input.depth || '').toUpperCase()) ? input.depth.toUpperCase() : 'STANDARD';

  const normalized = {
    idea,
    startup,
    description,
    founderInfo,
    founderUrls,
    startupUrl,
    competitorUrls,
    teamUrls,
    customerProblem,
    context,
    depth,
  };

  if (!normalized.idea) {
    throw new Error('Startup idea is required.');
  }

  if (normalized.startupUrl && !isValidHttpUrl(normalized.startupUrl)) {
    throw new Error('startupUrl must be a valid http or https URL.');
  }

  for (const teamUrl of normalized.teamUrls) {
    if (!isValidHttpUrl(teamUrl)) {
      throw new Error('Each team URL must be a valid http or https URL.');
    }
  }

  for (const competitorUrl of normalized.competitorUrls) {
    if (!isValidHttpUrl(competitorUrl)) {
      throw new Error('Each competitor URL must be a valid http or https URL.');
    }
  }

  return normalized;
}

export function coerceArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}
