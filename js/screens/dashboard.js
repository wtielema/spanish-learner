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
      <div class="dashboard-actions">
        <button class="btn-primary" id="btn-review">Start Review${dueNow > 0 ? ` (${dueNow})` : ''}</button>
        <button class="btn-secondary" id="btn-learn" style="margin-top: 12px;">Learn New Words</button>
      </div>
      <nav class="bottom-nav">
        <button class="nav-btn active" data-route="/">Home</button>
        <button class="nav-btn" data-route="/browse">Browse</button>
        <button class="nav-btn" data-route="/settings">Settings</button>
      </nav>
    </div>
  `;

  document.getElementById('btn-review').addEventListener('click', () => {
    router.navigate('/practice?mode=review');
  });

  document.getElementById('btn-learn').addEventListener('click', () => {
    router.navigate('/practice?mode=learn');
  });

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => router.navigate(btn.dataset.route));
  });
}
