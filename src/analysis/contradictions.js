export function findContradictions(evidence = []) {
  const contradictions = [];

  for (const item of evidence) {
    if (!item || !Array.isArray(item.contradicts) || item.contradicts.length === 0) continue;
    contradictions.push({
      claim: item.claim,
      counterEvidence: item.contradicts,
      whyItMatters: 'This claim is directly challenged by competing evidence and should weaken the thesis unless resolved.',
      severity: 'MEDIUM',
      whatWouldResolveIt: 'Additional primary evidence or user behavior data would resolve the contradiction.',
    });
  }

  return contradictions;
}
