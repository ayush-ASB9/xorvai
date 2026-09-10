const root = document.getElementById('xorvai-root');
const STORAGE_KEYS = {
  email: 'xorvai-user-email',
  settings: 'xorvai-settings',
  reports: 'xorvai-reports',
  archive: 'xorvai-archive',
  analysis: 'xorvai-latest-analysis',
};

const defaults = {
  theme: 'dark',
  accent: 'amber',
  reducedMotion: false,
  compactMode: false,
};

const state = {
  route: '/',
  email: '',
  settings: { ...defaults },
  analysis: null,
};

const PIPELINE_STEPS = ['START', 'INPUT', 'THESIS', 'ASSUMPTIONS', 'RESEARCH PLAN', 'RESEARCH', 'EVIDENCE', 'TEAM', 'TEAM × STARTUP', 'COOK', 'JUDGE', 'FINAL REPORT'];

function parseList(value) {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeEmail(value) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : '';
}

function getSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    return { ...defaults, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { ...defaults };
  }
}

function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
}

function applySettings() {
  const settings = getSettings();
  state.settings = settings;
  document.documentElement.dataset.theme = settings.theme;
  document.documentElement.dataset.accent = settings.accent;
  document.documentElement.dataset.motion = settings.reducedMotion ? 'reduced' : 'full';
  document.documentElement.dataset.compact = settings.compactMode ? 'compact' : 'normal';
}

function getStats() {
  return fetch('/api/stats')
    .then(async (res) => {
      const json = await res.json().catch(() => ({}));
      return res.ok && json?.ok ? Number(json.data?.users || 0) : 0;
    })
    .catch(() => 0);
}

function setBadge(text, tone = 'neutral') {
  const badge = document.getElementById('status-badge');
  if (!badge) return;
  badge.textContent = text;
  badge.style.borderColor = tone === 'danger' ? 'rgba(255, 107, 107, 0.55)' : tone === 'warn' ? 'rgba(247, 186, 99, 0.45)' : 'rgba(148, 163, 184, 0.3)';
  badge.style.color = tone === 'danger' ? '#ffb3b3' : tone === 'warn' ? '#ffd38d' : '#edf2ff';
}

function renderPipeline(stageName) {
  const pipelineItems = document.querySelectorAll('.pipeline-item');
  const fallback = stageName || 'REPORT';
  const activeIndex = PIPELINE_STEPS.findIndex((step) => step === fallback.toUpperCase());
  const selectedIndex = activeIndex >= 0 ? activeIndex : PIPELINE_STEPS.length - 1;

  pipelineItems.forEach((item, index) => {
    item.classList.toggle('active', index === selectedIndex);
    item.classList.toggle('complete', index < selectedIndex);
  });
}

function renderAnalysisProgress(stageOrder = PIPELINE_STEPS) {
  const progressRail = document.getElementById('progress-rail');
  const stageLog = document.getElementById('stage-log');
  if (!progressRail || !stageLog) return;

  const steps = Array.isArray(stageOrder) && stageOrder.length ? stageOrder : PIPELINE_STEPS;

  progressRail.innerHTML = steps
    .map((step, index) => {
      const stage = String(step).trim();
      const isActive = index === steps.length - 1;
      const isComplete = index < steps.length - 1;
      return `<span class="progress-step ${isActive ? 'active' : ''} ${isComplete ? 'complete' : ''}">${escapeHtml(stage)}</span>`;
    })
    .join('');

  stageLog.innerHTML = steps
    .map((step, index) => {
      const label = String(step).trim();
      const state = index === steps.length - 1 ? 'active' : index < steps.length - 1 ? 'complete' : 'pending';
      return `<li data-state="${state}">${escapeHtml(label)}</li>`;
    })
    .join('');
}

function showLoadingState() {
  const inputScreen = document.getElementById('input-screen');
  const analysisScreen = document.getElementById('analysis-screen');
  const reportScreen = document.getElementById('report-screen');
  const errorState = document.getElementById('error-state');
  if (!analysisScreen || !inputScreen || !reportScreen || !errorState) return;

  inputScreen.classList.add('hidden');
  analysisScreen.classList.remove('hidden');
  reportScreen.classList.add('hidden');
  errorState.classList.add('hidden');
  setBadge('ANALYZING', 'warn');
  const analysisStage = document.getElementById('analysis-stage-name');
  if (analysisStage) analysisStage.textContent = 'INITIALIZING';
  renderAnalysisProgress(PIPELINE_STEPS);
}

function buildSection(title, bodyHtml) {
  return `
    <section class="report-section">
      <h3>${escapeHtml(title)}</h3>
      <div class="report-body">${bodyHtml}</div>
    </section>
  `;
}

function renderEvidence(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return '<div class="empty-state">No evidence was collected for this stage.</div>';
  }

  return `
    <div class="evidence-grid">
      ${items.map((item) => {
        const classification = String(item.classification || item.type || 'UNKNOWN').toUpperCase();
        const strength = Number(item.evidenceStrength ?? item.evidence_strength ?? 1);
        const source = item.source || {};
        const url = item.url || source.url || '';
        const excerpt = item.excerpt || item.text || 'No excerpt provided.';
        const normalizedClassification = classification === 'FACT' ? 'fact' : classification === 'SIGNAL' ? 'signal' : classification === 'ASSUMPTION' ? 'assumption' : 'unknown';

        return `
          <article class="evidence-card">
            <div class="evidence-head">
              <span class="badge ${normalizedClassification}">${escapeHtml(classification)}</span>
              <span class="strength">Strength ${Math.max(1, Math.min(5, strength || 1))}</span>
            </div>
            <details open>
              <summary>${escapeHtml(item.claim || 'Evidence claim')}</summary>
              <p class="report-block">${escapeHtml(excerpt)}</p>
              <p class="report-block"><strong>Reasoning:</strong> ${escapeHtml(item.reasoning || 'No reasoning provided.')}</p>
              ${url ? `<p><a class="source-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Source</a></p>` : ''}
            </details>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

function renderContradictions(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return '<div class="empty-state">No contradictions were detected in the current evidence set.</div>';
  }

  return `
    <div class="contradiction-grid">
      ${items.map((item) => `
        <article class="contradiction-card">
          <div class="card-head">
            <strong>${escapeHtml(item.claim || 'Contradiction')}</strong>
            <span class="severity badge unknown">${escapeHtml(item.severity || 'MEDIUM')}</span>
          </div>
          <p class="report-block">${escapeHtml(item.whyItMatters || 'This contradicts the current thesis and should weaken confidence unless resolved.')}</p>
          ${Array.isArray(item.counterEvidence) && item.counterEvidence.length ? `<ul class="list-plain">${item.counterEvidence.map((entry) => `<li>${escapeHtml(entry)}</li>`).join('')}</ul>` : ''}
        </article>
      `).join('')}
    </div>
  `;
}

function renderValueList(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return '<div class="empty-state">No data available.</div>';
  }

  return `<ul class="list-plain">${items.map((item) => {
    if (typeof item === 'string' || typeof item === 'number') return `<li>${escapeHtml(item)}</li>`;
    if (item && typeof item === 'object') {
      if (typeof item.statement === 'string') return `<li>${escapeHtml(item.statement)}</li>`;
      if (typeof item.question === 'string') return `<li>${escapeHtml(item.question)}</li>`;
      if (typeof item.claim === 'string') return `<li>${escapeHtml(item.claim)}</li>`;
      if (typeof item.title === 'string') return `<li>${escapeHtml(item.title)}</li>`;
    }
    return `<li>${escapeHtml(String(item || 'Unknown'))}</li>`;
  }).join('')}</ul>`;
}

function renderTeamFit(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return '<div class="empty-state">No team-fit map is available yet.</div>';
  }

  return `
    <div class="team-grid">
      ${items.map((item) => `
        <article class="team-card">
          <div class="card-head">
            <strong>${escapeHtml(item.startup_requirement || item.required_capability || 'Startup requirement')}</strong>
            <span class="badge ${item.demonstrated_capability === 'proven capability' ? 'fact' : item.demonstrated_capability === 'probable capability' ? 'signal' : 'unknown'}">${escapeHtml(item.demonstrated_capability || 'unverified capability')}</span>
          </div>
          <p class="report-block"><strong>Required capability:</strong> ${escapeHtml(item.required_capability || 'Unknown')}</p>
          <p class="report-block"><strong>Evidence:</strong> ${escapeHtml(item.evidence_source || 'UNKNOWN')}</p>
          <p class="report-block"><strong>Possible leverage:</strong> ${escapeHtml(item.possible_leverage || 'Unknown leverage')}</p>
          <p class="report-block"><strong>Gap:</strong> ${escapeHtml(item.gap || 'None identified')}</p>
          <p class="report-block"><strong>Unknown:</strong> ${escapeHtml(item.unknown || 'Unknown')}</p>
          <p class="report-block"><strong>Strategic implication:</strong> ${escapeHtml(item.strategic_implication || 'Test before broad build.')}</p>
        </article>
      `).join('')}
    </div>
  `;
}

function renderCook(opportunities = []) {
  if (!Array.isArray(opportunities) || opportunities.length === 0) {
    return '<div class="empty-state">No strategic opportunities generated yet.</div>';
  }

  return `
    <div class="opportunity-grid">
      ${opportunities.map((item) => `
        <article class="opportunity-card">
          <div class="opportunity-head">
            <strong>${escapeHtml(item.title || 'Untitled opportunity')}</strong>
          </div>
          <p class="report-block"><strong>Idea:</strong> ${escapeHtml(item.idea || 'No idea provided.')}</p>
          <p class="report-block"><strong>Why this team:</strong> ${escapeHtml(item.why_this_team || 'No explanation provided.')}</p>
          <p class="report-block"><strong>Required capabilities:</strong> ${escapeHtml((item.required_capabilities || []).join(', ') || 'Unknown')}</p>
          <p class="report-block"><strong>Distribution wedge:</strong> ${escapeHtml(item.distribution_wedge || 'Unknown')}</p>
          <p class="report-block"><strong>Product wedge:</strong> ${escapeHtml(item.product_wedge || 'Unknown')}</p>
          <p class="report-block"><strong>Moat potential:</strong> ${escapeHtml(item.moat_potential || 'Unknown')}</p>
          <p class="report-block"><strong>Biggest risk:</strong> ${escapeHtml(item.biggest_risk || 'Unknown')}</p>
          <p class="report-block"><strong>Cheapest test:</strong> ${escapeHtml(item.cheapest_test || 'Unknown')}</p>
        </article>
      `).join('')}
    </div>
  `;
}

function renderReport(result = {}) {
  const thesis = result.thesis || {};
  const assumptions = Array.isArray(result.assumptions) ? result.assumptions : [];
  const research = result.research || {};
  const evidence = Array.isArray(result.evidence) ? result.evidence : [];
  const contradictions = Array.isArray(result.contradictions) ? result.contradictions : [];
  const team = result.team || {};
  const teamFit = Array.isArray(result.teamFit) ? result.teamFit : [];
  const cook = result.cook || {};
  const buildCase = result.buildCase || {};
  const killCase = result.killCase || {};
  const verdict = result.verdict || {};
  const judge = result.judge || {};
  const unknowns = Array.isArray(result.unknowns) ? result.unknowns : [];
  const experiment = result.experiment || {};
  const researchMissions = Array.isArray(research.missions) ? research.missions : [];
  const demandMission = researchMissions.find((mission) => String(mission.missionType || '').includes('demand'));
  const behaviorMission = researchMissions.find((mission) => String(mission.missionType || '').includes('current'));
  const competitionMission = researchMissions.find((mission) => String(mission.missionType || '').includes('competition'));

  const sections = [
    buildSection('THESIS', `
      <div class="report-block"><strong>Idea:</strong> ${escapeHtml(thesis.idea || 'Unknown')}</div>
      <div class="report-block">${escapeHtml(thesis.thesis || 'No thesis generated yet.')}</div>
    `),
    buildSection('CORE ASSUMPTIONS', renderValueList(assumptions)),
    buildSection('DEMAND', `
      <div class="report-block"><strong>Mission:</strong> ${escapeHtml(demandMission?.question || 'Demand research is not available yet.')}</div>
      <div class="report-block"><strong>Summary:</strong> ${escapeHtml(research.summary || 'Demand signal is not yet proven.')}</div>
    `),
    buildSection('CURRENT BEHAVIOR', `
      <div class="report-block"><strong>Mission:</strong> ${escapeHtml(behaviorMission?.question || 'Current behavior research is not available yet.')}</div>
      ${renderValueList(researchMissions.filter((mission) => String(mission.missionType || '').includes('current')).map((mission) => mission.question))}
    `),
    buildSection('COMPETITION', `
      <div class="report-block"><strong>Mission:</strong> ${escapeHtml(competitionMission?.question || 'Competition mapping is not available yet.')}</div>
      ${renderValueList(researchMissions.filter((mission) => String(mission.missionType || '').includes('competition')).map((mission) => mission.question))}
    `),
    buildSection('EVIDENCE', renderEvidence(evidence)),
    buildSection('CONTRADICTIONS', renderContradictions(contradictions)),
    buildSection('TEAM', `
      <div class="meta-grid">
        <div class="meta-card"><span class="label">Stage</span><div>${escapeHtml(team.stage || 'TEAM')}</div></div>
        <div class="meta-card"><span class="label">Unknowns</span><div>${escapeHtml((team.unknowns || []).join(', ') || 'None')}</div></div>
      </div>
      ${renderValueList((team.capabilities || []).map((item) => item.requiredCapability || 'Capability under review'))}
    `),
    buildSection('TEAM × STARTUP', renderTeamFit(teamFit)),
    buildSection('WHAT COULD THEY COOK?', renderCook(cook.opportunities || [])),
    buildSection('BUILD CASE', `
      <div class="report-block"><strong>Strongest reasons:</strong> ${escapeHtml((buildCase.strongest_reasons || []).join(' • ') || 'No build case yet.')}</div>
      ${renderValueList(buildCase.supporting_evidence || [])}
      ${renderValueList(buildCase.unique_team_advantages || [])}
      ${renderValueList(buildCase.strategic_wedges || [])}
    `),
    buildSection('KILL CASE', `
      <div class="report-block">${escapeHtml(killCase.reasoning || 'No kill case generated yet.')}</div>
      ${renderValueList(killCase.kill_conditions || [])}
    `),
    buildSection('KILL CONDITIONS', renderValueList(result.killConditions || [])),
    buildSection('UNKNOWN', renderValueList(unknowns.map((item) => item.item || item.reason || 'Unknown'))),
    buildSection('VERDICT', `
      <div class="verdict-shell">
        <div class="verdict-badge ${String(verdict.verdict || 'REWORK').toLowerCase()}">${escapeHtml(String(verdict.verdict || 'REWORK').toUpperCase())}</div>
        <div class="report-block">${escapeHtml(verdict.reasoning || judge.reasoning || 'No verdict reasoning available.')}</div>
      </div>
    `),
    buildSection('WHAT WOULD CHANGE MY MIND?', `
      <div class="report-block">${escapeHtml(judge.reasoning || 'The judge has not surfaced a decisive condition yet.')}</div>
      ${renderValueList(judge.kill_conditions || [])}
    `),
    buildSection('NEXT EXPERIMENT', `
      <div class="report-block"><strong>Hypothesis:</strong> ${escapeHtml(experiment.hypothesis || 'No next experiment is defined yet.')}</div>
      <div class="report-block"><strong>Question:</strong> ${escapeHtml(experiment.question || 'No question recorded yet.')}</div>
      <div class="report-block"><strong>Method:</strong> ${escapeHtml(experiment.method || 'No method recorded yet.')}</div>
    `),
  ];

  const reportContent = document.getElementById('report-content');
  const reportScreen = document.getElementById('report-screen');
  const analysisScreen = document.getElementById('analysis-screen');
  if (!reportContent || !reportScreen || !analysisScreen) return;

  reportContent.innerHTML = sections.join('');
  reportScreen.classList.remove('hidden');
  analysisScreen.classList.add('hidden');
  setBadge('REPORT READY', 'neutral');
}

async function submitAnalysis(event) {
  event.preventDefault();

  const inputScreen = document.getElementById('input-screen');
  const analysisScreen = document.getElementById('analysis-screen');
  const errorState = document.getElementById('error-state');
  if (!inputScreen || !analysisScreen || !errorState) return;

  const idea = document.getElementById('idea').value.trim();
  if (!idea) {
    setBadge('INPUT REQUIRED', 'danger');
    errorState.textContent = 'Startup idea is required before analysis begins.';
    errorState.classList.remove('hidden');
    return;
  }

  const payload = {
    idea,
    description: document.getElementById('description').value,
    founderInfo: document.getElementById('founderInfo').value,
    founderUrls: parseList(document.getElementById('teamUrls').value),
    startupUrl: document.getElementById('startupUrl').value,
    competitorUrls: parseList(document.getElementById('competitorUrls').value),
    teamUrls: parseList(document.getElementById('teamUrls').value),
    customerProblem: document.getElementById('customerProblem').value,
    context: document.getElementById('context').value,
    depth: 'STANDARD',
  };

  showLoadingState();
  renderPipeline('THESIS');

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await response.json();
    if (!response.ok || !json.ok) {
      throw new Error(json.error || 'Analysis failed.');
    }

    const result = json.data || {};
    const stageOrder = Array.isArray(result.stageOrder) && result.stageOrder.length ? result.stageOrder : PIPELINE_STEPS;
    renderAnalysisProgress(stageOrder);
    renderPipeline(String(stageOrder[stageOrder.length - 1] || 'REPORT'));
    const analysisStage = document.getElementById('analysis-stage-name');
    if (analysisStage) analysisStage.textContent = String(stageOrder[stageOrder.length - 1] || 'REPORT');
    setBadge('REPORT READY', 'neutral');
    state.analysis = result;
    localStorage.setItem(STORAGE_KEYS.analysis, JSON.stringify(result));
    const reports = JSON.parse(localStorage.getItem(STORAGE_KEYS.reports) || '[]');
    const trimmedTitle = String(result?.thesis?.idea || 'XORVAI research').slice(0, 80);
    reports.unshift({ title: trimmedTitle, date: new Date().toISOString(), data: result, verdict: result?.verdict?.verdict || 'REWORK' });
    localStorage.setItem(STORAGE_KEYS.reports, JSON.stringify(reports.slice(0, 10)));
    if (String(result?.verdict?.verdict || '').toUpperCase() === 'KILL') {
      const archive = JSON.parse(localStorage.getItem(STORAGE_KEYS.archive) || '[]');
      archive.unshift({ title: trimmedTitle, date: new Date().toISOString(), data: result, verdict: 'KILL' });
      localStorage.setItem(STORAGE_KEYS.archive, JSON.stringify(archive.slice(0, 20)));
    }
    renderReport(result);
  } catch (error) {
    analysisScreen.classList.add('hidden');
    errorState.textContent = `The investigation hit a wall: ${error.message}`;
    errorState.classList.remove('hidden');
    setBadge('ERROR', 'danger');
    inputScreen.classList.remove('hidden');
  }
}

function renderEntryPage() {
  root.innerHTML = `
    <div class="entry-shell">
      <div class="entry-panel">
        <div class="entry-brand" aria-label="XORVAI logo">
          <svg viewBox="0 0 120 120" role="img" aria-hidden="true">
            <path d="M28 18 L54 60 L30 102 L42 102 L62 66 L82 102 L94 102 L70 60 L94 18 L82 18 L62 54 L42 18 Z" />
          </svg>
        </div>
        <div class="entry-kicker">XORVAI</div>
        <h1>DON’T VALIDATE IT.</h1>
        <h2>TRY TO KILL IT.</h2>
        <p class="entry-description">An adversarial startup research agent that tries to break your thesis before the market does.</p>

        <form id="entry-form" class="entry-form">
          <label for="entry-email">Enter your email to continue.</label>
          <div class="entry-row">
            <input id="entry-email" name="email" type="email" placeholder="your@email.com" autocomplete="email" required />
            <button type="submit" class="primary-button">ENTER XORVAI →</button>
          </div>
        </form>

        <p class="privacy-note">Your email is used to remember your access and measure early usage.</p>
        <div class="entry-meta" id="entry-stats">Loading researcher count…</div>
      </div>
    </div>
  `;

  const statsNode = document.getElementById('entry-stats');
  if (statsNode) {
    getStats().then((count) => {
      statsNode.textContent = count > 0 ? `${count} researcher${count === 1 ? '' : 's'} are testing XORVAI` : 'Early access is open';
    });
  }

  const form = document.getElementById('entry-form');
  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const emailInput = document.getElementById('entry-email');
      const email = normalizeEmail(emailInput.value);
      if (!email) {
        emailInput.focus();
        return;
      }

      try {
        const response = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const json = await response.json();
        if (!response.ok || !json.ok) {
          throw new Error(json.error || 'Registration failed.');
        }

        localStorage.setItem(STORAGE_KEYS.email, email);
        state.email = email;
        window.history.pushState({}, '', '/app');
        render();
      } catch (error) {
        const label = document.querySelector('#entry-form label');
        if (label) label.textContent = error.message || 'Registration failed.';
      }
    });
  }
}

function renderEmptyState(type) {
  const mappings = {
    analysis: {
      title: 'NO INVESTIGATION YET',
      body: 'You have not attacked an idea yet.',
      button: 'START AN ATTACK →',
    },
    reports: {
      title: 'NO INVESTIGATIONS YET',
      body: 'The first verdict will appear here.',
      button: null,
    },
    archive: {
      title: 'NOTHING HAS BEEN KILLED YET',
      body: 'This is where failed hypotheses go.',
      button: null,
    },
  };

  const config = mappings[type] || mappings.analysis;
  return `
    <div class="empty-panel">
      <div class="empty-title">${config.title}</div>
      <p>${config.body}</p>
      ${config.button ? `<button type="button" class="primary-button empty-action">${config.button}</button>` : ''}
    </div>
  `;
}

function renderReportsList() {
  const reports = JSON.parse(localStorage.getItem(STORAGE_KEYS.reports) || '[]');
  if (!Array.isArray(reports) || reports.length === 0) {
    return renderEmptyState('reports');
  }

  return `
    <div class="report-list">
      ${reports.map((report, index) => `
        <article class="report-item-row">
          <div class="report-item-main">
            <div class="report-item-title">${escapeHtml(report.title || `Report ${index + 1}`)}</div>
            <div class="report-item-meta">${escapeHtml(report.verdict || 'REWORK')} • ${escapeHtml(new Date(report.date || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }))}</div>
          </div>
          <button type="button" class="text-button" data-report-index="${index}">Open</button>
        </article>
      `).join('')}
    </div>
  `;
}

function renderArchiveList() {
  const archive = JSON.parse(localStorage.getItem(STORAGE_KEYS.archive) || '[]');
  if (!Array.isArray(archive) || archive.length === 0) {
    return renderEmptyState('archive');
  }

  return `
    <div class="report-list">
      ${archive.map((item, index) => `
        <article class="report-item-row archived">
          <div class="report-item-main">
            <div class="report-item-title">${escapeHtml(item.title || `Archive ${index + 1}`)}</div>
            <div class="report-item-meta">${escapeHtml(item.verdict || 'KILL')} • ${escapeHtml(new Date(item.date || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }))}</div>
          </div>
          <button type="button" class="text-button" data-archive-index="${index}">Open</button>
        </article>
      `).join('')}
    </div>
  `;
}

function renderAdminLogin() {
  root.innerHTML = `
    <div class="admin-shell">
      <div class="admin-panel">
        <div class="admin-header">
          <div class="admin-kicker">XORVAI / ADMIN</div>
          <h1>ADMIN ACCESS REQUIRED</h1>
        </div>
        <form id="admin-login-form" class="admin-form">
          <label for="admin-token">Authorization token</label>
          <input id="admin-token" type="password" placeholder="Bearer token" autocomplete="off" />
          <button type="submit" class="primary-button">ACCESS ADMIN →</button>
        </form>
      </div>
    </div>
  `;

  const form = document.getElementById('admin-login-form');
  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = document.getElementById('admin-token');
      const token = (input?.value || '').trim();
      if (!token) return;

      try {
        const response = await fetch('/api/admin/users', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          throw new Error('Invalid admin token');
        }

        sessionStorage.setItem('xorvai-admin-token', token);
        renderAdmin();
      } catch (error) {
        const label = form.querySelector('label');
        if (label) label.textContent = error.message || 'Unauthorized';
      }
    });
  }
}

async function renderAdmin() {
  const token = sessionStorage.getItem('xorvai-admin-token') || '';
  if (!token) {
    renderAdminLogin();
    return;
  }

  try {
    const response = await fetch('/api/admin/users', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      sessionStorage.removeItem('xorvai-admin-token');
      renderAdminLogin();
      return;
    }

    const json = await response.json();
    const users = Array.isArray(json?.data) ? json.data : [];

    root.innerHTML = `
      <div class="admin-shell">
        <div class="admin-panel wide">
          <div class="admin-header admin-row">
            <div>
              <div class="admin-kicker">XORVAI / ADMIN</div>
              <h1>REGISTERED USERS</h1>
            </div>
            <div class="admin-actions">
              <button type="button" class="secondary-button" id="admin-refresh">Refresh</button>
              <a href="/api/admin/export" class="secondary-button export-link" target="_blank" rel="noreferrer">Export CSV</a>
            </div>
          </div>

          <div class="admin-metrics">
            <div class="metric-box">
              <span class="metric-label">TOTAL USERS</span>
              <strong>${users.length}</strong>
            </div>
          </div>

          <div class="table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Email</th>
                  <th>Joined</th>
                  <th>Last Seen</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${users.length ? users.map((user, index) => `
                  <tr>
                    <td>${String(index + 1).padStart(2, '0')}</td>
                    <td>${escapeHtml(user.email || '')}</td>
                    <td>${escapeHtml(user.createdAt ? new Date(user.createdAt).toLocaleString() : '—')}</td>
                    <td>${escapeHtml(user.lastSeenAt ? new Date(user.lastSeenAt).toLocaleString() : '—')}</td>
                    <td><button type="button" class="table-button" data-admin-delete="${escapeHtml(user.email || '')}">Delete</button></td>
                  </tr>
                `).join('') : `
                  <tr><td colspan="5">NO USERS YET</td></tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    const refreshButton = document.getElementById('admin-refresh');
    if (refreshButton) refreshButton.addEventListener('click', () => renderAdmin());

    document.querySelectorAll('[data-admin-delete]').forEach((button) => {
      button.addEventListener('click', async () => {
        const email = button.getAttribute('data-admin-delete');
        if (!email) return;
        const confirmed = window.confirm(`Delete ${email}?`);
        if (!confirmed) return;

        const response = await fetch('/api/admin/users', {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        });

        if (response.ok) {
          renderAdmin();
        }
      });
    });
  } catch (error) {
    renderAdminLogin();
  }
}

function renderDashboard() {
  const currentPath = state.route || '/app';
  const email = localStorage.getItem(STORAGE_KEYS.email) || state.email || '';
  const analysisCache = JSON.parse(localStorage.getItem(STORAGE_KEYS.analysis) || 'null');

  const navItems = [
    { key: '/app', label: 'Home' },
    { key: '/app/analysis', label: 'Analysis' },
    { key: '/app/reports', label: 'Reports' },
    { key: '/app/archive', label: 'Archive' },
    { key: '/app/settings', label: 'Settings' },
  ];

  root.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="sidebar-header">
          <div class="brand-block">
            <div class="brand-mark" aria-label="XORVAI logo">
              <svg viewBox="0 0 120 120" role="img" aria-hidden="true">
                <path d="M28 18 L54 60 L30 102 L42 102 L62 66 L82 102 L94 102 L70 60 L94 18 L82 18 L62 54 L42 18 Z" />
              </svg>
            </div>
            <div class="brand-word">XORVAI</div>
          </div>
          <div class="brand-subtitle">STARTUP RESEARCH AGENT</div>
        </div>

        <nav class="sidebar-nav" aria-label="Primary navigation">
          ${navItems.map((item) => `
            <button type="button" class="nav-item ${currentPath === item.key ? 'active' : ''}" data-route="${item.key}">
              <span class="nav-icon">${item.label === 'Home' ? '⌂' : item.label === 'Analysis' ? '◌' : item.label === 'Reports' ? '▣' : item.label === 'Archive' ? '▤' : '⚙'}</span>
              <span>${item.label}</span>
            </button>
          `).join('')}
        </nav>

        <div class="sidebar-note">
          <p>Better to be wrong early than right too late.</p>
          <span>— XORVAI</span>
        </div>

        <div class="sidebar-footer">
          <span>XORVAI</span>
          <span>ASB9.SYS</span>
        </div>
      </aside>

      <main class="main-panel">
        <header class="topbar">
          <div class="topbar-left">// XORVAI</div>
          <div class="status-badge" id="status-badge">READY</div>
        </header>
        <div id="dashboard-content"></div>
      </main>
    </div>
  `;

  const dashboardContent = document.getElementById('dashboard-content');
  if (!dashboardContent) return;

  const route = state.route || '/app';

  if (route === '/app/settings') {
    dashboardContent.innerHTML = `
      <section class="section-panel settings-panel">
        <div class="section-header">
          <p class="eyebrow">SETTINGS</p>
          <h2>Control the operating context.</h2>
        </div>

        <div class="settings-grid">
          <div class="settings-card">
            <div class="settings-label">Appearance</div>
            <label class="settings-field">
              <span>Theme</span>
              <select id="theme-select">
                <option value="dark" ${state.settings.theme === 'dark' ? 'selected' : ''}>Dark</option>
                <option value="light" ${state.settings.theme === 'light' ? 'selected' : ''}>Light</option>
                <option value="system" ${state.settings.theme === 'system' ? 'selected' : ''}>System</option>
              </select>
            </label>
            <label class="settings-field">
              <span>Accent</span>
              <select id="accent-select">
                <option value="amber" ${state.settings.accent === 'amber' ? 'selected' : ''}>Amber</option>
                <option value="neutral" ${state.settings.accent === 'neutral' ? 'selected' : ''}>Neutral</option>
              </select>
            </label>
          </div>

          <div class="settings-card">
            <div class="settings-label">Interface</div>
            <label class="settings-toggle">
              <span>Reduced motion</span>
              <input type="checkbox" id="motion-toggle" ${state.settings.reducedMotion ? 'checked' : ''} />
            </label>
            <label class="settings-toggle">
              <span>Compact mode</span>
              <input type="checkbox" id="compact-toggle" ${state.settings.compactMode ? 'checked' : ''} />
            </label>
          </div>

          <div class="settings-card">
            <div class="settings-label">Account</div>
            <label class="settings-field">
              <span>Registered email</span>
              <input type="text" value="${escapeHtml(email || 'Not registered')}" readonly />
            </label>
            <button type="button" id="clear-session" class="secondary-button">Sign out / clear local session</button>
          </div>

          <div class="settings-card full-span">
            <div class="settings-label">About</div>
            <div class="about-block">
              <div class="about-title">XORVAI</div>
              <div class="about-version">Version 1.0</div>
              <p>Don’t validate it. Try to kill it.</p>
            </div>
          </div>
        </div>
      </section>
    `;

    document.getElementById('theme-select').addEventListener('change', (event) => {
      state.settings.theme = event.target.value;
      saveSettings(state.settings);
      applySettings();
    });

    document.getElementById('accent-select').addEventListener('change', (event) => {
      state.settings.accent = event.target.value;
      saveSettings(state.settings);
      applySettings();
    });

    document.getElementById('motion-toggle').addEventListener('change', (event) => {
      state.settings.reducedMotion = event.target.checked;
      saveSettings(state.settings);
      applySettings();
    });

    document.getElementById('compact-toggle').addEventListener('change', (event) => {
      state.settings.compactMode = event.target.checked;
      saveSettings(state.settings);
      applySettings();
    });

    document.getElementById('clear-session').addEventListener('click', () => {
      localStorage.removeItem(STORAGE_KEYS.email);
      localStorage.removeItem(STORAGE_KEYS.analysis);
      localStorage.removeItem(STORAGE_KEYS.reports);
      localStorage.removeItem(STORAGE_KEYS.archive);
      state.email = '';
      state.route = '/';
      render();
    });

    setBadge('READY', 'neutral');
    return;
  }

  if (route === '/app/reports') {
    dashboardContent.innerHTML = `
      <section class="section-panel">
        <div class="section-header">
          <p class="eyebrow">REPORTS</p>
          <h2>Previous verdicts.</h2>
        </div>
        ${renderReportsList()}
      </section>
    `;
    setBadge('REPORTS', 'neutral');
    return;
  }

  if (route === '/app/archive') {
    dashboardContent.innerHTML = `
      <section class="section-panel">
        <div class="section-header">
          <p class="eyebrow">ARCHIVE</p>
          <h2>Killed hypotheses.</h2>
        </div>
        ${renderArchiveList()}
      </section>
    `;
    setBadge('ARCHIVE', 'neutral');
    return;
  }

  if (route === '/app/analysis') {
    if (!analysisCache) {
      dashboardContent.innerHTML = `
        <section class="section-panel">
          <div class="section-header">
            <p class="eyebrow">ANALYSIS</p>
            <h2>No investigation yet.</h2>
          </div>
          ${renderEmptyState('analysis')}
        </section>
      `;
      const startButton = document.querySelector('.empty-action');
      if (startButton) startButton.addEventListener('click', () => { state.route = '/app'; render(); });
      setBadge('ANALYSIS', 'neutral');
      return;
    }

    dashboardContent.innerHTML = `
      <section class="section-panel">
        <div class="section-header">
          <p class="eyebrow">ANALYSIS</p>
          <h2>Current investigation.</h2>
        </div>
        <div id="report-content" class="analysis-report"></div>
      </section>
    `;
    const reportContentNode = document.getElementById('report-content');
    if (reportContentNode) {
      reportContentNode.innerHTML = renderReportMarkup(analysisCache);
    }
    setBadge('ANALYSIS', 'neutral');
    return;
  }

  dashboardContent.innerHTML = `
    <section class="hero-panel">
      <div class="hero-copy">
        <div class="hero-line">DON’T VALIDATE IT.</div>
        <div class="hero-line accent">TRY TO KILL IT.</div>
        <p>XORVAI is an adversarial startup research agent that tries to disprove your startup before the market does — then finds what this specific team could uniquely build if the thesis survives.</p>
      </div>
      <aside class="hero-quote">
        <div class="quote-meta">REAL RESEARCH.<br />REAL EVIDENCE.<br />NO BIAS.</div>
        <div class="quote-text">“The goal isn’t to find reasons to build.<br />It’s to find reasons not to.”</div>
        <div class="quote-source">— XORVAI</div>
      </aside>
    </section>

    <section id="input-screen" class="panel briefing-panel" aria-live="polite">
      <div class="briefing-header">
        <div class="briefing-topline">
          <span>WHAT ARE YOU BUILDING?</span>
          <span class="tag">IDEA → ANALYSIS</span>
        </div>
      </div>

      <form id="startup-form" class="brief-form">
        <div class="field field-primary">
          <textarea id="idea" rows="4" placeholder="Describe the startup, thesis, or idea you want XORVAI to attack..."></textarea>
        </div>

        <div class="field-grid">
          <div class="field">
            <label for="description">Startup context</label>
            <textarea id="description" rows="3" placeholder="Customer, workflow, constraints, urgency, and market lens."></textarea>
          </div>

          <div class="field">
            <label for="founderInfo">Founder / team</label>
            <textarea id="founderInfo" rows="3" placeholder="Who is involved, what did they build, and what do they know?"></textarea>
          </div>

          <div class="field">
            <label for="teamUrls">Team URLs</label>
            <input id="teamUrls" type="text" placeholder="https://github.com/..." />
          </div>

          <div class="field">
            <label for="startupUrl">Website</label>
            <input id="startupUrl" type="url" placeholder="https://example.com" />
          </div>

          <div class="field">
            <label for="competitorUrls">Competitors</label>
            <input id="competitorUrls" type="text" placeholder="https://competitor.com" />
          </div>

          <div class="field">
            <label for="customerProblem">Customer pain</label>
            <textarea id="customerProblem" rows="3" placeholder="Who feels the pain, how do they solve it today, and why does it cost them?"></textarea>
          </div>

          <div class="field field-wide">
            <label for="context">Additional context</label>
            <textarea id="context" rows="3" placeholder="Anything else that matters: market, geography, distribution, launch angle, prior signals."></textarea>
          </div>
        </div>

        <div class="action-row">
          <div class="microcopy">A founder brief is not a pitch deck. It is a live kill-test.</div>
          <button type="submit" class="primary-button">ATTACK →</button>
        </div>
      </form>
    </section>

    <section class="pipeline-section">
      <div class="section-eyebrow">THE XORVAI PROCESS</div>
      <div class="pipeline-strip" aria-label="Process pipeline">
        <span class="step"><b>01</b> THESIS</span>
        <span class="step"><b>02</b> ASSUMPTIONS</span>
        <span class="step"><b>03</b> RESEARCH</span>
        <span class="step"><b>04</b> EVIDENCE</span>
        <span class="step"><b>05</b> CONTRADICTIONS</span>
        <span class="step"><b>06</b> TEAM</span>
        <span class="step"><b>07</b> TEAM × STARTUP</span>
        <span class="step"><b>08</b> COOK</span>
        <span class="step"><b>09</b> JUDGE</span>
        <span class="step"><b>10</b> REPORT</span>
      </div>
    </section>

    <section id="analysis-screen" class="panel research-panel hidden" aria-live="polite">
      <div class="research-header">
        <p class="eyebrow">LIVE INVESTIGATION</p>
        <h2 id="analysis-stage-name">INITIALIZING</h2>
      </div>
      <div class="progress-rail" id="progress-rail"></div>
      <ul class="stage-log" id="stage-log"></ul>
    </section>

    <section id="report-screen" class="report-panel hidden">
      <div class="report-header">
        <p class="eyebrow">STARTUP KILL TEST</p>
        <h2>Research memo</h2>
      </div>
      <div id="report-content"></div>
    </section>

    <section id="error-state" class="panel error-panel hidden" aria-live="assertive"></section>
  `;

  const form = document.getElementById('startup-form');
  if (form) form.addEventListener('submit', submitAnalysis);
  setBadge('READY', 'neutral');
}

function renderReportMarkup(report) {
  if (!report) return '<div class="empty-state">No analysis available.</div>';
  const thesis = report.thesis || {};
  const verdict = report.verdict || {};
  const buildCase = report.buildCase || {};
  const killCase = report.killCase || {};
  const judge = report.judge || {};
  const evidence = Array.isArray(report.evidence) ? report.evidence : [];
  const contradictions = Array.isArray(report.contradictions) ? report.contradictions : [];
  const unknowns = Array.isArray(report.unknowns) ? report.unknowns : [];
  const teamFit = Array.isArray(report.teamFit) ? report.teamFit : [];
  const opportunities = Array.isArray(report.cook?.opportunities) ? report.cook.opportunities : [];

  return `
    <section class="report-section">
      <h3>VERDICT</h3>
      <div class="report-body">
        <div class="verdict-shell">
          <div class="verdict-badge ${String(verdict.verdict || 'REWORK').toLowerCase()}">${escapeHtml(String(verdict.verdict || 'REWORK').toUpperCase())}</div>
          <div class="report-block">${escapeHtml(verdict.reasoning || judge.reasoning || 'No verdict reasoning available.')}</div>
        </div>
      </div>
    </section>
    <section class="report-section">
      <h3>THESIS</h3>
      <div class="report-body">
        <div class="report-block"><strong>Idea:</strong> ${escapeHtml(thesis.idea || 'Unknown')}</div>
        <div class="report-block">${escapeHtml(thesis.thesis || 'No thesis generated yet.')}</div>
      </div>
    </section>
    <section class="report-section">
      <h3>EVIDENCE</h3>
      <div class="report-body">${renderEvidence(evidence)}</div>
    </section>
    <section class="report-section">
      <h3>CONTRADICTIONS</h3>
      <div class="report-body">${renderContradictions(contradictions)}</div>
    </section>
    <section class="report-section">
      <h3>TEAM × STARTUP</h3>
      <div class="report-body">${renderTeamFit(teamFit)}</div>
    </section>
    <section class="report-section">
      <h3>WHAT COULD THEY COOK?</h3>
      <div class="report-body">${renderCook(opportunities)}</div>
    </section>
    <section class="report-section">
      <h3>BUILD CASE</h3>
      <div class="report-body">
        <div class="report-block"><strong>Strongest reasons:</strong> ${escapeHtml((buildCase.strongest_reasons || []).join(' • ') || 'No build case yet.')}</div>
        ${renderValueList(buildCase.supporting_evidence || [])}
      </div>
    </section>
    <section class="report-section">
      <h3>KILL CASE</h3>
      <div class="report-body">
        <div class="report-block">${escapeHtml(killCase.reasoning || 'No kill case generated yet.')}</div>
        ${renderValueList(killCase.kill_conditions || [])}
      </div>
    </section>
    <section class="report-section">
      <h3>UNKNOWN</h3>
      <div class="report-body">${renderValueList(unknowns.map((item) => item.item || item.reason || 'Unknown'))}</div>
    </section>
  `;
}

function registerNavigation() {
  document.addEventListener('click', (event) => {
    const navButton = event.target.closest('[data-route]');
    if (navButton) {
      const nextRoute = navButton.getAttribute('data-route');
      if (nextRoute) {
        state.route = nextRoute;
        window.history.pushState({}, '', nextRoute);
        render();
      }
    }

    const emptyStart = event.target.closest('.empty-action');
    if (emptyStart) {
      state.route = '/app';
      window.history.pushState({}, '', '/app');
      render();
    }

    const reportAction = event.target.closest('[data-report-index]');
    if (reportAction) {
      const index = Number(reportAction.getAttribute('data-report-index'));
      const reports = JSON.parse(localStorage.getItem(STORAGE_KEYS.reports) || '[]');
      const report = reports[index];
      if (report) {
        const reportWindow = window.open('', '_blank');
        if (reportWindow) {
          reportWindow.document.write(`<html><head><title>XORVAI Report</title><style>body{font-family:Segoe UI,sans-serif;background:#090b0d;color:#f0ebe2;padding:32px;line-height:1.7}h1{font-size:2rem;margin-bottom:16px}pre{white-space:pre-wrap}</style></head><body><h1>${escapeHtml(report.title || 'XORVAI Report')}</h1><pre>${escapeHtml(JSON.stringify(report.data || report, null, 2))}</pre></body></html>`);
          reportWindow.document.close();
        }
      }
    }

    const archiveAction = event.target.closest('[data-archive-index]');
    if (archiveAction) {
      const index = Number(archiveAction.getAttribute('data-archive-index'));
      const archive = JSON.parse(localStorage.getItem(STORAGE_KEYS.archive) || '[]');
      const item = archive[index];
      if (item) {
        const reportWindow = window.open('', '_blank');
        if (reportWindow) {
          reportWindow.document.write(`<html><head><title>XORVAI Archive</title><style>body{font-family:Segoe UI,sans-serif;background:#090b0d;color:#f0ebe2;padding:32px;line-height:1.7}h1{font-size:2rem;margin-bottom:16px}pre{white-space:pre-wrap}</style></head><body><h1>${escapeHtml(item.title || 'XORVAI Archive')}</h1><pre>${escapeHtml(JSON.stringify(item.data || item, null, 2))}</pre></body></html>`);
          reportWindow.document.close();
        }
      }
    }
  });
}

function render() {
  const currentPath = window.location.pathname || '/';
  if (currentPath === '/admin') {
    renderAdmin();
    return;
  }

  if (!localStorage.getItem(STORAGE_KEYS.email)) {
    state.route = '/';
    renderEntryPage();
    return;
  }

  const nextRoute = currentPath.startsWith('/app') ? currentPath : '/app';
  state.route = nextRoute;
  renderDashboard();
}

function init() {
  applySettings();
  registerNavigation();
  const entryEmail = localStorage.getItem(STORAGE_KEYS.email);
  if (entryEmail) {
    state.email = entryEmail;
  }
  render();
}

window.addEventListener('popstate', () => render());
window.addEventListener('DOMContentLoaded', init);

window.XORVAI = {
  saveResult(report) {
    const trimmedTitle = String(report?.thesis?.idea || 'XORVAI research').slice(0, 80);
    const reports = JSON.parse(localStorage.getItem(STORAGE_KEYS.reports) || '[]');
    reports.unshift({ title: trimmedTitle, date: new Date().toISOString(), data: report, verdict: report?.verdict?.verdict || 'REWORK' });
    localStorage.setItem(STORAGE_KEYS.reports, JSON.stringify(reports.slice(0, 10)));
    if (String(report?.verdict?.verdict || '').toUpperCase() === 'KILL') {
      const archive = JSON.parse(localStorage.getItem(STORAGE_KEYS.archive) || '[]');
      archive.unshift({ title: trimmedTitle, date: new Date().toISOString(), data: report, verdict: 'KILL' });
      localStorage.setItem(STORAGE_KEYS.archive, JSON.stringify(archive.slice(0, 20)));
    }
  },
};

