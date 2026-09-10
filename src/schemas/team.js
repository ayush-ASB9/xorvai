export function makeCapabilityMapping(data = {}) {
  const teamEvidence = Array.isArray(data.team_evidence) ? data.team_evidence : Array.isArray(data.evidence) ? data.evidence : [];

  return {
    startup_requirement: data.startup_requirement || data.startupRequirement || data.required_capability || data.requiredCapability || 'Unspecified startup requirement',
    required_capability: data.required_capability || data.requiredCapability || 'Unknown capability',
    team_evidence: teamEvidence,
    evidence_source: data.evidence_source || data.evidenceSource || (teamEvidence[0]?.title || teamEvidence[0]?.url || 'UNKNOWN'),
    demonstrated_capability: ['proven capability', 'probable capability', 'unverified capability'].includes(data.demonstrated_capability) ? data.demonstrated_capability : 'unverified capability',
    possible_leverage: data.possible_leverage || data.possibleLeverage || 'Unknown leverage',
    gap: data.gap || 'No direct evidence identified.',
    unknown: typeof data.unknown === 'string' ? data.unknown : (data.unknown === true ? 'Unknown' : 'No direct evidence yet'),
    strategic_implication: data.strategic_implication || data.strategicImplication || 'Test this requirement before a broad build.',
  };
}
