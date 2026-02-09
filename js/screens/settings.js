import { DB } from '../db.js';

export async function renderSettings(app, router) {
  const db = new DB();
  await db.init();

  const newPerDay = (await db.getSetting('newPerDay')) || 10;
  const practiceMode = (await db.getSetting('practiceMode')) || 'mixed';

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
        <label class="setting-label">Data</label>
        <button class="btn-danger" id="btn-reset">Reset All Progress</button>
        <p class="setting-warning">Warning: Clearing Safari cache will also erase your progress.</p>
      </div>

      <nav class="bottom-nav">
        <button class="nav-btn" data-route="/">Home</button>
        <button class="nav-btn" data-route="/browse">Browse</button>
        <button class="nav-btn active" data-route="/settings">Settings</button>
      </nav>
    </div>
  `;

  document.getElementById('npd-slider').addEventListener('input', async (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('npd-value').textContent = val;
    await db.saveSetting('newPerDay', val);
  });

  document.querySelectorAll('.setting-option').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.setting-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      await db.saveSetting('practiceMode', btn.dataset.mode);
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
