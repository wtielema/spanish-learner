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

export async function renderBrowse(app, router) {
  const db = new DB();
  await db.init();

  const [nouns, verbs] = await Promise.all([
    fetch('data/nouns.json').then(r => r.json()),
    fetch('data/verbs.json').then(r => r.json()),
  ]);

  const allProgress = await db.getAllProgress();
  const progressMap = Object.fromEntries(allProgress.map(p => [p.cardId, p]));

  const allVerbProgress = await db.getAllVerbProgress();
  const verbProgressMap = Object.fromEntries(allVerbProgress.map(p => [p.verbId, p]));

  const allWords = [
    ...nouns.map(n => ({ ...n, type: 'noun' })),
    ...verbs.map(v => ({ ...v, type: 'verb' })),
  ];

  function getMastery(word) {
    const cardId = `${word.id}-es`;
    const p = progressMap[cardId];
    if (!p || p.repetitions === 0) return 'new';
    if (p.easeFactor >= 2.3 && p.repetitions >= 3) return 'mastered';
    return 'learning';
  }

  function getVerbMasteryLevel(word) {
    if (word.type !== 'verb') return null;
    const p = verbProgressMap[word.id];
    if (!p) return null;
    return Math.round(p.mastery * 100);
  }

  function renderList(filter = '') {
    const filtered = filter
      ? allWords.filter(w => w.spanish.includes(filter.toLowerCase()) || w.english.toLowerCase().includes(filter.toLowerCase()))
      : allWords;

    app.innerHTML = `
      <div class="browse">
        <div class="browse-header">
          <button class="practice-close" id="btn-back">&larr;</button>
          <h2>Browse Words</h2>
        </div>
        <input type="text" class="search-input" id="search" placeholder="Search words..." value="${filter}">
        <div class="word-count">${filtered.length} words</div>
        <ul class="word-list">
          ${filtered.slice(0, 100).map(w => {
            const mastery = getMastery(w);
            const patternLabel = w.pattern ? PATTERN_LABELS[w.pattern] || w.pattern : '';
            const verbMastery = getVerbMasteryLevel(w);
            return `
              <li class="word-item" data-id="${w.id}" data-type="${w.type}">
                <span class="mastery-dot mastery-${mastery}"></span>
                <div class="word-info">
                  <span class="word-spanish">${w.spanish}</span>
                  <span class="word-english">${w.english}</span>
                </div>
                ${patternLabel ? `<span class="pattern-badge">${patternLabel}</span>` : ''}
                <span class="word-type">${w.type === 'noun' ? (w.gender === 'm' ? 'el' : 'la') : 'verb'}</span>
              </li>
            `;
          }).join('')}
        </ul>
        ${filtered.length > 100 ? '<p class="text-secondary" style="text-align:center;padding:16px;">Use search to find more words...</p>' : ''}
        <nav class="bottom-nav">
          <button class="nav-btn" data-route="/">Home</button>
          <button class="nav-btn active" data-route="/browse">Browse</button>
          <button class="nav-btn" data-route="/reference">Reference</button>
          <button class="nav-btn" data-route="/progress">Progress</button>
          <button class="nav-btn" data-route="/settings">Settings</button>
        </nav>
      </div>
    `;

    document.getElementById('search').addEventListener('input', (e) => {
      renderList(e.target.value);
    });

    document.getElementById('btn-back').addEventListener('click', () => router.navigate('/'));

    document.querySelectorAll('.word-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        const type = item.dataset.type;
        const word = allWords.find(w => w.id === id);
        if (word) renderDetail(word, type, filter);
      });
    });

    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => router.navigate(btn.dataset.route));
    });

    const searchEl = document.getElementById('search');
    if (filter) {
      searchEl.focus();
      searchEl.setSelectionRange(filter.length, filter.length);
    }
  }

  function renderDetail(word, type, previousFilter) {
    const cardId = `${word.id}-es`;
    const progress = progressMap[cardId];
    const history = progress?.history?.slice(-5) || [];
    const verbProg = verbProgressMap[word.id];

    let detailHtml = `
      <div class="browse">
        <div class="browse-header">
          <button class="practice-close" id="btn-back">&larr;</button>
          <h2>${word.spanish}</h2>
        </div>
        <div class="detail-card">
          <div class="detail-row">
            <span class="detail-label">English</span>
            <span>${word.english}</span>
          </div>
    `;

    if (type === 'noun') {
      detailHtml += `
          <div class="detail-row">
            <span class="detail-label">Gender</span>
            <span>${word.gender === 'm' ? 'Masculine (el)' : 'Feminine (la)'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Plural</span>
            <span>${word.plural}</span>
          </div>
      `;
    }

    if (type === 'verb') {
      if (word.pattern) {
        detailHtml += `
          <div class="detail-row">
            <span class="detail-label">Pattern</span>
            <span class="pattern-badge-detail">${PATTERN_LABELS[word.pattern] || word.pattern}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Tier</span>
            <span>${word.tier === 1 ? 'Regular' : word.tier === 2 ? 'Stem-Changing' : 'Irregular'}</span>
          </div>
        `;
      }

      if (verbProg) {
        detailHtml += `
          <div class="detail-row">
            <span class="detail-label">Verb Mastery</span>
            <span class="mastery-value">${Math.round(verbProg.mastery * 100)}%</span>
          </div>
        `;
      }

      if (word.conjugations) {
        for (const tense of ['present', 'preterite', 'future']) {
          detailHtml += `
            <div class="detail-section">
              <h3>${tense.charAt(0).toUpperCase() + tense.slice(1)}</h3>
              <div class="conj-grid">
                ${Object.entries(word.conjugations[tense]).map(([person, form]) =>
                  `<span class="conj-person">${person}</span><span class="conj-form">${form}</span>`
                ).join('')}
              </div>
            </div>
          `;
        }
      }
    }

    if (history.length > 0) {
      detailHtml += `
        <div class="detail-section">
          <h3>Recent History</h3>
          ${history.map(h => `
            <div class="history-item">
              <span>${h.date}</span>
              <span class="rating-${h.rating}">${h.rating}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    detailHtml += `</div></div>`;
    app.innerHTML = detailHtml;

    document.getElementById('btn-back').addEventListener('click', () => renderList(previousFilter));
  }

  renderList();
}
