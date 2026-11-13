# XORVAI Copilot Instructions

- Favor simple, inspectable JavaScript and explicit data flow over abstraction.
- Keep model/provider logic isolated behind provider adapters.
- Treat research as evidence-first and source-aware.
- Never fabricate facts about founders, revenue, market size, or traction.
- Keep every stage explicit: thesis, research, evidence, contradictions, team, strategy, judge, verdict.
- Prefer deterministic local behavior with mock fallback when no external service is available.
- No paid API requirements or hidden credentials in browser code.
- Deploy target is Vercel: static files in `public/`, all API routes in the single `api/index.js` function, routing in `vercel.json`.
