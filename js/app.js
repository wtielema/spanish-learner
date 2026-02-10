import { Router } from './router.js';
import { renderDashboard } from './screens/dashboard.js';
import { renderPractice } from './screens/practice.js';
import { renderBrowse } from './screens/browse.js';
import { renderSettings } from './screens/settings.js';
import { renderConjugationRef } from './screens/conjugation-ref.js';
import { renderProgress } from './screens/progress.js';
import { renderSpeedRound } from './screens/speed-round.js';
import { renderParadigmDrill } from './screens/paradigm-drill.js';

const app = document.getElementById('app');

const router = new Router({
  '/': () => renderDashboard(app, router),
  '/practice': () => {
    const params = new URLSearchParams(window.location.hash.split('?')[1]);
    return renderPractice(app, router, params.get('mode') || 'review');
  },
  '/browse': () => renderBrowse(app, router),
  '/reference': () => renderConjugationRef(app, router),
  '/progress': () => renderProgress(app, router),
  '/settings': () => renderSettings(app, router),
  '/speed-round': () => renderSpeedRound(app, router),
  '/paradigm-drill': () => renderParadigmDrill(app, router),
});

router.resolve();
