import { deriveCookOpportunities } from '../analysis/cook.js';

export function runCookEngine(teamFit = [], marketSignals = []) {
  return {
    stage: 'COOK',
    opportunities: deriveCookOpportunities(teamFit, marketSignals.length ? marketSignals : [{ problem: 'The startup solves a high-friction workflow with a narrow wedge.' }]),
  };
}
