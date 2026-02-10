import { DB } from '../db.js';
import { normalizeAccents } from '../cards.js';
import { SRS } from '../srs.js';

const PERSONS = ['yo', 'tú', 'él', 'nosotros', 'vosotros', 'ellos'];
const TENSES = ['present', 'preterite', 'future'];
const PERSON_LABELS = {
  'yo': 'yo', 'tú': 'tú', 'él': 'él/ella',
  'nosotros': 'nosotros', 'vosotros': 'vosotros', 'ellos': 'ellos/ellas'
};
const TENSE_LABELS = { 'present': 'Present', 'preterite': 'Preterite', 'future': 'Future' };

export async function renderSpeedRound(app, router) {
  const db = new DB();
  await db.init();

  let nouns = [], verbs = [];
  try {
    [nouns, verbs] = await Promise.all([
      fetch('data/nouns.json').then(r => r.json()),
      fetch('data/verbs.json').then(r => r.json()),
    ]);
  } catch (e) { /* offline */ }

  const allProgress = await db.getAllProgress();
  const allVerbProgress = await db.getAllVerbProgress();

  // Find practiced noun IDs from progress cardIds (pattern: n0001-es, n0001-en)
  const practicedNounIds = new Set();
  for (const p of allProgress) {
    const m = p.cardId.match(/^(n\d+)/);
    if (m) practicedNounIds.add(m[1]);
  }
  const practicedNouns = nouns.filter(n => practicedNounIds.has(n.id));

  // Find practiced verbs
  const verbProgressIds = new Set(allVerbProgress.map(p => p.verbId));
  const practicedVerbs = verbs.filter(v => verbProgressIds.has(v.id));

  const isMobile = 'ontouchstart' in window || window.matchMedia('(max-width: 768px)').matches;

  let state = {
    phase: 'select',
    contentMode: null,
    answerMode: isMobile ? 'mc' : 'typing',
    items: [],
    currentIndex: 0,
    results: [],
    timeRemaining: 60,
    timerId: null,
    startTime: null,
  };

  // Clean up timer on navigation
  const cleanup = () => {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
    window.removeEventListener('hashchange', cleanup);
  };
  window.addEventListener('hashchange', cleanup);

  renderModeSelect();

  function renderModeSelect() {
    cleanup();
    const savedMode = state.answerMode;
    state = { phase: 'select', contentMode: null, answerMode: savedMode, items: [], currentIndex: 0, results: [], timeRemaining: 60, timerId: null, startTime: null };

    const nounCount = practicedNouns.length;
    const verbCount = practicedVerbs.length;
    const mixedCount = nounCount + verbCount;

    app.innerHTML = `
      <div class="speed-round">
        <div class="speed-header">
          <h2 class="speed-title">Speed Round</h2>
          <button class="practice-close" id="sr-close">&times;</button>
        </div>
        <p class="speed-subtitle">Answer 20 questions as fast as you can in 60 seconds!</p>

        <div class="sr-setting-group">
          <span class="sr-setting-label">Answer Mode</span>
          <div class="sr-setting-options">
            <button class="sr-setting-opt ${state.answerMode === 'mc' ? 'active' : ''}" id="sr-opt-mc">Multiple Choice</button>
            <button class="sr-setting-opt ${state.answerMode === 'typing' ? 'active' : ''}" id="sr-opt-typing" ${isMobile ? 'disabled' : ''}>Typing${isMobile ? ' (desktop only)' : ''}</button>
          </div>
        </div>

        <div class="speed-modes">
          <button class="btn-speed-mode" id="sr-nouns" ${nounCount < 5 ? 'disabled' : ''}>
            <span class="speed-mode-icon">&#128218;</span>
            <span class="speed-mode-label">Nouns</span>
            <span class="speed-mode-count">${nounCount} practiced</span>
          </button>
          <button class="btn-speed-mode" id="sr-verbs" ${verbCount < 5 ? 'disabled' : ''}>
            <span class="speed-mode-icon">&#9997;&#65039;</span>
            <span class="speed-mode-label">Verbs</span>
            <span class="speed-mode-count">${verbCount} practiced</span>
          </button>
          <button class="btn-speed-mode" id="sr-mixed" ${mixedCount < 5 ? 'disabled' : ''}>
            <span class="speed-mode-icon">&#127922;</span>
            <span class="speed-mode-label">Mixed</span>
            <span class="speed-mode-count">${mixedCount} practiced</span>
          </button>
        </div>
        ${nounCount < 5 && verbCount < 5 ? '<p class="speed-hint">Practice at least 5 nouns or verbs first to unlock Speed Round.</p>' : ''}
      </div>
    `;

    document.getElementById('sr-close').addEventListener('click', () => router.navigate('/'));

    // Answer mode toggle
    document.getElementById('sr-opt-mc').addEventListener('click', () => {
      state.answerMode = 'mc';
      document.getElementById('sr-opt-mc').classList.add('active');
      document.getElementById('sr-opt-typing').classList.remove('active');
    });
    const typingBtn = document.getElementById('sr-opt-typing');
    if (!typingBtn.disabled) {
      typingBtn.addEventListener('click', () => {
        state.answerMode = 'typing';
        typingBtn.classList.add('active');
        document.getElementById('sr-opt-mc').classList.remove('active');
      });
    }

    const bind = (id, mode) => {
      const btn = document.getElementById(id);
      if (btn && !btn.disabled) btn.addEventListener('click', () => startRound(mode));
    };
    bind('sr-nouns', 'nouns');
    bind('sr-verbs', 'verbs');
    bind('sr-mixed', 'mixed');
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function buildItems(mode) {
    const items = [];

    if (mode === 'nouns' || mode === 'mixed') {
      const pool = shuffle([...practicedNouns]);
      const count = mode === 'nouns' ? 20 : Math.min(14, pool.length);
      for (let i = 0; i < Math.min(count, pool.length); i++) {
        const noun = pool[i];
        const direction = Math.random() < 0.7 ? 'en-es' : 'es-en';
        const article = noun.gender === 'm' ? 'el' : 'la';
        if (direction === 'en-es') {
          items.push({
            type: 'noun',
            nounId: noun.id,
            prompt: `the ${noun.english}`,
            answer: noun.spanish,
            displayInfo: `${article} ${noun.spanish}`,
            direction,
            gender: noun.gender,
          });
        } else {
          items.push({
            type: 'noun',
            nounId: noun.id,
            prompt: `${article} ${noun.spanish}`,
            answer: noun.english,
            displayInfo: noun.english,
            direction,
          });
        }
      }
    }

    if (mode === 'verbs' || mode === 'mixed') {
      const pool = shuffle([...practicedVerbs]);
      const count = mode === 'verbs' ? 20 : Math.min(14, pool.length);
      for (let i = 0; i < Math.min(count, pool.length); i++) {
        const verb = pool[i];
        if (Math.random() < 0.4) {
          // Meaning question
          const dir = Math.random() < 0.5 ? 'en-es' : 'es-en';
          if (dir === 'en-es') {
            items.push({
              type: 'verb',
              verbId: verb.id,
              prompt: `to ${verb.english}`,
              answer: verb.spanish,
              displayInfo: verb.spanish,
              direction: dir,
            });
          } else {
            items.push({
              type: 'verb',
              verbId: verb.id,
              prompt: verb.spanish,
              answer: verb.english,
              displayInfo: verb.english,
              direction: dir,
            });
          }
        } else {
          // Conjugation question
          const tense = TENSES[Math.floor(Math.random() * TENSES.length)];
          const person = PERSONS[Math.floor(Math.random() * PERSONS.length)];
          const form = verb.conjugations[tense][person];
          items.push({
            type: 'verb-conjugation',
            verbId: verb.id,
            tense,
            prompt: `${verb.spanish} — ${PERSON_LABELS[person]} — ${TENSE_LABELS[tense]}`,
            answer: form,
            displayInfo: form,
            direction: 'conjugation',
          });
        }
      }
    }

    const final = shuffle(items).slice(0, 20);

    // Generate distractors for MC mode
    if (state.answerMode === 'mc') {
      for (const item of final) {
        item.options = buildDistractors(item, final);
      }
    }

    return final;
  }

  function buildDistractors(item, allItems) {
    const answer = item.answer.toLowerCase().trim();
    let pool = [];

    if (item.type === 'noun') {
      if (item.direction === 'en-es') {
        pool = practicedNouns.map(n => n.spanish).filter(w => w.toLowerCase() !== answer);
      } else {
        pool = practicedNouns.map(n => n.english).filter(w => w.toLowerCase() !== answer);
      }
    } else if (item.type === 'verb') {
      if (item.direction === 'en-es') {
        pool = practicedVerbs.map(v => v.spanish).filter(w => w.toLowerCase() !== answer);
      } else {
        pool = practicedVerbs.map(v => v.english).filter(w => w.toLowerCase() !== answer);
      }
    } else if (item.type === 'verb-conjugation') {
      // Pull forms from all practiced verbs for the same tense but different results
      for (const v of practicedVerbs) {
        for (const t of TENSES) {
          for (const p of PERSONS) {
            const form = v.conjugations[t][p];
            if (form.toLowerCase() !== answer && !pool.includes(form)) {
              pool.push(form);
            }
          }
        }
      }
    }

    const distractors = shuffle(pool).slice(0, 3);
    // If not enough distractors, pull answers from other items in this round
    if (distractors.length < 3) {
      const others = allItems
        .filter(i => i.answer.toLowerCase() !== answer)
        .map(i => i.answer);
      for (const o of shuffle(others)) {
        if (distractors.length >= 3) break;
        if (!distractors.includes(o)) distractors.push(o);
      }
    }

    const options = shuffle([item.answer, ...distractors]);
    return options;
  }

  function startRound(mode) {
    state.contentMode = mode;
    state.items = buildItems(mode);
    state.currentIndex = 0;
    state.results = [];
    state.timeRemaining = 60;
    state.phase = 'playing';
    state.startTime = Date.now();

    renderPlaying();

    state.timerId = setInterval(() => {
      state.timeRemaining--;
      updateTimer();
      if (state.timeRemaining <= 0) {
        endRound();
      }
    }, 1000);
  }

  function timerClass() {
    if (state.timeRemaining <= 10) return 'danger';
    if (state.timeRemaining <= 30) return 'warning';
    return '';
  }

  function renderPlaying() {
    const item = state.items[state.currentIndex];
    const progress = `${state.currentIndex + 1} / ${state.items.length}`;
    const label = item.type === 'verb-conjugation' ? 'Conjugate' : item.direction === 'en-es' ? 'Translate to Spanish' : 'Translate to English';

    if (state.answerMode === 'mc') {
      renderPlayingMC(item, progress, label);
    } else {
      renderPlayingTyping(item, progress, label);
    }
  }

  function renderPlayingTyping(item, progress, label) {
    app.innerHTML = `
      <div class="speed-round">
        <div class="speed-play-header">
          <span class="speed-progress">${progress}</span>
          <span class="speed-timer ${timerClass()}" id="sr-timer">${state.timeRemaining}s</span>
          <button class="speed-skip-btn" id="sr-skip">Skip</button>
        </div>
        <div class="speed-prompt-card">
          <span class="speed-prompt-label">${label}</span>
          <span class="speed-prompt-text">${item.prompt}</span>
        </div>
        <div class="speed-input-area">
          <input type="text" class="speed-input" id="sr-input" autocomplete="off" autocapitalize="off" spellcheck="false" autofocus />
          <div class="accent-helpers">
            ${['á','é','í','ó','ú','ñ'].map(c => `<button class="btn-accent btn-sr-accent" data-char="${c}">${c}</button>`).join('')}
          </div>
        </div>
      </div>
    `;

    const input = document.getElementById('sr-input');
    input.focus();

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitAnswer(input.value.trim());
      }
    });

    document.getElementById('sr-skip').addEventListener('click', () => {
      submitAnswer('');
    });

    document.querySelectorAll('.btn-sr-accent').forEach(btn => {
      btn.addEventListener('click', () => {
        const char = btn.dataset.char;
        const pos = input.selectionStart;
        input.value = input.value.slice(0, pos) + char + input.value.slice(input.selectionEnd);
        input.selectionStart = input.selectionEnd = pos + 1;
        input.focus();
      });
    });
  }

  function renderPlayingMC(item, progress, label) {
    app.innerHTML = `
      <div class="speed-round">
        <div class="speed-play-header">
          <span class="speed-progress">${progress}</span>
          <span class="speed-timer ${timerClass()}" id="sr-timer">${state.timeRemaining}s</span>
          <button class="speed-skip-btn" id="sr-skip">Skip</button>
        </div>
        <div class="speed-prompt-card">
          <span class="speed-prompt-label">${label}</span>
          <span class="speed-prompt-text">${item.prompt}</span>
        </div>
        <div class="sr-mc-options">
          ${item.options.map((opt, i) => `<button class="btn-sr-mc" data-answer="${escapeHtml(opt)}">${escapeHtml(opt)}</button>`).join('')}
        </div>
      </div>
    `;

    document.getElementById('sr-skip').addEventListener('click', () => {
      submitAnswer('');
    });

    document.querySelectorAll('.btn-sr-mc').forEach(btn => {
      btn.addEventListener('click', () => {
        submitAnswer(btn.dataset.answer);
      });
    });
  }

  function updateTimer() {
    const el = document.getElementById('sr-timer');
    if (el) {
      el.textContent = `${state.timeRemaining}s`;
      el.className = `speed-timer ${timerClass()}`;
    }
  }

  function stripArticles(str) {
    return str.replace(/^(el|la|los|las|the|a|an)\s+/i, '');
  }

  function extractArticle(str) {
    const m = str.match(/^(el|la|los|las)\s+/i);
    return m ? m[1].toLowerCase() : null;
  }

  function stripPronoun(str) {
    return str.replace(/^(yo|tú|tu|él|el|ella|nosotros|nosotras|vosotros|vosotras|ellos|ellas|usted|ustedes)\s+/i, '');
  }

  function checkAnswer(userAnswer, item) {
    if (!userAnswer) return { correct: false, accentIssue: false, skipped: true };

    let ua = userAnswer.toLowerCase().trim();
    const ca = item.answer.toLowerCase().trim();

    // Strip subject pronouns for conjugation answers
    if (item.type === 'verb-conjugation') {
      ua = stripPronoun(ua);
    }

    // Exact match
    if (ua === ca) return { correct: true, accentIssue: false, skipped: false };

    // Strip articles for comparison
    const uaStripped = stripArticles(ua);
    const caStripped = stripArticles(ca);

    // If user typed a Spanish article on an en→es noun, validate gender
    if (item.gender && item.direction === 'en-es') {
      const typed = extractArticle(ua);
      if (typed) {
        const correctArt = item.gender === 'm' ? 'el' : 'la';
        if (typed !== correctArt) {
          return { correct: false, accentIssue: false, skipped: false, wrongArticle: true, correctArticle: correctArt };
        }
      }
    }

    // Match after stripping articles
    if (uaStripped === caStripped) return { correct: true, accentIssue: false, skipped: false };

    // For es→en nouns/verbs: accept any "/" separated alternative
    if (item.direction === 'es-en') {
      const alts = ca.split('/').map(s => s.trim());
      // Carry forward "to " prefix to bare alternatives (e.g. "to wait/hope" → also accept "to hope")
      const prefix = alts[0].match(/^(to )/i);
      const allAlts = [...new Set(alts.flatMap(a => {
        const expanded = [a];
        if (prefix && !a.startsWith(prefix[1])) expanded.push(prefix[1] + a);
        return expanded;
      }))];
      if (allAlts.some(a => ua === a || uaStripped === stripArticles(a))) return { correct: true, accentIssue: false, skipped: false };
      if (allAlts.some(a => normalizeAccents(uaStripped) === normalizeAccents(stripArticles(a)))) {
        return { correct: true, accentIssue: true, skipped: false };
      }
    }

    // Accent-only difference (with article stripping)
    if (normalizeAccents(uaStripped) === normalizeAccents(caStripped)) {
      return { correct: true, accentIssue: true, skipped: false };
    }

    return { correct: false, accentIssue: false, skipped: false };
  }

  function submitAnswer(userAnswer) {
    const item = state.items[state.currentIndex];
    const result = checkAnswer(userAnswer, item);
    state.results.push({
      ...item,
      userAnswer: userAnswer || '',
      ...result,
    });

    state.currentIndex++;
    if (state.currentIndex >= state.items.length) {
      endRound();
    } else {
      renderPlaying();
    }
  }

  async function saveResults(results) {
    const today = new Date().toISOString().split('T')[0];

    for (const r of results) {
      if (r.skipped || r.timedOut) continue;

      const rating = r.correct ? 'good' : 'again';

      // Update noun SRS progress
      if (r.type === 'noun' && r.nounId) {
        const cardId = `${r.nounId}-${r.direction === 'en-es' ? 'en' : 'es'}`;
        let progress = await db.getProgress(cardId);
        if (!progress) progress = SRS.newCard(cardId);
        const updated = SRS.review(progress, rating);
        await db.saveProgress(cardId, updated);
      }

      // Update verb mastery
      if ((r.type === 'verb' || r.type === 'verb-conjugation') && r.verbId) {
        let progress = await db.getVerbProgress(r.verbId);
        if (!progress) {
          progress = {
            verbId: r.verbId,
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

        const score = r.correct ? 0.8 : 0;
        const reviews = progress.totalReviews || 0;
        const alpha = reviews < 5 ? 0.5 : reviews < 15 ? 0.35 : 0.25;

        const tense = r.tense || 'present';
        if (progress.tenseMastery[tense] !== undefined) {
          progress.tenseMastery[tense] = progress.tenseMastery[tense] * (1 - alpha) + score * alpha;
          progress.tenseTouched[tense] = true;
        }

        const touchedTenses = Object.keys(progress.tenseTouched).filter(t => progress.tenseTouched[t]);
        const touchedCount = touchedTenses.length || 1;
        const touchedSum = touchedTenses.reduce((sum, t) => sum + progress.tenseMastery[t], 0);
        const scaleFactor = 0.7 + 0.3 * (touchedCount / 3);
        progress.mastery = (touchedSum / touchedCount) * scaleFactor;

        progress.totalReviews++;
        progress.history.push({ date: today, rating, tense, cardType: 'speed-round' });
        if (progress.history.length > 50) progress.history = progress.history.slice(-50);

        const interval = progress.mastery < 0.3 ? 1 : progress.mastery < 0.6 ? 3 : progress.mastery < 0.85 ? 7 : 14;
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + interval);
        progress.nextReview = nextDate.toISOString().split('T')[0];

        await db.saveVerbProgress(r.verbId, progress);
      }
    }
  }

  function endRound() {
    cleanup();
    state.phase = 'results';

    // Mark unanswered items as timed out
    while (state.results.length < state.items.length) {
      const item = state.items[state.results.length];
      state.results.push({
        ...item,
        userAnswer: '',
        correct: false,
        accentIssue: false,
        skipped: false,
        timedOut: true,
      });
    }

    // Save results to SRS/mastery (fire and forget)
    saveResults(state.results);

    const timeUsed = Math.round((Date.now() - state.startTime) / 1000);
    const correct = state.results.filter(r => r.correct).length;
    const accentIssues = state.results.filter(r => r.correct && r.accentIssue).length;
    const total = state.results.length;
    const accuracy = Math.round((correct / total) * 100);

    app.innerHTML = `
      <div class="speed-round">
        <h2 class="speed-title">Results</h2>
        <div class="speed-score-grid">
          <div class="speed-score-item">
            <span class="speed-score-value">${correct}/${total}</span>
            <span class="speed-score-label">Correct</span>
          </div>
          <div class="speed-score-item">
            <span class="speed-score-value">${accuracy}%</span>
            <span class="speed-score-label">Accuracy</span>
          </div>
          <div class="speed-score-item">
            <span class="speed-score-value">${timeUsed}s</span>
            <span class="speed-score-label">Time Used</span>
          </div>
          ${accentIssues > 0 ? `
          <div class="speed-score-item">
            <span class="speed-score-value speed-accent-warn">${accentIssues}</span>
            <span class="speed-score-label">Accent Issues</span>
          </div>` : ''}
        </div>
        <div class="speed-results-list">
          ${state.results.map((r, i) => {
            let icon, iconClass;
            if (r.timedOut) { icon = '&ndash;'; iconClass = 'sr-timed-out'; }
            else if (r.skipped) { icon = '&ndash;'; iconClass = 'sr-skipped'; }
            else if (!r.correct) { icon = '&times;'; iconClass = 'sr-wrong'; }
            else if (r.accentIssue) { icon = '~'; iconClass = 'sr-accent'; }
            else { icon = '&#10003;'; iconClass = 'sr-correct'; }

            const showCorrectAnswer = !r.correct || r.timedOut || r.skipped;
            const accentDiff = r.accentIssue ? highlightAccentDiff(r.userAnswer, r.answer) : '';
            const correctDisplay = r.wrongArticle
              ? `<span class="sr-article-fix">${r.correctArticle}</span> ${escapeHtml(r.answer)} <span class="sr-gender-hint">(wrong gender)</span>`
              : escapeHtml(r.displayInfo || r.answer);

            return `
              <div class="speed-result-row">
                <span class="speed-result-icon ${iconClass}">${icon}</span>
                <div class="speed-result-detail">
                  <span class="speed-result-prompt">${r.prompt}</span>
                  ${r.userAnswer ? `<span class="speed-result-user">${r.accentIssue ? accentDiff : escapeHtml(r.userAnswer)}</span>` : `<span class="speed-result-user sr-no-answer">${r.timedOut ? 'Time ran out' : 'Skipped'}</span>`}
                  ${showCorrectAnswer ? `<span class="speed-result-correct">${correctDisplay}</span>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="speed-actions">
          <button class="btn-primary" id="sr-again">Play Again</button>
          <button class="btn-secondary" id="sr-home" style="margin-top: 10px;">Back to Home</button>
        </div>
      </div>
    `;

    document.getElementById('sr-again').addEventListener('click', () => renderModeSelect());
    document.getElementById('sr-home').addEventListener('click', () => router.navigate('/'));
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function highlightAccentDiff(userAnswer, correctAnswer) {
    let result = '';
    const ua = userAnswer.toLowerCase();
    const ca = correctAnswer.toLowerCase();
    const maxLen = Math.max(ua.length, ca.length);
    for (let i = 0; i < maxLen; i++) {
      const uc = ua[i] || '';
      const cc = ca[i] || '';
      if (uc === cc) {
        result += escapeHtml(uc);
      } else if (normalizeAccents(uc) === normalizeAccents(cc)) {
        result += `<span class="sr-accent-char">${escapeHtml(uc)}</span>`;
      } else {
        result += escapeHtml(uc);
      }
    }
    return result;
  }
}
