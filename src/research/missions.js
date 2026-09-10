export const RESEARCH_MISSIONS = [
  { missionType: 'demand', question: 'What demand signal exists for this startup idea?', priority: 'high' },
  { missionType: 'current-behavior', question: 'How are users currently solving this problem today?', priority: 'high' },
  { missionType: 'competition', question: 'Who already solves this problem or a close variant?', priority: 'high' },
  { missionType: 'negative-evidence', question: 'What evidence challenges the thesis?', priority: 'high' },
  { missionType: 'customer-language', question: 'What words do buyers use to describe the problem?', priority: 'medium' },
  { missionType: 'team', question: 'What public evidence supports the team’s capabilities?', priority: 'medium' },
];

export function createResearchMissions(input = {}) {
  return RESEARCH_MISSIONS.map((mission, index) => ({
    id: `mission-${index + 1}`,
    ...mission,
    target: input.idea || 'startup idea',
  }));
}
