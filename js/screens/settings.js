import { DB } from '../db.js';

export async function renderSettings(app, router) {
  const db = new DB();
  await db.init();

  const newPerDay = (await db.getSetting('newPerDay')) || 10;
  const practiceMode = (await db.getSetting('practiceMode')) || 'mixed';
  const verbTrainingMode = (await db.getSetting('verbTrainingMode')) || 'auto';
  const showTranslations = (await db.getSetting('showTranslations')) !== false;

  app.innerHTML = `
    <div class="settings">
      <div class="browse-header">
        <button class="practice-close" id="btn-back">&larr;</button>
        <h2>Settings</h2>
      </div>

      <div class="setting-group">
        <label class="setting-label">New words per day: <strong id="npd-value">${newPerDay}</strong></label>
        <input type="range" class="setting-slider" id="npd-slider" min="5" max="30" value="${newPerDay}">
      </div>

      <div class="setting-group">
        <label class="setting-label">Practice mode</label>
        <div class="setting-options">
          <button class="setting-option ${practiceMode === 'flashcard' ? 'active' : ''}" data-mode="flashcard">Flashcard</button>
          <button class="setting-option ${practiceMode === 'multiple-choice' ? 'active' : ''}" data-mode="multiple-choice">Multiple Choice</button>
          <button class="setting-option ${practiceMode === 'mixed' ? 'active' : ''}" data-mode="mixed">Mixed</button>
        </div>
      </div>

      <div class="setting-group">
        <label class="setting-label">Verb training mode</label>
        <div class="setting-options" id="verb-mode-options">
          <button class="setting-option ${verbTrainingMode === 'auto' ? 'active' : ''}" data-vmode="auto">Auto</button>
          <button class="setting-option ${verbTrainingMode === 'mc' ? 'active' : ''}" data-vmode="mc">MC Only</button>
          <button class="setting-option ${verbTrainingMode === 'typing' ? 'active' : ''}" data-vmode="typing">Typing</button>
        </div>
        <p class="setting-hint">Auto: progressive escalation based on mastery</p>
      </div>

      <div class="setting-group">
        <label class="setting-label">Show English translations</label>
        <div class="setting-options" id="translation-options">
          <button class="setting-option ${showTranslations ? 'active' : ''}" data-trans="true">On</button>
          <button class="setting-option ${!showTranslations ? 'active' : ''}" data-trans="false">Off</button>
        </div>
        <p class="setting-hint">Show English translation on sentence exercises</p>
      </div>

      <div class="setting-group">
        <label class="setting-label">Data</label>
        <button class="btn-danger" id="btn-reset">Reset All Progress</button>
        <p class="setting-warning">Warning: Clearing Safari cache will also erase your progress.</p>
      </div>

      <nav class="bottom-nav">
        <button class="nav-btn" data-route="/">Home</button>
        <button class="nav-btn" data-route="/browse">Browse</button>
        <button class="nav-btn" data-route="/reference">Reference</button>
        <button class="nav-btn active" data-route="/settings">Settings</button>
      </nav>
    </div>
  `;

  document.getElementById('npd-slider').addEventListener('input', async (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('npd-value').textContent = val;
    await db.saveSetting('newPerDay', val);
  });

  document.querySelectorAll('.setting-option[data-mode]').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.setting-option[data-mode]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      await db.saveSetting('practiceMode', btn.dataset.mode);
    });
  });

  document.querySelectorAll('.setting-option[data-vmode]').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.setting-option[data-vmode]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      await db.saveSetting('verbTrainingMode', btn.dataset.vmode);
    });
  });

  document.querySelectorAll('.setting-option[data-trans]').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.setting-option[data-trans]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      await db.saveSetting('showTranslations', btn.dataset.trans === 'true');
    });
  });

  document.getElementById('btn-reset').addEventListener('click', async () => {
    if (confirm('This will erase all your learning progress. Are you sure?')) {
      await db.clear();
      router.navigate('/');
    }
  });

  document.getElementById('btn-back').addEventListener('click', () => router.navigate('/'));

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => router.navigate(btn.dataset.route));
  });
}
