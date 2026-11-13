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

XORVAI deploys to Vercel: `public/` is the static frontend and `api/index.js` is one Vercel Function that serves every `/api/*` route. `vercel.json` does the routing.

Set these in Vercel → Project → Settings → Environment Variables, then redeploy:

| Variable | Needed for |
| --- | --- |
| `ANTHROPIC_API_KEY` | The Claude Sonnet 5.5 judge, through the Anthropic-compatible gateway at `https://ai.kavyansh.org`. Without it, the deterministic local judge runs. |
| Upstash Redis (`KV_REST_API_URL`, `KV_REST_API_TOKEN`) | Saving waitlist emails. Add it from Vercel → Storage → Upstash Redis and it sets both. Without it, emails are lost on every cold start. |
| `ADMIN_TOKEN` | The `/admin` page. |

Optional: `ANTHROPIC_BASE_URL` (set it to `https://api.anthropic.com` to call Anthropic directly) and `ANTHROPIC_MODEL`.

Local dev: `npm run dev` serves the app on port 3000 with the same routing, reading variables from `.env.local` (gitignored). `npm test` runs the tests. `GET /api/health` shows which judge is active.

## Disclaimer

XORVAI is an experimental research/project tool. Its analysis should not be treated as a substitute for real customer research, market validation, or professional advice.
