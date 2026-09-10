import { assessTeamFit } from '../analysis/teamFit.js';
import { makeTeamCapability } from '../schemas/report.js';

export function runTeamAnalysis(teamUrls = [], startupRequirements = []) {
  const capabilities = [
    makeTeamCapability({
      requiredCapability: 'Product and go-to-market experimentation',
      teamSignal: teamUrls.length > 0 ? 'Public signals exist that suggest the team can research and ship a focused product.' : 'No public evidence found for product execution capability.',
      evidence: teamUrls.map((url) => ({ type: 'url', url })),
      transferability: 'Strong if the team has been shipping user-facing systems before.',
      gap: teamUrls.length === 0 ? 'No team profile URLs provided.' : 'No direct proof of execution quality is visible from the provided URLs.',
      unknown: teamUrls.length === 0,
    }),
  ];

  return {
    stage: 'TEAM',
    teamFit: assessTeamFit(capabilities, startupRequirements.length ? startupRequirements : [{ requiredCapability: 'Product and go-to-market experimentation' }]),
    capabilities,
    unknowns: teamUrls.length === 0 ? ['The team’s public capability evidence is not available.'] : [],
  };
}
