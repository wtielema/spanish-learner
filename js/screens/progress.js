import { DB } from '../db.js';

const PATTERN_LABELS = {
  'regular-ar': 'Regular -AR',
  'regular-er': 'Regular -ER',
  'regular-ir': 'Regular -IR',
  'stem-e-ie': 'Stem e>ie',
  'stem-o-ue': 'Stem o>ue',
  'stem-e-i': 'Stem e>i',
  'yo-irreg': 'Yo-irreg',
  'irregular': 'Irregular',
};

export async function renderProgress(app, router) {
  const db = new DB();
  await db.init();

  const [nouns, verbs, preps] = await Promise.all([
    fetch('data/nouns.json').then(r => r.json()),
    fetch('data/verbs.json').then(r => r.json()),
    fetch('data/prepositions.json').then(r => r.json()).catch(() => []),
  ]);

  const allProgress = await db.getAllProgress();
  const progressMap = Object.fromEntries(allProgress.map(p => [p.cardId, p]));

  const allVerbProgress = await db.getAllVerbProgress();
  const verbProgressMap = Object.fromEntries(allVerbProgress.map(p => [p.verbId, p]));

  // Build noun mastery data
  const nounData = nouns.map(n => {
    const cardId = `${n.id}-es`;
    const p = progressMap[cardId];
    let mastery = 0;
    let status = 'new';
    if (p && p.repetitions > 0) {
      // Convert ease factor to 0-100 mastery scale
      mastery = Math.min(100, Math.round(((p.easeFactor - 1.3) / (2.5 - 1.3)) * 50 + (p.repetitions >= 3 ? 50 : p.repetitions * 15)));
      status = mastery >= 80 ? 'mastered' : 'learning';
    }
    return { ...n, type: 'noun', mastery, status };
  });

  // Build verb mastery data
  const verbData = verbs.map(v => {
    const vp = verbProgressMap[v.id];
    let mastery = 0;
    let status = 'new';
    if (vp) {
      mastery = Math.round((vp.mastery || 0) * 100);
      status = mastery >= 60 ? 'mastered' : mastery > 0 ? 'learning' : 'new';
    }
    return { ...v, type: 'verb', mastery, status, tenseMastery: vp?.tenseMastery };
  });

  // Build preposition mastery data
  const prepData = preps.map(p => {
    const meaningId = `${p.id}-meaning`;
    const prog = progressMap[meaningId];
    let mastery = 0;
    let status = 'new';
    if (prog && prog.repetitions > 0) {
      mastery = Math.min(100, Math.round(((prog.easeFactor - 1.3) / (2.5 - 1.3)) * 50 + (prog.repetitions >= 3 ? 50 : prog.repetitions * 15)));
      status = mastery >= 80 ? 'mastered' : 'learning';
    }
    return { ...p, type: 'preposition', mastery, status, english: p.primaryMeaning };
  });

  const prepStats = {
    total: prepData.length,
    mastered: prepData.filter(p => p.status === 'mastered').length,
    learning: prepData.filter(p => p.status === 'learning').length,
    new: prepData.filter(p => p.status === 'new').length,
    avgMastery: prepData.length > 0 ? Math.round(prepData.reduce((s, p) => s + p.mastery, 0) / prepData.length) : 0,
  };

  const allWords = [...nounData, ...verbData, ...prepData];

  // Stats
  const nounStats = {
    total: nounData.length,
    mastered: nounData.filter(n => n.status === 'mastered').length,
    learning: nounData.filter(n => n.status === 'learning').length,
    new: nounData.filter(n => n.status === 'new').length,
    avgMastery: nounData.length > 0 ? Math.round(nounData.reduce((s, n) => s + n.mastery, 0) / nounData.length) : 0,
  };

  const verbStats = {
    total: verbData.length,
    mastered: verbData.filter(v => v.status === 'mastered').length,
    learning: verbData.filter(v => v.status === 'learning').length,
    new: verbData.filter(v => v.status === 'new').length,
    avgMastery: verbData.length > 0 ? Math.round(verbData.reduce((s, v) => s + v.mastery, 0) / verbData.length) : 0,
  };

  let currentView = 'overview'; // overview | nouns | verbs | prepositions
  let sortBy = 'mastery-asc'; // mastery-asc | mastery-desc | alpha

  function renderView() {
    if (currentView === 'overview') renderOverview();
    else renderWordList(currentView);
  }

  function renderOverview() {
    app.innerHTML = `
      <div class="progress-screen">
        <div class="browse-header">
          <button class="practice-close" id="btn-back">&larr;</button>
          <h2>Progress Overview</h2>
        </div>

        <div class="progress-summary-card">
          <h3 class="progress-card-title">Vocabulary</h3>
          <div class="progress-ring-row">
            <div class="progress-ring-container">
              <svg class="progress-ring" viewBox="0 0 80 80">
                <circle class="progress-ring-bg" cx="40" cy="40" r="34"/>
                <circle class="progress-ring-fill" cx="40" cy="40" r="34"
                  style="stroke-dasharray: ${2 * Math.PI * 34}; stroke-dashoffset: ${2 * Math.PI * 34 * (1 - nounStats.avgMastery / 100)}"/>
              </svg>
              <span class="progress-ring-text">${nounStats.avgMastery}%</span>
            </div>
            <div class="progress-breakdown">
              <div class="progress-stat-row"><strong>${nounStats.mastered + nounStats.learning}</strong> learned</div>
              <div class="progress-stat-row"><span class="dot-mastered"></span> Mastered: <strong>${nounStats.mastered}</strong></div>
              <div class="progress-stat-row"><span class="dot-learning"></span> Learning: <strong>${nounStats.learning}</strong></div>
              <div class="progress-stat-row"><span class="dot-new"></span> Not started: <strong>${nounStats.new}</strong></div>
            </div>
          </div>
          <div style="display: flex; gap: 8px; margin-top: 8px;">
            <button class="btn-secondary progress-detail-btn" data-view="nouns" style="flex:1;">View Nouns</button>
            <button class="btn-secondary progress-detail-btn" data-view="prepositions" style="flex:1;">View Prepositions</button>
          </div>
          ${prepStats.total > 0 ? `
          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08);">
            <div class="progress-stat-row" style="justify-content: space-between;">
              <span>Prepositions</span>
              <strong>${prepStats.mastered + prepStats.learning} / ${prepStats.total}</strong>
            </div>
          </div>` : ''}
        </div>

        <div class="progress-summary-card">
          <h3 class="progress-card-title">Verbs</h3>
          <div class="progress-ring-row">
            <div class="progress-ring-container">
              <svg class="progress-ring" viewBox="0 0 80 80">
                <circle class="progress-ring-bg" cx="40" cy="40" r="34"/>
                <circle class="progress-ring-fill" cx="40" cy="40" r="34"
                  style="stroke-dasharray: ${2 * Math.PI * 34}; stroke-dashoffset: ${2 * Math.PI * 34 * (1 - verbStats.avgMastery / 100)}"/>
              </svg>
              <span class="progress-ring-text">${verbStats.avgMastery}%</span>
            </div>
            <div class="progress-breakdown">
              <div class="progress-stat-row"><span class="dot-mastered"></span> Mastered: <strong>${verbStats.mastered}</strong></div>
              <div class="progress-stat-row"><span class="dot-learning"></span> Learning: <strong>${verbStats.learning}</strong></div>
              <div class="progress-stat-row"><span class="dot-new"></span> Not started: <strong>${verbStats.new}</strong></div>
            </div>
          </div>
          <button class="btn-secondary progress-detail-btn" data-view="verbs">View All Verbs</button>
        </div>

        <div class="progress-summary-card">
          <h3 class="progress-card-title">Weakest Words</h3>
          <div class="progress-weak-list">
            ${allWords
              .filter(w => w.status === 'learning')
              .sort((a, b) => a.mastery - b.mastery)
              .slice(0, 8)
              .map(w => `
                <div class="progress-weak-item">
                  <div class="progress-weak-info">
                    <span class="progress-weak-word">${w.spanish}</span>
                    <span class="progress-weak-english">${w.english}</span>
                  </div>
                  <div class="progress-bar-small">
                    <div class="progress-bar-fill" style="width: ${w.mastery}%; background: ${barColor(w.mastery)}"></div>
                  </div>
                  <span class="progress-weak-pct">${w.mastery}%</span>
                </div>
              `).join('') || '<p class="text-secondary" style="padding: 8px 0;">Start practicing to see your weakest words here.</p>'}
          </div>
        </div>

        <div style="height: 80px;"></div>
        <nav class="bottom-nav">
          <button class="nav-btn" data-route="/">Home</button>
          <button class="nav-btn" data-route="/browse">Browse</button>
          <button class="nav-btn" data-route="/reference">Reference</button>
          <button class="nav-btn active" data-route="/progress">Progress</button>
          <button class="nav-btn" data-route="/settings">Settings</button>
        </nav>
      </div>
    `;

    document.getElementById('btn-back').addEventListener('click', () => router.navigate('/'));
    document.querySelectorAll('.progress-detail-btn').forEach(btn => {
      btn.addEventListener('click', () => { currentView = btn.dataset.view; renderView(); });
    });
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => router.navigate(btn.dataset.route));
    });
  }

  function renderWordList(type) {
    const words = type === 'nouns' ? nounData : type === 'prepositions' ? prepData : verbData;
    const sorted = sortWords(words, sortBy);

    app.innerHTML = `
      <div class="progress-screen">
        <div class="browse-header">
          <button class="practice-close" id="btn-back">&larr;</button>
          <h2>${type === 'nouns' ? 'Noun' : type === 'prepositions' ? 'Preposition' : 'Verb'} Mastery</h2>
        </div>

        <div class="progress-sort-bar">
          <button class="progress-sort-btn ${sortBy === 'mastery-asc' ? 'active' : ''}" data-sort="mastery-asc">Weakest First</button>
          <button class="progress-sort-btn ${sortBy === 'mastery-desc' ? 'active' : ''}" data-sort="mastery-desc">Strongest First</button>
          <button class="progress-sort-btn ${sortBy === 'alpha' ? 'active' : ''}" data-sort="alpha">A-Z</button>
        </div>

        <div class="progress-word-list">
          ${sorted.map(w => `
            <div class="progress-word-row">
              <span class="mastery-dot mastery-${w.status}"></span>
              <div class="progress-word-info">
                <span class="progress-word-name">${w.spanish}</span>
                <span class="progress-word-meaning">${w.english}${w.pattern ? ' &middot; ' + (PATTERN_LABELS[w.pattern] || w.pattern) : ''}</span>
                ${w.tenseMastery ? `<div class="progress-tense-row">
                  <span class="progress-tense-chip" style="background: ${barColor(Math.round((w.tenseMastery.present || 0) * 100))}20; color: ${barColor(Math.round((w.tenseMastery.present || 0) * 100))}">Pres ${Math.round((w.tenseMastery.present || 0) * 100)}%</span>
                  <span class="progress-tense-chip" style="background: ${barColor(Math.round((w.tenseMastery.preterite || 0) * 100))}20; color: ${barColor(Math.round((w.tenseMastery.preterite || 0) * 100))}">Pret ${Math.round((w.tenseMastery.preterite || 0) * 100)}%</span>
                  <span class="progress-tense-chip" style="background: ${barColor(Math.round((w.tenseMastery.future || 0) * 100))}20; color: ${barColor(Math.round((w.tenseMastery.future || 0) * 100))}">Fut ${Math.round((w.tenseMastery.future || 0) * 100)}%</span>
                </div>` : ''}
              </div>
              <div class="progress-word-bar-area">
                <div class="progress-bar-small">
                  <div class="progress-bar-fill" style="width: ${w.mastery}%; background: ${barColor(w.mastery)}"></div>
                </div>
                <span class="progress-word-pct">${w.mastery}%</span>
              </div>
            </div>
          `).join('')}
        </div>

        <div style="height: 80px;"></div>
        <nav class="bottom-nav">
          <button class="nav-btn" data-route="/">Home</button>
          <button class="nav-btn" data-route="/browse">Browse</button>
          <button class="nav-btn" data-route="/reference">Reference</button>
          <button class="nav-btn active" data-route="/progress">Progress</button>
          <button class="nav-btn" data-route="/settings">Settings</button>
        </nav>
      </div>
    `;

    document.getElementById('btn-back').addEventListener('click', () => {
      currentView = 'overview';
      renderView();
    });

    document.querySelectorAll('.progress-sort-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        sortBy = btn.dataset.sort;
        renderWordList(type);
      });
    });

    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => router.navigate(btn.dataset.route));
    });
  }

  function sortWords(words, sort) {
    const arr = [...words];
    if (sort === 'mastery-asc') return arr.sort((a, b) => a.mastery - b.mastery || a.spanish.localeCompare(b.spanish));
    if (sort === 'mastery-desc') return arr.sort((a, b) => b.mastery - a.mastery || a.spanish.localeCompare(b.spanish));
    return arr.sort((a, b) => a.spanish.localeCompare(b.spanish));
  }

  function barColor(pct) {
    if (pct >= 60) return '#4ecca3';
    if (pct > 0) return '#f0c040';
    return '#555';
  }

  renderOverview();
}
