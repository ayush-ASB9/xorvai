export function createBuildCase(graph = {}) {
  const strongestReasons = [
    'The startup solves a specific and painful process problem rather than a vague need.',
    'The team appears to have a plausible wedge or distribution path that is not obviously generic.',
    'There is enough structure in the evidence graph to justify a focused experiment before a broader build.',
  ];

  return {
    strongest_reasons: strongestReasons,
    supporting_evidence: Array.isArray(graph.evidence) ? graph.evidence.slice(0, 3).map((item) => item.claim || 'Evidence claim') : [],
    unique_team_advantages: Array.isArray(graph.teamFit) ? graph.teamFit.map((item) => item.requiredCapability || 'Capability under review') : [],
    strategic_wedges: Array.isArray(graph.cook?.opportunities) ? graph.cook.opportunities.map((item) => item.whatItIs || 'Opportunity') : [],
    conditions_required: [
      'Users must demonstrate that the problem is costly and recurring.',
      'The team’s capability signal must be supported by more than public URLs.',
      'A narrow wedge must survive direct attack from substitute products and incumbents.',
    ],
  };
}
