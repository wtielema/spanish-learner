import { Session } from '../session.js';
import { DB } from '../db.js';

export async function renderPractice(app, router, mode) {
  const db = new DB();
  await db.init();
  const practiceMode = (await db.getSetting('practiceMode')) || 'mixed';

  const session = new Session();
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
            <h2>${mode === 'review' ? 'Review Complete!' : 'No More New Cards'}</h2>
            <p class="text-secondary">${progress.total > 0 ? `You reviewed ${progress.total} cards.` : 'Come back tomorrow for more.'}</p>
            <button class="btn-primary" id="btn-back" style="margin-top: 24px;">Back to Home</button>
          </div>
        </div>
      `;
      document.getElementById('btn-back').addEventListener('click', () => router.navigate('/'));
      return;
    }

    const useMultipleChoice = shouldUseMultipleChoice();

    if (useMultipleChoice) {
      renderMultipleChoice(card, progress);
    } else {
      renderFlashcard(card, progress);
    }
  }

  function renderFlashcard(card, progress) {
    app.innerHTML = `
      <div class="practice">
        <div class="practice-header">
          <button class="practice-close" id="btn-close">&times;</button>
          <span class="practice-progress">${progress.current + 1} / ${progress.total}</span>
        </div>
        <div class="practice-card" id="card">
          <div class="card-front">
            <span class="card-label">${card.type}${card.subtype === 'conjugation' ? ' \u2014 ' + card.tense : ''}</span>
            <span class="card-text">${card.front}</span>
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
      document.getElementById('card').innerHTML = `
        <div class="card-revealed">
          <span class="card-label">${card.type}${card.subtype === 'conjugation' ? ' \u2014 ' + card.tense : ''}</span>
          <span class="card-text">${card.front}</span>
          <hr class="card-divider">
          <span class="card-answer">${card.back}</span>
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
    const options = session._shuffle([card.back, ...distractors]);

    app.innerHTML = `
      <div class="practice">
        <div class="practice-header">
          <button class="practice-close" id="btn-close">&times;</button>
          <span class="practice-progress">${progress.current + 1} / ${progress.total}</span>
        </div>
        <div class="practice-card">
          <div class="card-front">
            <span class="card-label">${card.type}${card.subtype === 'conjugation' ? ' \u2014 ' + card.tense : ''}</span>
            <span class="card-text">${card.front}</span>
          </div>
        </div>
        <div class="mc-options">
          ${options.map(opt => `<button class="btn-mc-option" data-answer="${opt.replace(/"/g, '&quot;')}">${opt}</button>`).join('')}
        </div>
      </div>
    `;

    let answered = false;

    document.querySelectorAll('.btn-mc-option').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (answered) return;
        answered = true;
        const selected = btn.dataset.answer;
        const correct = selected === card.back;

        btn.classList.add(correct ? 'mc-correct' : 'mc-wrong');
        if (!correct) {
          document.querySelectorAll('.btn-mc-option').forEach(b => {
            if (b.dataset.answer === card.back) b.classList.add('mc-correct');
          });
        }

        await session.answer(correct ? 'good' : 'again');
        setTimeout(() => render(), correct ? 600 : 1500);
      });
    });

    document.getElementById('btn-close').addEventListener('click', () => router.navigate('/'));
  }

  render();
}
