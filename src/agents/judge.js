import { determineVerdict } from '../analysis/verdict.js';

export function runAdversarialJudge(report = {}) {
  const verdict = determineVerdict(report);

  const judge = {
    stage: 'ADVERSARIAL JUDGE',
    verdict: verdict.verdict,
    reasoning: verdict.reasoning,
    attackVectors: [
      'Demand attack',
      'Competition attack',
      'Distribution attack',
      'Trust attack',
    ],
    killConditions: [
      'Users already solve the problem with existing tools.',
      'The problem is not painful enough to justify switching.',
      'The team lacks evidence of product or distribution leverage.',
    ],
    buildCase: ['A narrow wedge exists', 'Team capability is plausible', 'Distribution path is not obviously impossible'],
    killCase: ['Demand is weaker than assumed', 'The product is easier to substitute', 'The team cannot defend the wedge'],
  };

  return judge;
}
