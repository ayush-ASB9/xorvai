export function collectUnknowns(graph = {}) {
  const unknowns = [];

  if (!Array.isArray(graph.evidence)) {
    unknowns.push({ item: 'evidence quality', importance: 'high', reason: 'No evidence collection was available.' });
  }

  if (!Array.isArray(graph.teamFit) || graph.teamFit.length === 0) {
    unknowns.push({ item: 'team execution capability', importance: 'high', reason: 'The team’s evidence is limited or missing.' });
  }

  if (!graph.research || !Array.isArray(graph.research.evidence) || graph.research.evidence.length === 0) {
    unknowns.push({ item: 'market demand', importance: 'high', reason: 'Demand evidence is not yet proven or available.' });
  }

  return unknowns;
}
