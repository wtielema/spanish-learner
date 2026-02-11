import { Session } from '../session.js';
import { VerbSession } from '../verb-session.js';
import { PrepSession } from '../prep-session.js';
import { DB } from '../db.js';
import { normalizeAccents, extractStem } from '../cards.js';

export async function renderPractice(app, router, mode) {
  try {
  const db = new DB();
  await db.init();
  const practiceMode = (await db.getSetting('practiceMode')) || 'mixed';
  const showTranslations = (await db.getSetting('showTranslations')) !== false;

  const isPrepMode = mode.startsWith('prep-');
  const isVerbMode = mode.startsWith('verb-');
  const session = isPrepMode ? new PrepSession() : isVerbMode ? new VerbSession() : new Session();
  await session.init(mode);

  function shouldUseMultipleChoice() {
    if (practiceMode === 'flashcard') return false;
    if (practiceMode === 'multiple-choice') return true;
    return Math.random() < 0.3;
  }

  function render() {
    const card = session.getCurrentCard();
    const progress = session.getProgress();

    if (!card) {
      app.innerHTML = `
        <div class="practice">
          <div class="practice-done">
            <h2>${mode === 'review' ? 'Review Complete!' : mode === 'verb-review' ? 'Verb Review Complete!' : mode === 'verb-learn' ? 'Verb Training Complete!' : mode === 'prep-review' ? 'Prep Review Complete!' : mode === 'prep-learn' ? 'Preposition Training Complete!' : 'No More New Cards'}</h2>
            <p class="text-secondary">${progress.total > 0 ? `You reviewed ${progress.total} cards.` : 'Come back tomorrow for more.'}</p>
            <button class="btn-primary" id="btn-back" style="margin-top: 24px;">Back to Home</button>
          </div>
        </div>
      `;
      document.getElementById('btn-back').addEventListener('click', () => router.navigate('/'));
      return;
    }

    // Dispatch to correct renderer based on exerciseType
    if (card.exerciseType) {
      switch (card.exerciseType) {
        case 'form-recognition':
          renderFormRecognition(card, progress);
          return;
        case 'production':
          renderProduction(card, progress);
          return;
        case 'fill-in-mc':
          renderFillIn(card, progress, 'mc');
          return;
        case 'fill-in-typing':
          renderFillIn(card, progress, 'typing');
          return;
        case 'pattern-match':
          renderPatternMatch(card, progress);
          return;
        case 'flashcard-conjugation':
          renderFlashcard(card, progress);
          return;
        case 'conjugation-mc':
          renderMultipleChoice(card, progress);
          return;
        case 'prep-fill-mc':
          renderPrepFillMC(card, progress);
          return;
        case 'prep-contrastive':
          renderPrepContrastive(card, progress);
          return;
        case 'prep-fill-typing':
          renderPrepFillTyping(card, progress);
          return;
      }
    }

    // Legacy behavior for nouns / old verb cards
    const useMultipleChoice = shouldUseMultipleChoice();

    if (useMultipleChoice) {
      renderMultipleChoice(card, progress);
    } else {
      renderFlashcard(card, progress);
    }
  }

  function renderFlashcard(card, progress) {
    const verbTranslation = showTranslations && card.verb && card.subtype === 'conjugation'
      ? `<div class="fillin-translation">${card.verb.english}</div>` : '';

    app.innerHTML = `
      <div class="practice">
        <div class="practice-header">
          <button class="practice-close" id="btn-close">&times;</button>
          <span class="practice-progress">${progress.current + 1} / ${progress.total}</span>
        </div>
        <div class="practice-card" id="card">
          <div class="card-front">
            <span class="card-label">${card.type}${card.subtype === 'conjugation' ? ' \u2014 ' + (card.tense || '') : ''}</span>
            <span class="card-text">${card.front}</span>
            ${verbTranslation}
            <span class="card-hint">Tap to reveal</span>
          </div>
        </div>
        <div class="rating-buttons hidden" id="ratings">
          <button class="btn-rating btn-again" data-rating="again">Again</button>
          <button class="btn-rating btn-hard" data-rating="hard">Hard</button>
          <button class="btn-rating btn-good" data-rating="good">Good</button>
          <button class="btn-rating btn-easy" data-rating="easy">Easy</button>
        </div>
      </div>
    `;

    let revealed = false;

    document.getElementById('card').addEventListener('click', () => {
      if (revealed) return;
      revealed = true;
      const answer = card.back || card.answer;
      document.getElementById('card').innerHTML = `
        <div class="card-revealed">
          <span class="card-label">${card.type}${card.subtype === 'conjugation' ? ' \u2014 ' + (card.tense || '') : ''}</span>
          <span class="card-text">${card.front}</span>
          <hr class="card-divider">
          <span class="card-answer">${answer}</span>
        </div>
      `;
      document.getElementById('ratings').classList.remove('hidden');
    });

    document.querySelectorAll('.btn-rating').forEach(btn => {
      btn.addEventListener('click', async () => {
        await session.answer(btn.dataset.rating);
        render();
      });
    });

    document.getElementById('btn-close').addEventListener('click', () => router.navigate('/'));
  }

  function renderMultipleChoice(card, progress) {
    const distractors = session.getDistractors(card, 3);
    const correctAnswer = card.back || card.answer;
    const options = shuffle([correctAnswer, ...distractors]);
    const verbTranslation = showTranslations && card.verb && card.subtype === 'conjugation'
      ? `<div class="fillin-translation">${card.verb.english}</div>` : '';

    app.innerHTML = `
      <div class="practice">
        <div class="practice-header">
          <button class="practice-close" id="btn-close">&times;</button>
          <span class="practice-progress">${progress.current + 1} / ${progress.total}</span>
        </div>
        <div class="practice-card">
          <div class="card-front">
            <span class="card-label">${card.type}${card.subtype === 'conjugation' ? ' \u2014 ' + (card.tense || '') : ''}</span>
            <span class="card-text">${card.front}</span>
            ${verbTranslation}
          </div>
        </div>
        <div class="mc-options">
          ${options.map(opt => `<button class="btn-mc-option" data-answer="${escapeAttr(opt)}">${opt}</button>`).join('')}
        </div>
      </div>
    `;

    let answered = false;

    document.querySelectorAll('.btn-mc-option').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (answered) return;
        answered = true;
        const selected = btn.dataset.answer;
        const correct = selected === correctAnswer;

        btn.classList.add(correct ? 'mc-correct' : 'mc-wrong');
        if (!correct) {
          document.querySelectorAll('.btn-mc-option').forEach(b => {
            if (b.dataset.answer === correctAnswer) b.classList.add('mc-correct');
          });
        }

        await session.answer(correct ? 'good' : 'again');
        setTimeout(() => render(), correct ? 600 : 1500);
      });
    });

    document.getElementById('btn-close').addEventListener('click', () => router.navigate('/'));
  }

  // --- New Exercise Renderers ---

  function renderFormRecognition(card, progress) {
    const isPerson = card.subtype === 'person-id';
    const title = isPerson ? 'Who is speaking?' : 'What tense is this?';
    const verbInfo = card.verb ? card.verb.spanish : '';
    const verbEnglish = card.verb ? card.verb.english : '';

    app.innerHTML = `
      <div class="practice">
        <div class="practice-header">
          <button class="practice-close" id="btn-close">&times;</button>
          <span class="practice-progress">${progress.current + 1} / ${progress.total}</span>
        </div>
        <div class="practice-card form-recognition-card">
          <div class="card-front">
            <span class="card-label">Form Recognition${isPerson && card.tense ? ' \u2014 ' + card.tense : ''}</span>
            <span class="card-text fr-conjugated">${card.prompt}</span>
            <span class="fr-verb-name">${verbInfo}</span>
            ${showTranslations ? `<div class="fillin-translation">${verbEnglish}</div>` : ''}
            <span class="card-hint">${title}</span>
          </div>
        </div>
        <div class="${isPerson ? 'fr-person-grid' : 'fr-tense-grid'}">
          ${card.options.map(opt =>
            `<button class="btn-fr-option" data-value="${escapeAttr(opt.value)}">${opt.label}</button>`
          ).join('')}
        </div>
      </div>
    `;

    let answered = false;

    document.querySelectorAll('.btn-fr-option').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (answered) return;
        answered = true;
        const selected = btn.dataset.value;
        const correct = selected === card.answer;

        btn.classList.add(correct ? 'mc-correct' : 'mc-wrong');
        if (!correct) {
          document.querySelectorAll('.btn-fr-option').forEach(b => {
            if (b.dataset.value === card.answer) b.classList.add('mc-correct');
          });
        }

        await session.answer(correct ? 'good' : 'again');
        setTimeout(() => render(), correct ? 600 : 1500);
      });
    });

    document.getElementById('btn-close').addEventListener('click', () => router.navigate('/'));
  }

  function renderProduction(card, progress) {
    app.innerHTML = `
      <div class="practice">
        <div class="practice-header">
          <button class="practice-close" id="btn-close">&times;</button>
          <span class="practice-progress">${progress.current + 1} / ${progress.total}</span>
        </div>
        <div class="practice-card production-card">
          <div class="card-front">
            <span class="card-label">Type the conjugation</span>
            <span class="card-text">${card.prompt}</span>
          </div>
        </div>
        <div class="production-input-area">
          <input type="text" class="production-input" id="prod-input"
            placeholder="Type your answer..."
            autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
          <div class="accent-helpers">
            ${['á','é','í','ó','ú','ñ'].map(c =>
              `<button class="btn-accent" data-char="${c}">${c}</button>`
            ).join('')}
          </div>
          <button class="btn-primary" id="btn-check" style="margin-top: 12px;">Check</button>
        </div>
        <div class="production-feedback hidden" id="prod-feedback"></div>
      </div>
    `;

    const input = document.getElementById('prod-input');
    input.focus();

    // Accent helper buttons
    document.querySelectorAll('.btn-accent').forEach(btn => {
      btn.addEventListener('click', () => {
        const char = btn.dataset.char;
        const pos = input.selectionStart;
        input.value = input.value.slice(0, pos) + char + input.value.slice(pos);
        input.focus();
        input.setSelectionRange(pos + 1, pos + 1);
      });
    });

    let checked = false;

    async function checkAnswer() {
      if (checked) return;
      checked = true;

      const userAnswer = input.value.trim().toLowerCase();
      const correctAnswer = card.answer.toLowerCase();

      let rating;
      if (userAnswer === correctAnswer) {
        rating = 'good';
      } else if (normalizeAccents(userAnswer) === normalizeAccents(correctAnswer)) {
        rating = 'hard'; // Close — accent mismatch
      } else {
        rating = 'again';
      }

      // Show feedback with highlighted ending
      const feedbackEl = document.getElementById('prod-feedback');
      feedbackEl.classList.remove('hidden');

      const highlighted = highlightEnding(card.answer, card.stem);

      if (rating === 'good') {
        feedbackEl.innerHTML = `
          <div class="feedback-correct">
            <span class="feedback-icon">&#10003;</span>
            <span class="feedback-word">${highlighted}</span>
          </div>
        `;
      } else if (rating === 'hard') {
        feedbackEl.innerHTML = `
          <div class="feedback-close">
            <span class="feedback-icon">~</span>
            <span>Close! Watch the accents</span>
            <span class="feedback-word">${highlighted}</span>
          </div>
        `;
      } else {
        feedbackEl.innerHTML = `
          <div class="feedback-wrong">
            <span class="feedback-icon">&#10007;</span>
            <span>Correct answer:</span>
            <span class="feedback-word">${highlighted}</span>
          </div>
        `;
      }

      input.disabled = true;
      document.getElementById('btn-check').style.display = 'none';

      await session.answer(rating);
      setTimeout(() => render(), rating === 'again' ? 2000 : 1200);
    }

    document.getElementById('btn-check').addEventListener('click', checkAnswer);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') checkAnswer();
    });

    document.getElementById('btn-close').addEventListener('click', () => router.navigate('/'));
  }

  function renderFillIn(card, progress, variant) {
    const sentenceParts = card.sentence.split('_____');
    const sentenceHtml = `<span class="fillin-text">${sentenceParts[0]}</span><span class="fillin-blank">_____</span><span class="fillin-text">${sentenceParts[1] || ''}</span>`;

    const translationHtml = showTranslations && card.sentenceEn
      ? `<div class="fillin-translation">${card.sentenceEn}</div>` : '';

    if (variant === 'mc') {
      // Multiple choice fill-in
      const options = shuffle([card.answer, ...card.distractors]);

      app.innerHTML = `
        <div class="practice">
          <div class="practice-header">
            <button class="practice-close" id="btn-close">&times;</button>
            <span class="practice-progress">${progress.current + 1} / ${progress.total}</span>
          </div>
          <div class="practice-card fillin-card">
            <div class="card-front">
              <span class="card-label">Fill in the blank \u2014 ${card.tense || ''}</span>
              <div class="fillin-sentence">${sentenceHtml}</div>
              ${translationHtml}
              <span class="fr-verb-name">${card.verb.spanish} (${card.verb.english})</span>
            </div>
          </div>
          <div class="mc-options">
            ${options.map(opt => `<button class="btn-mc-option" data-answer="${escapeAttr(opt)}">${opt}</button>`).join('')}
          </div>
        </div>
      `;

      let answered = false;
      document.querySelectorAll('.btn-mc-option').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (answered) return;
          answered = true;
          const selected = btn.dataset.answer;
          const correct = selected === card.answer;

          btn.classList.add(correct ? 'mc-correct' : 'mc-wrong');
          if (!correct) {
            document.querySelectorAll('.btn-mc-option').forEach(b => {
              if (b.dataset.answer === card.answer) b.classList.add('mc-correct');
            });
          }

          await session.answer(correct ? 'good' : 'again');
          setTimeout(() => render(), correct ? 600 : 1500);
        });
      });
    } else {
      // Typing fill-in
      app.innerHTML = `
        <div class="practice">
          <div class="practice-header">
            <button class="practice-close" id="btn-close">&times;</button>
            <span class="practice-progress">${progress.current + 1} / ${progress.total}</span>
          </div>
          <div class="practice-card fillin-card">
            <div class="card-front">
              <span class="card-label">Fill in the blank \u2014 ${card.tense || ''}</span>
              <div class="fillin-sentence">${sentenceHtml}</div>
              ${translationHtml}
              <span class="fr-verb-name">${card.verb.spanish} (${card.verb.english})</span>
            </div>
          </div>
          <div class="production-input-area">
            <input type="text" class="production-input" id="fillin-input"
              placeholder="Type the verb form..."
              autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
            <div class="accent-helpers">
              ${['á','é','í','ó','ú','ñ'].map(c =>
                `<button class="btn-accent" data-char="${c}">${c}</button>`
              ).join('')}
            </div>
            <button class="btn-primary" id="btn-check" style="margin-top: 12px;">Check</button>
          </div>
          <div class="production-feedback hidden" id="fillin-feedback"></div>
        </div>
      `;

      const input = document.getElementById('fillin-input');
      input.focus();

      document.querySelectorAll('.btn-accent').forEach(btn => {
        btn.addEventListener('click', () => {
          const char = btn.dataset.char;
          const pos = input.selectionStart;
          input.value = input.value.slice(0, pos) + char + input.value.slice(pos);
          input.focus();
          input.setSelectionRange(pos + 1, pos + 1);
        });
      });

      let checked = false;

      async function checkAnswer() {
        if (checked) return;
        checked = true;

        const userAnswer = input.value.trim().toLowerCase();
        const correctAnswer = card.answer.toLowerCase();

        let rating;
        if (userAnswer === correctAnswer) {
          rating = 'good';
        } else if (normalizeAccents(userAnswer) === normalizeAccents(correctAnswer)) {
          rating = 'hard';
        } else {
          rating = 'again';
        }

        const feedbackEl = document.getElementById('fillin-feedback');
        feedbackEl.classList.remove('hidden');

        const highlighted = highlightEnding(card.answer, card.stem);

        if (rating === 'good') {
          feedbackEl.innerHTML = `<div class="feedback-correct"><span class="feedback-icon">&#10003;</span> <span class="feedback-word">${highlighted}</span></div>`;
        } else if (rating === 'hard') {
          feedbackEl.innerHTML = `<div class="feedback-close"><span class="feedback-icon">~</span> Close! <span class="feedback-word">${highlighted}</span></div>`;
        } else {
          feedbackEl.innerHTML = `<div class="feedback-wrong"><span class="feedback-icon">&#10007;</span> <span class="feedback-word">${highlighted}</span></div>`;
        }

        input.disabled = true;
        document.getElementById('btn-check').style.display = 'none';

        await session.answer(rating);
        setTimeout(() => render(), rating === 'again' ? 2000 : 1200);
      }

      document.getElementById('btn-check').addEventListener('click', checkAnswer);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') checkAnswer();
      });
    }

    document.getElementById('btn-close').addEventListener('click', () => router.navigate('/'));
  }

  function renderPatternMatch(card, progress) {
    app.innerHTML = `
      <div class="practice">
        <div class="practice-header">
          <button class="practice-close" id="btn-close">&times;</button>
          <span class="practice-progress">${progress.current + 1} / ${progress.total}</span>
        </div>
        <div class="practice-card pattern-card">
          <div class="card-front">
            <span class="card-label">Identify the Pattern</span>
            <span class="card-text">${card.prompt}</span>
            <span class="card-hint">What type of verb is this?</span>
          </div>
        </div>
        <div class="mc-options">
          ${card.options.map(opt =>
            `<button class="btn-mc-option" data-value="${escapeAttr(opt.value)}">${opt.label}</button>`
          ).join('')}
        </div>
      </div>
    `;

    let answered = false;

    document.querySelectorAll('.btn-mc-option').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (answered) return;
        answered = true;
        const selected = btn.dataset.value;
        const correct = selected === card.answer;

        btn.classList.add(correct ? 'mc-correct' : 'mc-wrong');
        if (!correct) {
          document.querySelectorAll('.btn-mc-option').forEach(b => {
            if (b.dataset.value === card.answer) b.classList.add('mc-correct');
          });
        }

        await session.answer(correct ? 'good' : 'again');
        setTimeout(() => render(), correct ? 600 : 1500);
      });
    });

    document.getElementById('btn-close').addEventListener('click', () => router.navigate('/'));
  }

  // --- Preposition Exercise Renderers ---

  function renderPrepFillMC(card, progress) {
    const sentenceParts = card.sentence.split('_____');
    const sentenceHtml = `<span class="fillin-text">${sentenceParts[0]}</span><span class="fillin-blank">_____</span><span class="fillin-text">${sentenceParts[1] || ''}</span>`;
    const translationHtml = showTranslations && card.sentenceEn
      ? `<div class="fillin-translation">${card.sentenceEn}</div>` : '';
    const options = shuffle([card.answer, ...card.distractors]);

    app.innerHTML = `
      <div class="practice">
        <div class="practice-header">
          <button class="practice-close" id="btn-close">&times;</button>
          <span class="practice-progress">${progress.current + 1} / ${progress.total}</span>
        </div>
        <div class="practice-card fillin-card">
          <div class="card-front">
            <span class="card-label">Fill in the preposition</span>
            <div class="fillin-sentence">${sentenceHtml}</div>
            ${translationHtml}
          </div>
        </div>
        <div class="mc-options">
          ${options.map(opt => `<button class="btn-mc-option" data-answer="${escapeAttr(opt)}">${opt}</button>`).join('')}
        </div>
      </div>
    `;

    let answered = false;
    document.querySelectorAll('.btn-mc-option').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (answered) return;
        answered = true;
        const selected = btn.dataset.answer;
        const correct = selected === card.answer;

        btn.classList.add(correct ? 'mc-correct' : 'mc-wrong');
        if (!correct) {
          document.querySelectorAll('.btn-mc-option').forEach(b => {
            if (b.dataset.answer === card.answer) b.classList.add('mc-correct');
          });
        }

        // Show usage hint after answering
        const hintEl = document.createElement('div');
        hintEl.className = 'prep-usage-hint';
        hintEl.textContent = card.usage ? `"${card.answer}" — ${card.usage}` : '';
        document.querySelector('.fillin-card .card-front').appendChild(hintEl);

        await session.answer(correct ? 'good' : 'again');
        setTimeout(() => render(), correct ? 800 : 1800);
      });
    });

    document.getElementById('btn-close').addEventListener('click', () => router.navigate('/'));
  }

  function renderPrepContrastive(card, progress) {
    const sentenceParts = card.sentence.split('_____');
    const sentenceHtml = `<span class="fillin-text">${sentenceParts[0]}</span><span class="fillin-blank">_____</span><span class="fillin-text">${sentenceParts[1] || ''}</span>`;
    const translationHtml = showTranslations && card.sentenceEn
      ? `<div class="fillin-translation">${card.sentenceEn}</div>` : '';
    const options = shuffle([card.answer, card.partner]);

    app.innerHTML = `
      <div class="practice">
        <div class="practice-header">
          <button class="practice-close" id="btn-close">&times;</button>
          <span class="practice-progress">${progress.current + 1} / ${progress.total}</span>
        </div>
        <div class="practice-card fillin-card">
          <div class="card-front">
            <span class="card-label">Which preposition?</span>
            <div class="fillin-sentence">${sentenceHtml}</div>
            ${translationHtml}
          </div>
        </div>
        <div class="contrastive-options">
          ${options.map(opt => `<button class="btn-contrastive" data-answer="${escapeAttr(opt)}">${opt}</button>`).join('')}
        </div>
        <div class="prep-explanation hidden" id="prep-explanation"></div>
      </div>
    `;

    let answered = false;
    document.querySelectorAll('.btn-contrastive').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (answered) return;
        answered = true;
        const selected = btn.dataset.answer;
        const correct = selected === card.answer;

        btn.classList.add(correct ? 'mc-correct' : 'mc-wrong');
        if (!correct) {
          document.querySelectorAll('.btn-contrastive').forEach(b => {
            if (b.dataset.answer === card.answer) b.classList.add('mc-correct');
          });
        }

        // Show explanation
        const explEl = document.getElementById('prep-explanation');
        explEl.classList.remove('hidden');
        explEl.innerHTML = `<div class="${correct ? 'feedback-correct' : 'feedback-wrong'}">
          <span class="feedback-icon">${correct ? '&#10003;' : '&#10007;'}</span>
          <span>${card.explanation}</span>
        </div>`;

        await session.answer(correct ? 'good' : 'again');
        setTimeout(() => render(), correct ? 1200 : 2500);
      });
    });

    document.getElementById('btn-close').addEventListener('click', () => router.navigate('/'));
  }

  function renderPrepFillTyping(card, progress) {
    const sentenceParts = card.sentence.split('_____');
    const sentenceHtml = `<span class="fillin-text">${sentenceParts[0]}</span><span class="fillin-blank">_____</span><span class="fillin-text">${sentenceParts[1] || ''}</span>`;
    const translationHtml = showTranslations && card.sentenceEn
      ? `<div class="fillin-translation">${card.sentenceEn}</div>` : '';

    app.innerHTML = `
      <div class="practice">
        <div class="practice-header">
          <button class="practice-close" id="btn-close">&times;</button>
          <span class="practice-progress">${progress.current + 1} / ${progress.total}</span>
        </div>
        <div class="practice-card fillin-card">
          <div class="card-front">
            <span class="card-label">Type the preposition</span>
            <div class="fillin-sentence">${sentenceHtml}</div>
            ${translationHtml}
          </div>
        </div>
        <div class="production-input-area">
          <input type="text" class="production-input" id="prep-input"
            placeholder="Type the preposition..."
            autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
          <div class="accent-helpers">
            ${['á','é','í','ó','ú','ñ'].map(c =>
              `<button class="btn-accent" data-char="${c}">${c}</button>`
            ).join('')}
          </div>
          <button class="btn-primary" id="btn-check" style="margin-top: 12px;">Check</button>
        </div>
        <div class="production-feedback hidden" id="prep-feedback"></div>
      </div>
    `;

    const input = document.getElementById('prep-input');
    input.focus();

    document.querySelectorAll('.btn-accent').forEach(btn => {
      btn.addEventListener('click', () => {
        const char = btn.dataset.char;
        const pos = input.selectionStart;
        input.value = input.value.slice(0, pos) + char + input.value.slice(pos);
        input.focus();
        input.setSelectionRange(pos + 1, pos + 1);
      });
    });

    let checked = false;

    async function checkAnswer() {
      if (checked) return;
      checked = true;

      const userAnswer = input.value.trim().toLowerCase();
      const correctAnswer = card.answer.toLowerCase();

      let rating;
      if (userAnswer === correctAnswer) {
        rating = 'good';
      } else if (normalizeAccents(userAnswer) === normalizeAccents(correctAnswer)) {
        rating = 'hard';
      } else {
        rating = 'again';
      }

      const feedbackEl = document.getElementById('prep-feedback');
      feedbackEl.classList.remove('hidden');

      if (rating === 'good') {
        feedbackEl.innerHTML = `<div class="feedback-correct"><span class="feedback-icon">&#10003;</span> <span class="feedback-word">${card.answer}</span></div>`;
      } else if (rating === 'hard') {
        feedbackEl.innerHTML = `<div class="feedback-close"><span class="feedback-icon">~</span> Close! Watch the accents: <span class="feedback-word">${card.answer}</span></div>`;
      } else {
        feedbackEl.innerHTML = `<div class="feedback-wrong"><span class="feedback-icon">&#10007;</span> Correct: <span class="feedback-word">${card.answer}</span></div>`;
      }

      input.disabled = true;
      document.getElementById('btn-check').style.display = 'none';

      await session.answer(rating);
      setTimeout(() => render(), rating === 'again' ? 2000 : 1200);
    }

    document.getElementById('btn-check').addEventListener('click', checkAnswer);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') checkAnswer();
    });

    document.getElementById('btn-close').addEventListener('click', () => router.navigate('/'));
  }

  // --- Helpers ---

  function highlightEnding(word, stem) {
    if (!stem || !word.toLowerCase().startsWith(stem.toLowerCase())) {
      return `<span class="ending-highlight">${word}</span>`;
    }
    const stemPart = word.slice(0, stem.length);
    const ending = word.slice(stem.length);
    return `${stemPart}<span class="ending-highlight">${ending}</span>`;
  }

  function escapeAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  render();
  } catch (e) {
    app.innerHTML = `<div style="padding:20px;color:#e94560;"><h2>Error</h2><pre>${e.message}\n${e.stack}</pre><button class="btn-primary" onclick="location.hash='/'">Back</button></div>`;
  }
}
