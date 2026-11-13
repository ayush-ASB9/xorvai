// An evidence item's `contradicts` lists the parts of the thesis it challenges.
export function findContradictions(evidence = []) {
  const contradictions = [];

  for (const item of evidence) {
    if (!item || !Array.isArray(item.contradicts) || item.contradicts.length === 0) continue;
    const strength = Number(item.evidenceStrength ?? item.evidence_strength ?? 0);
    for (const challenged of item.contradicts) {
      contradictions.push({
        claim: challenged,
        counterEvidence: [item.claim],
        whyItMatters: 'This part of the thesis is challenged by the evidence below and should weaken confidence unless resolved.',
        severity: strength >= 4 ? 'HIGH' : 'MEDIUM',
        whatWouldResolveIt: 'Additional primary evidence or user behavior data would resolve the contradiction.',
      });
    }
  }

  return contradictions;
}
