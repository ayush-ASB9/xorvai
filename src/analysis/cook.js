import { makeOpportunity } from '../schemas/strategy.js';

export function deriveCookOpportunities(teamFit = [], marketSignals = []) {
  const signals = Array.isArray(marketSignals) && marketSignals.length > 0 ? marketSignals : [{
    problem: 'The workflow is painful enough that people are already working around it manually.',
    distribution: 'A founder-led distribution path in a narrow niche market.',
    product: 'A focused workflow tool that reduces repetitive coordination or decision overhead.'
  }];

  const items = teamFit.length > 0 ? teamFit : [{
    startup_requirement: 'General startup requirement',
    required_capability: 'Execution capability',
    team_evidence: [],
    evidence_source: 'UNKNOWN',
    demonstrated_capability: 'unverified capability',
    possible_leverage: 'Unknown leverage',
    gap: 'No direct evidence identified.',
    unknown: 'Unknown',
    strategic_implication: 'Test this requirement before a broad build.'
  }];

  const opportunities = items.map((team, index) => {
    const signal = signals[index] || signals[0];
    const title = `${team.startup_requirement || 'Startup requirement'} + ${team.required_capability || 'team capability'}`;
    const requirement = team.startup_requirement || 'Unspecified startup requirement';
    const requiredCapability = team.required_capability || 'Unknown capability';
    const evidenceList = Array.isArray(team.team_evidence) ? team.team_evidence : Array.isArray(team.evidence) ? team.evidence : [];

    return makeOpportunity({
      title: title.length > 90 ? `${title.slice(0, 87)}...` : title,
      idea: `Build a narrow product that turns ${requiredCapability.toLowerCase()} into a wedge for ${requirement.toLowerCase()} without solving the whole workflow at once.`,
      why_this_team: `${team.teamSignal || team.possible_leverage || 'The team has a plausible public capability signal.'} The strategic implication is: ${team.strategic_implication || 'Test this requirement before a broad build.'}`,
      required_capabilities: [requiredCapability, 'Distribution or customer validation path', 'Small, testable implementation'],
      evidence: evidenceList.length > 0 ? evidenceList : [{ title: 'UNKNOWN', url: 'UNKNOWN' }],
      distribution_wedge: signal.distribution || 'Founder-led distribution or niche community channel',
      product_wedge: signal.product || 'A narrow workflow tool that removes a high-friction task',
      moat_potential: team.possible_leverage || 'Unknown leverage',
      biggest_risk: team.gap || 'The wedge may not survive real customer behavior or the target segment may be too narrow.',
      cheapest_test: `Talk to 10 users in the target segment, validate the pain, and run a narrow prototype using ${team.evidence_source || 'public evidence'} as the initial wedge.`
    });
  });

  return opportunities.length >= 3 ? opportunities.slice(0, 7) : Array.from({ length: 3 }, (_, index) => {
    const signal = signals[index] || signals[0];
    return makeOpportunity({
      title: `Opportunity ${index + 1}`,
      idea: signal.problem || 'A narrow workflow automation opportunity rooted in actual pain.',
      why_this_team: 'The team has a plausible capability signal and an executable wedge if the problem is real.',
      required_capabilities: ['Distribution validation', 'Focused product execution', 'Clear customer segment'],
      evidence: [{ title: 'UNKNOWN', url: 'UNKNOWN' }],
      distribution_wedge: signal.distribution || 'Founder-led distribution or niche community channel',
      product_wedge: signal.product || 'A narrow workflow tool that removes a high-friction task',
      moat_potential: 'Unknown moat potential',
      biggest_risk: 'The market need may be overstated or too fragmented to support a wedge.',
      cheapest_test: 'Run a customer interview and a one-week prototype backed by real workflow pain.'
    });
  });
}
