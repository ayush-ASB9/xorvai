// Search sources that work from a free server. Each function returns a list of results in one
// shape, or throws, so the caller can record which source failed.
const TIMEOUT_MS = 8000;
const HEADERS = { 'User-Agent': 'xorvai-research/1.0 (+https://xorvai.onrender.com)' };

function decodeEntities(text = '') {
  return String(text)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;|&apos;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&amp;/g, '&');
}

function textOnly(html = '') {
  return decodeEntities(String(html).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function day(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

async function getText(url, headers = {}) {
  const response = await fetch(url, { headers: { ...HEADERS, ...headers }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'web';
  }
}

// General web search through Tavily (free plan: 1,000 searches a month, no card). Its snippets
// come from the page text, so they say more than a headline.
export async function searchWeb(query, apiKey, limit = 5) {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { ...HEADERS, Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, search_depth: 'basic', max_results: limit, include_published_date: true }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status === 432 || response.status === 433) throw new Error('the monthly Tavily search quota is used up');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json();
  return (body.results || []).map((result) => ({
    source: 'Web',
    title: textOnly(result.title || '') || result.url,
    url: result.url,
    publisher: hostOf(result.url),
    date: result.published_date ? day(result.published_date) : '',
    snippet: textOnly(result.content || '').slice(0, 600),
  }));
}

export async function searchGoogleNews(query, limit = 4) {
  const xml = await getText(`https://news.google.com/rss/search?${new URLSearchParams({ q: query })}`);
  return xml.split('<item>').slice(1, limit + 1).map((item) => {
    const field = (name) => decodeEntities((item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`)) || [])[1] || '').trim();
    const publisher = field('source');
    const title = field('title').replace(new RegExp(`\\s+-\\s+${publisher.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '');
    return {
      source: 'Google News',
      title,
      url: field('link'),
      publisher: publisher || 'Google News',
      date: day(field('pubDate')),
      snippet: '',
    };
  });
}

export async function searchHackerNews(query, limit = 3) {
  const params = new URLSearchParams({ query, tags: 'story', hitsPerPage: String(limit) });
  const body = JSON.parse(await getText(`https://hn.algolia.com/api/v1/search?${params}`));
  return (body.hits || []).map((hit) => ({
    source: 'Hacker News',
    title: hit.title || '',
    // The discussion is the evidence, so link to it rather than to the story's own URL.
    url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
    publisher: `Hacker News, ${hit.points || 0} points, ${hit.num_comments || 0} comments`,
    date: day(hit.created_at),
    snippet: textOnly(hit.story_text || '').slice(0, 300),
  }));
}

export async function searchGitHub(query, limit = 3) {
  const params = new URLSearchParams({ q: query, per_page: String(limit) });
  const body = JSON.parse(await getText(`https://api.github.com/search/repositories?${params}`, { Accept: 'application/vnd.github+json' }));
  return (body.items || []).map((repo) => ({
    source: 'GitHub',
    title: repo.full_name,
    url: repo.html_url,
    publisher: `GitHub, ${repo.stargazers_count || 0} stars`,
    date: day(repo.pushed_at),
    snippet: String(repo.description || '').slice(0, 300),
  }));
}

// A page the founder named, such as their site or a competitor's.
export async function fetchPage(url) {
  const html = await getText(url);
  const title = textOnly((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '') || url;
  const description = decodeEntities((html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i) || [])[1] || '');
  const body = textOnly(html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' '));
  return [{
    source: 'Web page',
    title,
    url,
    publisher: hostOf(url),
    date: '',
    snippet: [description, body].filter(Boolean).join(' — ').slice(0, 500),
  }];
}
