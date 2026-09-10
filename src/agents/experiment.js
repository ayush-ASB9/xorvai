export function generateNextExperiment(report = {}) {
  return {
    stage: 'EXPERIMENT',
    nextExperiment: 'Run a single problem validation with 10 real prospects or users to confirm whether the pain exists and is urgent enough to pay for it.',
    successMetric: 'At least 3 users report the problem as recurring and expensive in time or money.',
  };
}
