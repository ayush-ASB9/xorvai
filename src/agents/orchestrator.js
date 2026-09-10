import { generateThesis } from './thesis.js';
import { runResearch } from './research.js';
import { buildEvidenceSet } from '../analysis/evidence.js';
import { runContradictionEngine } from './contradiction.js';
import { runTeamAnalysis } from './team.js';
import { runCookEngine } from './strategy.js';
import { runAdversarialJudge } from './judge.js';
import { generateNextExperiment } from './experiment.js';
import { normalizeIdeaInput } from '../utils/validation.js';
import { createAIProvider } from '../ai/provider.js';
import { makeVerdict } from '../schemas/report.js';
import { deriveAssumptions, buildResearchQuestions } from '../analysis/assumptions.js';
import { createBuildCase } from '../analysis/buildCase.js';
import { createKillCase } from '../analysis/killCase.js';
import { collectUnknowns } from '../analysis/unknowns.js';
import { determineVerdict } from '../analysis/verdict.js';
import { buildJudgePrompt } from '../ai/prompts.js';

export async function orchestrateAnalysis(input, env = {}) {
  const parsed = normalizeIdeaInput(input || {});
  const thesis = generateThesis(parsed);
  const assumptions = deriveAssumptions(thesis);
  const researchQuestions = buildResearchQuestions(thesis, assumptions);
  const research = await runResearch({ ...parsed, thesis, assumptions, researchQuestions }, []);
  const evidence = buildEvidenceSet(research.evidence || []);
  const contradictions = runContradictionEngine(evidence);
  const team = runTeamAnalysis(parsed.teamUrls || parsed.founderUrls || [], [
    { requiredCapability: 'Product and go-to-market experimentation' },
    { requiredCapability: 'Distribution leverage' },
  ]);
  const cook = runCookEngine(team.teamFit || [], [
    {
      problem: thesis.problem || thesis.idea,
      distribution: 'founder-led distribution or niche community channel',
      product: 'narrow workflow automation for the highest-friction task',
      marketEvidence: 'Public demand signal and visible workaround behavior',
    },
  ]);
  const buildCase = createBuildCase({ evidence, teamFit: team.teamFit, cook, assumptions });
  const killCase = createKillCase({ contradictions: contradictions.contradictions || [], unknowns: [], assumptions });
  const unknowns = collectUnknowns({ evidence, teamFit: team.teamFit, research });
  const baseVerdict = determineVerdict({ contradictions: contradictions.contradictions || [], unknown: unknowns, teamFit: team.teamFit || [] });
  const judgeInput = {
    thesis,
    assumptions,
    researchQuestions,
    evidence,
    contradictions: contradictions.contradictions || [],
    team,
    teamFit: team.teamFit || [],
    cook,
    buildCase,
    killCase,
    unknowns,
    initialVerdict: baseVerdict,
  };
  const judge = runAdversarialJudge(judgeInput);
  const ai = await createAIProvider(env);
  const modelResult = await ai.generateJSON(buildJudgePrompt(judgeInput), {
    verdict: 'BUILD',
    reasoning: 'string',
    strongest_evidence: [''],
    strongest_contradiction: [''],
    biggest_unknown: 'string',
    kill_conditions: [''],
    confidence: 0,
  });

  const normalizedJudge = {
    stage: 'JUDGE',
    verdict: ['BUILD', 'REWORK', 'KILL'].includes(modelResult?.verdict) ? modelResult.verdict : judge.verdict || baseVerdict.verdict,
    reasoning: typeof modelResult?.reasoning === 'string' && modelResult.reasoning.trim() ? modelResult.reasoning : judge.reasoning || baseVerdict.reasoning,
    strongest_evidence: Array.isArray(modelResult?.strongest_evidence) ? modelResult.strongest_evidence.filter(Boolean) : judge.strongest_evidence || [],
    strongest_contradiction: Array.isArray(modelResult?.strongest_contradiction) ? modelResult.strongest_contradiction.filter(Boolean) : judge.strongest_contradiction || [],
    biggest_unknown: typeof modelResult?.biggest_unknown === 'string' && modelResult.biggest_unknown.trim() ? modelResult.biggest_unknown : unknowns[0]?.item || 'Unknown',
    kill_conditions: Array.isArray(modelResult?.kill_conditions) ? modelResult.kill_conditions.filter(Boolean) : judge.kill_conditions || [],
  };

  const verdict = makeVerdict({
    verdict: normalizedJudge.verdict || baseVerdict.verdict,
    reasoning: normalizedJudge.reasoning || baseVerdict.reasoning,
    confidence: Number.isFinite(modelResult?.confidence) ? modelResult.confidence : 0.65,
  });

  const experiment = generateNextExperiment({ thesis, assumptions, evidence, contradictions: contradictions.contradictions || [], unknowns });
  const researchPlan = {
    stage: 'RESEARCH PLAN',
    questions: researchQuestions,
    assumptions,
  };

  const finalReport = {
    stage: 'FINAL REPORT',
    verdict,
    thesis,
    assumptions,
    researchPlan,
    evidence,
    contradictions: contradictions.contradictions,
    team,
    teamFit: team.teamFit,
    cook,
    buildCase,
    killCase,
    unknowns,
    judge: normalizedJudge,
    experiment,
  };

  return {
    stageOrder: ['INPUT', 'THESIS', 'ASSUMPTIONS', 'RESEARCH PLAN', 'RESEARCH', 'EVIDENCE', 'CONTRADICTIONS', 'TEAM', 'TEAM × STARTUP', 'COOK', 'BUILD CASE', 'KILL CASE', 'KILL CONDITIONS', 'UNKNOWN', 'JUDGE', 'NEXT EXPERIMENT', 'FINAL REPORT'],
    thesis,
    assumptions,
    researchPlan,
    researchQuestions,
    research,
    evidence,
    contradictions: contradictions.contradictions,
    team,
    teamFit: team.teamFit,
    cook,
    buildCase,
    killCase,
    killConditions: [
      'Users do not show a strong willingness to switch away from the current workflow.',
      'The team lacks a credible distribution or technical wedge.',
      'The thesis is contradicted by direct evidence or substitute behavior.',
    ],
    unknowns,
    judge: normalizedJudge,
    verdict,
    experiment,
    finalReport,
    aiProvider: ai.mode,
    generatedModel: modelResult,
  };
}
