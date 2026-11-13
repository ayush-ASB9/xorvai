# XORVAI

> **DON'T VALIDATE IT. TRY TO KILL IT.**

XORVAI is an adversarial AI built to challenge startup ideas before the market does.

Instead of asking *"why could this work?"*, XORVAI asks:

**"why could this fail?"**

## What it does

Give XORVAI a startup idea and let it attack the thesis.

It looks for things like:

- weak assumptions
- market problems
- customer pain
- competitive threats
- business model weaknesses
- distribution challenges
- scalability issues
- reasons the idea might simply not work

The goal isn't to kill every idea.

It's to find the reasons **before you spend months building it.**

## Philosophy

Most startup validation is designed to find reasons an idea could work.

XORVAI takes the opposite approach.

**Assume the idea is wrong. Then try to prove it.**

If it survives the attack, you have something more interesting to investigate.

## Status

Early-stage experiment.

Still being built, tested, and improved.

## Built with

- React
- TypeScript
- AI
- GitHub

## Running it

XORVAI is one Node server: `server.js` serves the frontend in `public/` and passes `/api/*` to `src/api.js`. It has no npm dependencies.

It runs as a free Render web service (Node runtime, free plan, `npm install` / `npm start`) that redeploys on every push to `main`. Set these on the service's **Environment** page:

| Variable | Needed for |
| --- | --- |
| `ANTHROPIC_API_KEY` | The Claude Sonnet 5.5 judge, through the Anthropic-compatible gateway at `https://ai.kavyansh.org`. Without it, the deterministic local judge runs. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Saving waitlist emails. Create a free database at console.upstash.com and copy both from its REST section. Without them, emails are lost whenever the server sleeps. |
| `ADMIN_TOKEN` | The `/admin` page, which stays locked until it is set. |
| `TAVILY_API_KEY` | General web search during research. Get a free key (1,000 searches a month, no card) at app.tavily.com; each analysis uses 4, so about 250 analyses a month. Without it, research uses only Google News, Hacker News and GitHub. |

Optional: `ANTHROPIC_BASE_URL` (set it to `https://api.anthropic.com` to call Anthropic directly) and `ANTHROPIC_MODEL`.

The free service sleeps after 15 minutes without traffic, and the next visit takes about a minute to wake it.

Research runs on web search through Tavily (when `TAVILY_API_KEY` is set), keyless public search (Google News RSS, Hacker News and GitHub), and any URLs the founder enters. The AI model plans the queries and screens the results, so each analysis makes three model calls: about 40 seconds and $0.08 on Sonnet 5.5. Without the key, the raw results are listed unscreened.

Local dev: `npm run dev` serves the app on port 3000, reading variables from `.env.local` (gitignored). `npm test` runs the tests. `GET /api/health` shows which judge is active.

## Disclaimer

XORVAI is an experimental research/project tool. Its analysis should not be treated as a substitute for real customer research, market validation, or professional advice.
