export function determineVerdict(report = {}) {
  const contradictions = Array.isArray(report.contradictions) ? report.contradictions.length : 0;
  const missingEvidence = Array.isArray(report.unknown) ? report.unknown.length : 0;
  const teamFit = Array.isArray(report.teamFit) ? report.teamFit.length : 0;

  if (contradictions >= 2 && missingEvidence >= 2) return { verdict: 'KILL', reasoning: 'The thesis is repeatedly contradicted and important evidence remains unknown.' };
  if (contradictions >= 1 && teamFit === 0) return { verdict: 'REWORK', reasoning: 'The thesis is not dead, but requires a stronger or different fit between team and startup.' };
  return { verdict: 'BUILD', reasoning: 'Early evidence suggests the thesis may survive and warrants a focused experiment.' };
}
