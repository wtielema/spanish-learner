import { DB } from '../db.js';
import { normalizeAccents } from '../cards.js';

const PERSONS = ['yo', 'tú', 'él', 'nosotros', 'vosotros', 'ellos'];
const TENSES = ['present', 'preterite', 'future'];
const PERSON_LABELS = {
  'yo': 'yo', 'tú': 'tú', 'él': 'él/ella',
  'nosotros': 'nosotros', 'vosotros': 'vosotros', 'ellos': 'ellos/ellas'
};
const TENSE_LABELS = { 'present': 'Present', 'preterite': 'Preterite', 'future': 'Future' };
const TIER_UNLOCK_THRESHOLD = 0.6;

export async function renderParadigmDrill(app, router) {
  const db = new DB();
  await db.init();

  let verbs = [];
  try { verbs = await fetch('data/verbs.json').then(r => r.json()); } catch (e) { /* offline */ }

  const allVerbProgress = await db.getAllVerbProgress();
  const verbProgressMap = Object.fromEntries(allVerbProgress.map(p => [p.verbId, p]));

  const params = new URLSearchParams(window.location.hash.split('?')[1]);
  const freePickVerbId = params.get('verbId');

  let state = {
    phase: 'select',
    drillItems: [],
    currentIndex: 0,
    results: [],
    preDrillMastery: {},
    focusedInput: null,
  };

  if (freePickVerbId) {
    renderFreePick();
  } else {
    renderGuidedSelect();
  }

  // --- Tier unlocking ---
  function getUnlockedTiers() {
    const tiers = [1];
    const tier1Verbs = verbs.filter(v => v.tier === 1);
    const tier1Mastered = tier1Verbs.filter(v => {
      const p = verbProgressMap[v.id];
      return p && p.mastery >= TIER_UNLOCK_THRESHOLD;
    }).length;

    if (tier1Verbs.length > 0 && tier1Mastered / tier1Verbs.length >= TIER_UNLOCK_THRESHOLD) {
      tiers.push(2);
      const tier2Verbs = verbs.filter(v => v.tier === 2);
      const tier2Mastered = tier2Verbs.filter(v => {
        const p = verbProgressMap[v.id];
        return p && p.mastery >= TIER_UNLOCK_THRESHOLD;
      }).length;
      if (tier2Verbs.length > 0 && tier2Mastered / tier2Verbs.length >= TIER_UNLOCK_THRESHOLD) {
        tiers.push(3);
      }
    }
    return tiers;
  }

  // --- Free-pick mode (from browse) ---
  function renderFreePick() {
    const verb = verbs.find(v => v.id === freePickVerbId);
    if (!verb) { router.navigate('/browse'); return; }

    state = { phase: 'select', drillItems: [], currentIndex: 0, results: [], preDrillMastery: {}, focusedInput: null };

    app.innerHTML = `
      <div class="speed-round">
        <div class="speed-header">
          <h2 class="speed-title">Paradigm Drill</h2>
          <button class="practice-close" id="pd-close">&times;</button>
        </div>
        <div class="pd-prompt-card">
          <div class="pd-verb-name">${verb.spanish}</div>
          <div class="pd-verb-meaning">${verb.english}</div>
        </div>
        <p class="speed-subtitle">Choose a tense to drill:</p>
        <div class="pd-tense-picker">
          <button class="btn-primary pd-tense-btn" data-tense="present">Present</button>
          <button class="btn-primary pd-tense-btn" data-tense="preterite">Preterite</button>
          <button class="btn-primary pd-tense-btn" data-tense="future">Future</button>
          <button class="btn-secondary pd-tense-btn" data-tense="all">All Tenses</button>
        </div>
      </div>
    `;

    document.getElementById('pd-close').addEventListener('click', () => router.navigate('/browse'));
    document.querySelectorAll('.pd-tense-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tense = btn.dataset.tense;
        if (tense === 'all') {
          state.drillItems = TENSES.map(t => ({ verb, tense: t }));
        } else {
          state.drillItems = [{ verb, tense }];
        }
        snapshotMastery();
        startDrilling();
      });
    });
  }

  // --- Guided mode ---
  function renderGuidedSelect() {
    state = { phase: 'select', drillItems: [], currentIndex: 0, results: [], preDrillMastery: {}, focusedInput: null };

    app.innerHTML = `
      <div class="speed-round">
        <div class="speed-header">
          <h2 class="speed-title">Paradigm Drill</h2>
          <button class="practice-close" id="pd-close">&times;</button>
        </div>
        <p class="speed-subtitle">Type all 6 conjugation forms for each verb+tense. Builds paradigm recall into muscle memory!</p>
        <button class="btn-primary" id="pd-start">Start Guided Drill</button>
      </div>
    `;

    document.getElementById('pd-close').addEventListener('click', () => router.navigate('/'));
    document.getElementById('pd-start').addEventListener('click', () => {
      buildGuidedDrill();
      snapshotMastery();
      startDrilling();
    });
  }

  function buildGuidedDrill() {
    const unlockedTiers = getUnlockedTiers();
    const available = verbs.filter(v => v.tier && unlockedTiers.includes(v.tier));
    const today = new Date().toISOString().split('T')[0];
    const items = [];

    // 1. Due for review (lowest mastery first)
    const dueVerbs = available
      .filter(v => { const p = verbProgressMap[v.id]; return p && (!p.nextReview || p.nextReview <= today); })
      .sort((a, b) => (verbProgressMap[a.id].mastery || 0) - (verbProgressMap[b.id].mastery || 0));

    for (const v of dueVerbs) {
      if (items.length >= 5) break;
      items.push({ verb: v, tense: pickWeakestTense(v) });
    }

    // 2. Pad with weakest practiced verbs
    if (items.length < 5) {
      const weakVerbs = available
        .filter(v => verbProgressMap[v.id] && !items.some(i => i.verb.id === v.id))
        .sort((a, b) => (verbProgressMap[a.id].mastery || 0) - (verbProgressMap[b.id].mastery || 0));
      for (const v of weakVerbs) {
        if (items.length >= 5) break;
        items.push({ verb: v, tense: pickWeakestTense(v) });
      }
    }

    // 3. Pad with new verbs from unlocked tiers
    if (items.length < 5) {
      const newVerbs = shuffle(available.filter(v => !verbProgressMap[v.id] && !items.some(i => i.verb.id === v.id)));
      for (const v of newVerbs) {
        if (items.length >= 5) break;
        items.push({ verb: v, tense: 'present' });
      }
    }

    state.drillItems = items;
  }

  function pickWeakestTense(verb) {
    const p = verbProgressMap[verb.id];
    if (!p || !p.tenseTouched) return 'present';

    // Prefer untouched tenses
    for (const t of TENSES) {
      if (!p.tenseTouched[t]) return t;
    }

    // Then weakest tense
    let weakest = 'present';
    let weakestScore = Infinity;
    for (const t of TENSES) {
      if ((p.tenseMastery[t] || 0) < weakestScore) {
        weakestScore = p.tenseMastery[t] || 0;
        weakest = t;
      }
    }
    return weakest;
  }

  function snapshotMastery() {
    state.preDrillMastery = {};
    for (const item of state.drillItems) {
      const p = verbProgressMap[item.verb.id];
      state.preDrillMastery[item.verb.id] = p ? p.mastery : 0;
    }
  }

  // --- Drilling phase ---
  function startDrilling() {
    state.phase = 'drilling';
    state.currentIndex = 0;
    state.results = [];
    renderDrillingPhase();
  }

  function renderDrillingPhase() {
    const item = state.drillItems[state.currentIndex];
    const verb = item.verb;
    const tense = item.tense;
    const progress = `${state.currentIndex + 1} / ${state.drillItems.length}`;

    app.innerHTML = `
      <div class="speed-round">
        <div class="speed-play-header">
          <span class="speed-progress">${progress}</span>
          <button class="speed-skip-btn" id="pd-skip">Skip</button>
        </div>
        <div class="pd-prompt-card">
          <div class="pd-verb-name">${verb.spanish}</div>
          <div class="pd-verb-meaning">${verb.english}</div>
          <div class="pd-tense-label">${TENSE_LABELS[tense]}</div>
        </div>
        <div class="pd-form-grid">
          ${PERSONS.map((person, i) => `
            <div class="pd-form-row">
              <label class="pd-person-label">${PERSON_LABELS[person]}</label>
              <input type="text" class="pd-form-input" id="pd-input-${i}"
                data-person="${person}" data-index="${i}"
                autocomplete="off" autocapitalize="off" spellcheck="false" />
            </div>
          `).join('')}
        </div>
        <div class="accent-helpers pd-accent-helpers">
          ${['á','é','í','ó','ú','ñ'].map(c => `<button class="btn-accent btn-pd-accent" data-char="${c}">${c}</button>`).join('')}
        </div>
        <div style="margin-top: 16px;">
          <button class="btn-primary" id="pd-check">Check</button>
        </div>
      </div>
    `;

    // Focus first input
    const firstInput = document.getElementById('pd-input-0');
    if (firstInput) firstInput.focus();
    state.focusedInput = firstInput;

    // Track focused input
    document.querySelectorAll('.pd-form-input').forEach(input => {
      input.addEventListener('focus', () => { state.focusedInput = input; });
    });

    // Enter key: advance to next input, submit on last
    document.querySelectorAll('.pd-form-input').forEach((input, i) => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (i < 5) {
            document.getElementById(`pd-input-${i + 1}`).focus();
          } else {
            submitDrill();
          }
        }
      });
    });

    // Accent helpers: mousedown + preventDefault to keep mobile keyboard open
    document.querySelectorAll('.btn-pd-accent').forEach(btn => {
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const char = btn.dataset.char;
        const input = state.focusedInput;
        if (!input) return;
        const pos = input.selectionStart;
        input.value = input.value.slice(0, pos) + char + input.value.slice(input.selectionEnd);
        input.selectionStart = input.selectionEnd = pos + 1;
      });
    });

    document.getElementById('pd-check').addEventListener('click', submitDrill);
    document.getElementById('pd-skip').addEventListener('click', skipDrill);
  }

  function submitDrill() {
    const item = state.drillItems[state.currentIndex];
    const verb = item.verb;
    const tense = item.tense;

    const formResults = PERSONS.map((person, i) => {
      const input = document.getElementById(`pd-input-${i}`);
      const userAnswer = input ? input.value.trim() : '';
      const correctAnswer = verb.conjugations[tense][person];
      return { person, userAnswer, correctAnswer, ...checkForm(userAnswer, correctAnswer) };
    });

    state.results.push({ verb, tense, formResults });
    renderFeedback();
  }

  function skipDrill() {
    const item = state.drillItems[state.currentIndex];
    const verb = item.verb;
    const tense = item.tense;

    const formResults = PERSONS.map(person => ({
      person,
      userAnswer: '',
      correctAnswer: verb.conjugations[tense][person],
      exact: false, accentMatch: false, wrong: true,
    }));

    state.results.push({ verb, tense, formResults });
    renderFeedback();
  }

  function checkForm(userAnswer, correctAnswer) {
    if (!userAnswer) return { exact: false, accentMatch: false, wrong: true };

    const ua = userAnswer.toLowerCase().trim();
    const ca = correctAnswer.toLowerCase().trim();

    if (ua === ca) return { exact: true, accentMatch: false, wrong: false };
    if (normalizeAccents(ua) === normalizeAccents(ca)) return { exact: false, accentMatch: true, wrong: false };
    return { exact: false, accentMatch: false, wrong: true };
  }

  // --- Feedback phase ---
  function renderFeedback() {
    state.phase = 'feedback';
    const result = state.results[state.results.length - 1];
    const { verb, tense, formResults } = result;

    const correctCount = formResults.filter(r => r.exact || r.accentMatch).length;
    const isLast = state.currentIndex >= state.drillItems.length - 1;

    app.innerHTML = `
      <div class="speed-round">
        <div class="speed-play-header">
          <span class="speed-progress">${state.currentIndex + 1} / ${state.drillItems.length}</span>
          <span class="speed-progress">${correctCount}/6</span>
        </div>
        <div class="pd-prompt-card">
          <div class="pd-verb-name">${verb.spanish}</div>
          <div class="pd-verb-meaning">${verb.english}</div>
          <div class="pd-tense-label">${TENSE_LABELS[tense]}</div>
        </div>
        <div class="pd-results-list">
          ${formResults.map(r => {
            let cls, icon;
            if (r.exact) { cls = 'pd-correct'; icon = '&#10003;'; }
            else if (r.accentMatch) { cls = 'pd-accent'; icon = '~'; }
            else { cls = 'pd-wrong'; icon = '&times;'; }

            return `
              <div class="pd-result-field ${cls}">
                <span class="pd-result-icon">${icon}</span>
                <span class="pd-person-label">${PERSON_LABELS[r.person]}</span>
                <div class="pd-result-answers">
                  ${r.userAnswer ? `<span class="pd-user-answer">${escapeHtml(r.userAnswer)}</span>` : '<span class="pd-no-answer">&mdash;</span>'}
                  ${!r.exact ? `<span class="pd-correct-answer">${escapeHtml(r.correctAnswer)}</span>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <button class="btn-primary" id="pd-next">${isLast ? 'See Results' : 'Next Verb'}</button>
      </div>
    `;

    document.getElementById('pd-next').addEventListener('click', () => {
      state.currentIndex++;
      if (state.currentIndex >= state.drillItems.length) {
        showResults();
      } else {
        state.phase = 'drilling';
        renderDrillingPhase();
      }
    });
  }

  // --- Results phase ---
  async function showResults() {
    state.phase = 'results';

    // Save progress first so we can show mastery changes
    await saveProgress();

    // Totals
    let totalCorrect = 0;
    let totalForms = 0;
    let totalAccentIssues = 0;

    for (const r of state.results) {
      for (const f of r.formResults) {
        totalForms++;
        if (f.exact) totalCorrect++;
        else if (f.accentMatch) { totalCorrect++; totalAccentIssues++; }
      }
    }

    const accuracy = totalForms > 0 ? Math.round((totalCorrect / totalForms) * 100) : 0;

    app.innerHTML = `
      <div class="speed-round">
        <h2 class="speed-title">Results</h2>
        <div class="speed-score-grid">
          <div class="speed-score-item">
            <span class="speed-score-value">${totalCorrect}/${totalForms}</span>
            <span class="speed-score-label">Correct</span>
          </div>
          <div class="speed-score-item">
            <span class="speed-score-value">${accuracy}%</span>
            <span class="speed-score-label">Accuracy</span>
          </div>
          ${totalAccentIssues > 0 ? `
          <div class="speed-score-item">
            <span class="speed-score-value speed-accent-warn">${totalAccentIssues}</span>
            <span class="speed-score-label">Accent Issues</span>
          </div>` : ''}
        </div>
        <div class="pd-verb-results">
          ${state.results.map(r => {
            const correct = r.formResults.filter(f => f.exact || f.accentMatch).length;
            const preMastery = state.preDrillMastery[r.verb.id] || 0;
            const postProg = verbProgressMap[r.verb.id];
            const postMastery = postProg ? postProg.mastery : 0;

            let arrow = '&rarr;';
            let arrowClass = '';
            if (postMastery > preMastery + 0.01) { arrow = '&uarr;'; arrowClass = 'sr-correct'; }
            else if (postMastery < preMastery - 0.01) { arrow = '&darr;'; arrowClass = 'sr-wrong'; }

            return `
              <div class="pd-result-verb-row">
                <div class="pd-result-verb-info">
                  <span class="pd-result-verb-name">${r.verb.spanish}</span>
                  <span class="pd-result-verb-tense">${TENSE_LABELS[r.tense]}</span>
                </div>
                <div class="pd-result-verb-score">
                  <span>${correct}/6</span>
                  <span class="pd-mastery-arrow ${arrowClass}">${arrow}</span>
                </div>
                <div class="pd-mini-form">
                  ${r.formResults.map(f => {
                    if (f.exact) return '<span class="pd-mini-ok">&#10003;</span>';
                    if (f.accentMatch) return '<span class="pd-mini-accent">~</span>';
                    return '<span class="pd-mini-wrong">&times;</span>';
                  }).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="speed-actions">
          <button class="btn-primary" id="pd-again">Drill Again</button>
          <button class="btn-secondary" id="pd-home" style="margin-top: 10px;">Back to Home</button>
        </div>
      </div>
    `;

    document.getElementById('pd-again').addEventListener('click', () => {
      if (freePickVerbId) {
        renderFreePick();
      } else {
        renderGuidedSelect();
      }
    });
    document.getElementById('pd-home').addEventListener('click', () => router.navigate('/'));
  }

  // --- Progress saving ---
  async function saveProgress() {
    const today = new Date().toISOString().split('T')[0];

    for (const r of state.results) {
      const verbId = r.verb.id;

      // Score per form: exact → 0.8, accent mismatch → 0.4, wrong → 0
      let totalScore = 0;
      for (const f of r.formResults) {
        if (f.exact) totalScore += 0.8;
        else if (f.accentMatch) totalScore += 0.4;
      }
      const avgScore = totalScore / 6;

      let progress = verbProgressMap[verbId];
      if (!progress) {
        progress = {
          verbId,
          mastery: 0,
          tenseMastery: { present: 0, preterite: 0, future: 0 },
          tenseTouched: { present: false, preterite: false, future: false },
          totalReviews: 0,
          nextReview: today,
          history: [],
        };
      }
      if (!progress.tenseTouched) {
        progress.tenseTouched = {
          present: progress.tenseMastery.present > 0,
          preterite: progress.tenseMastery.preterite > 0,
          future: progress.tenseMastery.future > 0,
        };
      }

      // EMA update — same alpha as verb-session.js
      const reviews = progress.totalReviews || 0;
      const alpha = reviews < 5 ? 0.5 : reviews < 15 ? 0.35 : 0.25;

      const tense = r.tense;
      if (progress.tenseMastery[tense] !== undefined) {
        progress.tenseMastery[tense] = progress.tenseMastery[tense] * (1 - alpha) + avgScore * alpha;
        progress.tenseTouched[tense] = true;
      }

      // Overall mastery — same formula as verb-session.js
      const touchedTenses = Object.keys(progress.tenseTouched).filter(t => progress.tenseTouched[t]);
      const touchedCount = touchedTenses.length || 1;
      const touchedSum = touchedTenses.reduce((sum, t) => sum + progress.tenseMastery[t], 0);
      const scaleFactor = 0.7 + 0.3 * (touchedCount / 3);
      progress.mastery = (touchedSum / touchedCount) * scaleFactor;

      progress.totalReviews++;
      const rating = avgScore >= 0.7 ? 'good' : avgScore >= 0.4 ? 'hard' : 'again';
      progress.history.push({ date: today, rating, tense, cardType: 'paradigm-drill' });
      if (progress.history.length > 50) progress.history = progress.history.slice(-50);

      // Next review interval — same as verb-session.js
      const interval = progress.mastery < 0.3 ? 1 : progress.mastery < 0.6 ? 3 : progress.mastery < 0.85 ? 7 : 14;
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + interval);
      progress.nextReview = nextDate.toISOString().split('T')[0];

      verbProgressMap[verbId] = progress;
      await db.saveVerbProgress(verbId, progress);
    }
  }

  // --- Utilities ---
  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}
