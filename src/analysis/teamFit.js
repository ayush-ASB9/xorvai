import { makeCapabilityMapping } from '../schemas/team.js';

export function assessTeamFit(teamCapabilities = [], startupRequirements = []) {
  const requirements = Array.isArray(startupRequirements) && startupRequirements.length > 0 ? startupRequirements : [{
    startup_requirement: 'Unspecified startup requirement',
    required_capability: 'General execution capability',
    team_evidence: [],
    evidence_source: 'UNKNOWN',
    demonstrated_capability: 'unverified capability',
    possible_leverage: 'Unknown leverage',
    gap: 'No direct evidence identified.',
    unknown: 'Unknown',
    strategic_implication: 'Test this requirement before a broad build.',
  }];

  return teamCapabilities.map((capability, index) => {
    const requirement = requirements[index] || requirements[0] || {};
    const evidence = Array.isArray(capability.evidence) ? capability.evidence : Array.isArray(requirement.team_evidence) ? requirement.team_evidence : [];
    const source = capability.evidence_source || requirement.evidence_source || capability.evidence?.[0]?.title || capability.evidence?.[0]?.url || 'UNKNOWN';

    return makeCapabilityMapping({
      startup_requirement: requirement.startup_requirement || requirement.startupRequirement || capability.startup_requirement || capability.startupRequirement || 'Unspecified startup requirement',
      required_capability: requirement.required_capability || requirement.requiredCapability || capability.requiredCapability || 'Unknown capability',
      team_evidence: evidence,
      evidence_source: source,
      demonstrated_capability: capability.demonstrated_capability || requirement.demonstrated_capability || (capability.unknown === false ? 'proven capability' : 'unverified capability'),
      possible_leverage: capability.possible_leverage || requirement.possible_leverage || requirement.possibleLeverage || capability.possibleLeverage || 'Unknown leverage',
      gap: capability.gap || requirement.gap || 'No direct evidence identified.',
      unknown: capability.unknown === false ? 'No major unknown remains on the evidence we do have.' : (requirement.unknown || capability.unknown || 'Unknown'),
      strategic_implication: capability.strategic_implication || requirement.strategic_implication || requirement.strategicImplication || 'Test this requirement before a broad build.',
      teamSignal: capability.teamSignal || 'No public signal found.',
      transferability: capability.transferability || 'Not assessed',
    });
  });
}
