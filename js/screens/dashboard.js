import { DB } from '../db.js';

export async function renderDashboard(app, router) {
  const db = new DB();
  await db.init();

  const allProgress = await db.getAllProgress();
  const today = new Date().toISOString().split('T')[0];

  // Vocabulary stats — use only -es cards to match progress screen counting
  const nounEsCards = allProgress.filter(p => p.cardId && p.cardId.startsWith('n') && p.cardId.endsWith('-es'));
  const totalNouns = 1000;
  const nounLearned = nounEsCards.filter(p => p.repetitions > 0).length;
  const nounMastered = nounEsCards.filter(p => {
    if (!p.repetitions) return false;
    const m = Math.min(100, Math.round(((p.easeFactor - 1.3) / (2.5 - 1.3)) * 50 + (p.repetitions >= 3 ? 50 : p.repetitions * 15)));
    return m >= 80;
  }).length;
  const nounDue = nounEsCards.filter(p => p.nextReview <= today).length;

  // Preposition stats — only count -meaning cards to match progress screen
  const prepMeaningCards = allProgress.filter(p => p.cardId && p.cardId.startsWith('p') && p.cardId.endsWith('-meaning'));
  const prepLearned = prepMeaningCards.filter(p => p.repetitions > 0).length;
  const totalPreps = 23;
  const prepDue = prepMeaningCards.filter(p => p.nextReview <= today).length;

  // Combined vocabulary numbers for header
  const totalVocabLearned = nounLearned + prepLearned;
  const totalVocabDue = nounDue + prepDue;
  const vocabPercent = Math.round((nounLearned / totalNouns) * 100);
  const prepPercent = totalPreps > 0 ? Math.round((prepLearned / totalPreps) * 100) : 0;

  // Verb training data
  const allVerbProgress = await db.getAllVerbProgress();
  const verbProgressMap = Object.fromEntries(allVerbProgress.map(p => [p.verbId, p]));

  let verbs = [];
  try {
    verbs = await fetch('data/verbs.json').then(r => r.json());
  } catch (e) { /* offline fallback */ }

  const tierData = {};
  const TIER_UNLOCK_THRESHOLD = 0.6;

  for (const tier of [1, 2, 3]) {
    const tierVerbs = verbs.filter(v => v.tier === tier);
    const practiced = tierVerbs.filter(v => verbProgressMap[v.id]);
    const mastered = tierVerbs.filter(v => {
      const p = verbProgressMap[v.id];
      return p && p.mastery >= TIER_UNLOCK_THRESHOLD;
    }).length;
    const avgMastery = practiced.length > 0
      ? practiced.reduce((sum, v) => sum + (verbProgressMap[v.id].mastery || 0), 0) / tierVerbs.length
      : 0;
    tierData[tier] = {
      total: tierVerbs.length,
      practiced: practiced.length,
      mastered,
      percent: Math.round(avgMastery * 100),
    };
  }

  const tier2Unlocked = tierData[1].total > 0 && tierData[1].mastered / tierData[1].total >= TIER_UNLOCK_THRESHOLD;
  const tier3Unlocked = tier2Unlocked && tierData[2].total > 0 && tierData[2].mastered / tierData[2].total >= TIER_UNLOCK_THRESHOLD;

  const verbsDue = verbs.filter(v => {
    const p = verbProgressMap[v.id];
    return p && (!p.nextReview || p.nextReview <= today);
  }).length;

  const tierNames = { 1: 'Regular', 2: 'Stem-Changing', 3: 'Irregular' };

  app.innerHTML = `
    <div class="dashboard">
      <h1 class="dashboard-title">Spanish Learner</h1>

      <div class="speed-round-section">
        <button class="btn-speed-launch" id="btn-speed-round">&#9889; Speed Round</button>
      </div>

      <div class="dash-section">
        <div class="dash-section-header" id="vocab-toggle">
          <h2 class="dash-section-title">Vocabulary</h2>
          <span class="dash-section-summary">${totalVocabLearned} learned${totalVocabDue > 0 ? ` &middot; ${totalVocabDue} due` : ''}</span>
          <span class="dash-toggle-icon" id="vocab-toggle-icon">&#9654;</span>
        </div>
        <div class="dash-section-details collapsed" id="vocab-details">
          <div class="dash-progress-row">
            <div class="dash-progress-header">
              <span class="dash-progress-label">Words</span>
              <span class="dash-progress-pct">${vocabPercent}%</span>
            </div>
            <div class="dash-progress-bar">
              <div class="dash-progress-fill" style="width: ${vocabPercent}%"></div>
            </div>
            <span class="dash-progress-detail">${nounLearned} learned, ${nounMastered} mastered / ${totalNouns} words</span>
          </div>
          <div class="dash-progress-row" style="margin-top: 12px;">
            <div class="dash-progress-header">
              <span class="dash-progress-label">Prepositions</span>
              <span class="dash-progress-pct">${prepPercent}%</span>
            </div>
            <div class="dash-progress-bar">
              <div class="dash-progress-fill" style="width: ${prepPercent}%"></div>
            </div>
            <span class="dash-progress-detail">${prepLearned} / ${totalPreps} prepositions learned</span>
          </div>
          <div class="vocab-stats-row">
            <div class="vocab-stat">
              <span class="vocab-stat-value">${totalVocabDue}</span>
              <span class="vocab-stat-label">Due</span>
            </div>
            <div class="vocab-stat">
              <span class="vocab-stat-value">${nounMastered}</span>
              <span class="vocab-stat-label">Mastered</span>
            </div>
            <div class="vocab-stat">
              <span class="vocab-stat-value">${totalNouns - nounLearned}</span>
              <span class="vocab-stat-label">Unseen</span>
            </div>
          </div>
        </div>
        <div class="dash-section-actions">
          <button class="btn-primary" id="btn-review">Review Words${nounDue > 0 ? ` (${nounDue})` : ''}</button>
          <button class="btn-secondary" id="btn-learn">Learn New Words</button>
          <button class="btn-primary" id="btn-prep-review">Review Prepositions${prepDue > 0 ? ` (${prepDue})` : ''}</button>
          <button class="btn-secondary" id="btn-prep-learn">Learn Prepositions</button>
        </div>
      </div>

      <div class="dash-section">
        <div class="dash-section-header" id="verb-toggle">
          <h2 class="dash-section-title">Verb Training</h2>
          <span class="dash-section-summary">${allVerbProgress.length} practiced${verbsDue > 0 ? ` &middot; ${verbsDue} due` : ''}</span>
          <span class="dash-toggle-icon" id="verb-toggle-icon">&#9654;</span>
        </div>
        <div class="dash-section-details collapsed" id="verb-details">
          <div class="tier-progress-list">
            ${[1, 2, 3].map(tier => {
              const data = tierData[tier];
              const unlocked = tier === 1 || (tier === 2 && tier2Unlocked) || (tier === 3 && tier3Unlocked);
              return `
                <div class="tier-progress-item ${unlocked ? '' : 'tier-locked'}">
                  <div class="dash-progress-header">
                    <span class="dash-progress-label">${unlocked ? '' : '<span class="tier-lock-icon">&#128274;</span> '}${tierNames[tier]}</span>
                    <span class="dash-progress-pct">${data.percent}%</span>
                  </div>
                  <div class="dash-progress-bar">
                    <div class="dash-progress-fill" style="width: ${data.percent}%"></div>
                  </div>
                  <span class="dash-progress-detail">${data.practiced} practiced, ${data.mastered} mastered / ${data.total} verbs</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
        <div class="dash-section-actions">
          <button class="btn-primary" id="btn-verb-review">Review Verbs${verbsDue > 0 ? ` (${verbsDue})` : ''}</button>
          <button class="btn-secondary" id="btn-verb-learn">Train Verbs</button>
          <button class="btn-paradigm-launch" id="btn-paradigm-drill">&#128221; Paradigm Drill</button>
        </div>
      </div>

      <div style="margin-bottom: 80px;"></div>
      <nav class="bottom-nav">
        <button class="nav-btn active" data-route="/">Home</button>
        <button class="nav-btn" data-route="/browse">Browse</button>
        <button class="nav-btn" data-route="/reference">Reference</button>
        <button class="nav-btn" data-route="/progress">Progress</button>
        <button class="nav-btn" data-route="/settings">Settings</button>
      </nav>
    </div>
  `;

  // Section toggles
  document.getElementById('vocab-toggle').addEventListener('click', () => {
    const details = document.getElementById('vocab-details');
    const icon = document.getElementById('vocab-toggle-icon');
    const collapsed = details.classList.toggle('collapsed');
    icon.innerHTML = collapsed ? '&#9654;' : '&#9660;';
  });

  document.getElementById('verb-toggle').addEventListener('click', () => {
    const details = document.getElementById('verb-details');
    const icon = document.getElementById('verb-toggle-icon');
    const collapsed = details.classList.toggle('collapsed');
    icon.innerHTML = collapsed ? '&#9654;' : '&#9660;';
  });

  // Navigation
  document.getElementById('btn-review').addEventListener('click', () => {
    router.navigate('/practice?mode=review');
  });

  document.getElementById('btn-learn').addEventListener('click', () => {
    router.navigate('/practice?mode=learn');
  });

  document.getElementById('btn-prep-review').addEventListener('click', () => {
    router.navigate('/practice?mode=prep-review');
  });

  document.getElementById('btn-prep-learn').addEventListener('click', () => {
    router.navigate('/practice?mode=prep-learn');
  });

  document.getElementById('btn-verb-learn').addEventListener('click', () => {
    router.navigate('/practice?mode=verb-learn');
  });

  document.getElementById('btn-verb-review').addEventListener('click', () => {
    router.navigate('/practice?mode=verb-review');
  });

  document.getElementById('btn-paradigm-drill').addEventListener('click', () => {
    router.navigate('/paradigm-drill');
  });

  document.getElementById('btn-speed-round').addEventListener('click', () => {
    router.navigate('/speed-round');
  });

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => router.navigate(btn.dataset.route));
  });
}
