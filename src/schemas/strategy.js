export function makeOpportunity(data = {}) {
  return {
    title: data.title || 'Untitled opportunity',
    idea: data.idea || 'Unspecified idea',
    why_this_team: data.why_this_team || data.whyThisTeam || 'The team has relevant public signals and a plausible wedge.',
    required_capabilities: Array.isArray(data.required_capabilities) ? data.required_capabilities : Array.isArray(data.requiredCapabilities) ? data.requiredCapabilities : [],
    evidence: Array.isArray(data.evidence) ? data.evidence : [],
    distribution_wedge: data.distribution_wedge || data.distributionWedge || 'Unknown distribution wedge',
    product_wedge: data.product_wedge || data.productWedge || 'Unknown product wedge',
    moat_potential: data.moat_potential || data.moatPotential || 'Unknown moat potential',
    biggest_risk: data.biggest_risk || data.biggestRisk || 'The core wedge may not persist under real user behavior.',
    cheapest_test: data.cheapest_test || data.cheapestTest || 'Run the smallest user-facing experiment with the narrowest target segment.',
  };
}
