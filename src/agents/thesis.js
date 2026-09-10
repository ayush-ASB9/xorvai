import { createLogger } from '../utils/logger.js';

const logger = createLogger('THESIS');

export function generateThesis(input = {}) {
  const idea = String(input.idea || '').trim();
  if (!idea) {
    throw new Error('A startup idea is required to generate a thesis.');
  }

  const thesis = {
    idea,
    thesis: `The startup can win by proving that ${idea} matters enough to deserve a narrow wedge, a distinct distribution path, and a measurable customer problem before the market fully validates it.`,
    coreAssumptions: [
      'Users are currently experiencing a real, recurring pain.',
      'The pain is strong enough to justify switching or a new workflow.',
      'The team can create a wedge faster than incumbents and substitute products.',
    ],
    researchQuestions: [
      'What current behavior already solves this problem?',
      'Who already captures demand and how?',
      'What weak point could a focused startup exploit?',
    ],
    stage: 'THESIS',
  };

  logger.info('Generated thesis for idea:', idea);
  return thesis;
}
