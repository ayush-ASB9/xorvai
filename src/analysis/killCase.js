export function createKillCase(graph = {}) {
  const contradictions = Array.isArray(graph.contradictions) ? graph.contradictions : [];
  const unknowns = Array.isArray(graph.unknowns) ? graph.unknowns : [];

  return {
    strongest_kill_reasons: [
      'The pain may be weaker than the thesis assumes.',
      'Existing workflows or tools may already cover the need with lower friction.',
      'The team has no clearly defensible advantage or distribution wedge.',
      'The startup may be easy to substitute with minimal switching costs.',
    ],
    supporting_evidence: contradictions.length ? contradictions.map((item) => item.claim || 'Contradictory claim') : ['No direct contradiction is available yet.'],
    assumptions_at_risk: Array.isArray(graph.assumptions) ? graph.assumptions.map((item) => item.statement || 'Assumption missing') : [],
    red_flags: unknowns.length ? unknowns.map((item) => item.item || 'Unknown item') : ['Pricing, retention, and switching behavior remain uncertain.'],
  };
}
