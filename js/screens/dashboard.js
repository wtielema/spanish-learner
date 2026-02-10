import { DB } from '../db.js';

export async function renderDashboard(app, router) {
  const db = new DB();
  await db.init();

  const allProgress = await db.getAllProgress();
  const today = new Date().toISOString().split('T')[0];

  const learned = allProgress.filter(p => p.repetitions > 0).length;
  const reviewedToday = allProgress.filter(p =>
    p.history.some(h => h.date === today)
  ).length;
  const dueNow = allProgress.filter(p => p.nextReview <= today).length;

  const totalAnswers = allProgress.reduce((sum, p) => sum + p.history.length, 0);
  const correctAnswers = allProgress.reduce((sum, p) =>
    sum + p.history.filter(h => h.rating === 'good' || h.rating === 'easy').length, 0
  );
  const accuracy = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;

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
    // Show average mastery of all practiced verbs in tier (more encouraging)
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
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-value">${learned}</span>
          <span class="stat-label">Words Learned</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">${reviewedToday}</span>
          <span class="stat-label">Reviewed Today</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">${dueNow}</span>
          <span class="stat-label">Due for Review</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">${accuracy}%</span>
          <span class="stat-label">Accuracy</span>
        </div>
      </div>

      <div class="verb-training-section">
        <div class="verb-section-header" id="verb-toggle">
          <h2 class="verb-section-title">Verb Training</h2>
          <span class="verb-section-summary">${allVerbProgress.length} practiced${verbsDue > 0 ? ` &middot; ${verbsDue} due` : ''}</span>
          <span class="verb-toggle-icon" id="verb-toggle-icon">&#9654;</span>
        </div>
        <div class="verb-section-details collapsed" id="verb-details">
          <div class="tier-progress-list">
            ${[1, 2, 3].map(tier => {
              const data = tierData[tier];
              const unlocked = tier === 1 || (tier === 2 && tier2Unlocked) || (tier === 3 && tier3Unlocked);
              return `
                <div class="tier-progress-item ${unlocked ? '' : 'tier-locked'}">
                  <div class="tier-header">
                    <span class="tier-name">${unlocked ? '' : '<span class="tier-lock-icon">&#128274;</span> '}${tierNames[tier]}</span>
                    <span class="tier-percent">${data.percent}%</span>
                  </div>
                  <div class="tier-bar">
                    <div class="tier-bar-fill" style="width: ${data.percent}%"></div>
                  </div>
                  <span class="tier-detail">${data.practiced} practiced, ${data.mastered} mastered / ${data.total} verbs</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
        <div class="verb-training-actions">
          <button class="btn-primary" id="btn-verb-learn">Train Verbs</button>
          <button class="btn-secondary" id="btn-verb-review" style="margin-top: 8px;">Review Verbs${verbsDue > 0 ? ` (${verbsDue})` : ''}</button>
        </div>
      </div>

      <div class="speed-round-section">
        <button class="btn-speed-launch" id="btn-speed-round">&#9889; Speed Round</button>
      </div>

      <div class="dashboard-actions">
        <button class="btn-primary" id="btn-review">Start Review${dueNow > 0 ? ` (${dueNow})` : ''}</button>
        <button class="btn-secondary" id="btn-learn" style="margin-top: 12px;">Learn New Words</button>
      </div>
      <nav class="bottom-nav">
        <button class="nav-btn active" data-route="/">Home</button>
        <button class="nav-btn" data-route="/browse">Browse</button>
        <button class="nav-btn" data-route="/reference">Reference</button>
        <button class="nav-btn" data-route="/progress">Progress</button>
        <button class="nav-btn" data-route="/settings">Settings</button>
      </nav>
    </div>
  `;

  document.getElementById('verb-toggle').addEventListener('click', () => {
    const details = document.getElementById('verb-details');
    const icon = document.getElementById('verb-toggle-icon');
    const collapsed = details.classList.toggle('collapsed');
    icon.innerHTML = collapsed ? '&#9654;' : '&#9660;';
  });

  document.getElementById('btn-speed-round').addEventListener('click', () => {
    router.navigate('/speed-round');
  });

  document.getElementById('btn-review').addEventListener('click', () => {
    router.navigate('/practice?mode=review');
  });

  document.getElementById('btn-learn').addEventListener('click', () => {
    router.navigate('/practice?mode=learn');
  });

  document.getElementById('btn-verb-learn').addEventListener('click', () => {
    router.navigate('/practice?mode=verb-learn');
  });

  document.getElementById('btn-verb-review').addEventListener('click', () => {
    router.navigate('/practice?mode=verb-review');
  });

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => router.navigate(btn.dataset.route));
  });
}
