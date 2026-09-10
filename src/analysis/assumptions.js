export function deriveAssumptions(thesis = {}) {
  const base = Array.isArray(thesis.core_assumptions) ? thesis.core_assumptions : [];
  const assumptions = base.map((statement, index) => ({
    id: `assumption-${index + 1}`,
    statement: String(statement || 'Assumption missing.'),
    category: 'demand',
    importance: index === 0 ? 'high' : 'medium',
    falsifiable: true,
    what_would_disprove_it: 'A credible customer or market signal shows this assumption is false or materially weaker than described.',
  }));

  const extra = [
    {
      id: 'assumption-1',
      statement: 'The target customer experiences enough pain to justify switching from their current workflow.',
      category: 'customer',
      importance: 'high',
      falsifiable: true,
      what_would_disprove_it: 'Users report they already tolerate the current workflow or do not have a painful problem worth fixing.',
    },
    {
      id: 'assumption-2',
      statement: 'The team can access a wedge that competitors or incumbents ignore or cannot easily duplicate.',
      category: 'team',
      importance: 'high',
      falsifiable: true,
      what_would_disprove_it: 'The wedge is not unique or the team lacks the capabilities to exploit it.',
    },
    {
      id: 'assumption-3',
      statement: 'A credible distribution path exists that is cheaper or more direct than broad paid acquisition.',
      category: 'distribution',
      importance: 'high',
      falsifiable: true,
      what_would_disprove_it: 'The team has no visible distribution lever or the acquisition cost is structurally unaffordable.',
    },
  ];

  return assumptions.length ? assumptions : extra;
}

export function buildResearchQuestions(thesis = {}, assumptions = []) {
  const assumptionStatements = assumptions.map((item) => item.statement);
  return [
    {
      id: 'rq-1',
      question: `What evidence shows that ${thesis.idea || 'the startup idea'} creates a recurring and painful problem not already solved adequately?`,
      purpose: 'demand',
      target_sources: ['customer discussions', 'public comparisons', 'product pages', 'case studies'],
      related_assumptions: assumptionStatements.slice(0, 2),
    },
    {
      id: 'rq-2',
      question: 'How are users currently solving this problem, and how expensive is switching?',
      purpose: 'current behavior',
      target_sources: ['public product pages', 'forums', 'documentation', 'comparisons'],
      related_assumptions: assumptionStatements.slice(1, 3),
    },
    {
      id: 'rq-3',
      question: 'What existing players, substitutes, or adjacent workflows compete for the same wedge?',
      purpose: 'competition',
      target_sources: ['competitor pages', 'review sites', 'market lists'],
      related_assumptions: assumptionStatements.slice(1, 4),
    },
  ];
}
