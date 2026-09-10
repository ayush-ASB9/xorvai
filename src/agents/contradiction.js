import { findContradictions } from '../analysis/contradictions.js';

export function runContradictionEngine(evidence = []) {
  return {
    stage: 'CONTRADICTIONS',
    contradictions: findContradictions(evidence),
    summary: `${findContradictions(evidence).length} contradictions identified from the evidence set.`,
  };
}
