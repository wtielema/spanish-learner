import { Router } from './router.js';
import { renderDashboard } from './screens/dashboard.js';
import { renderPractice } from './screens/practice.js';
import { renderBrowse } from './screens/browse.js';
import { renderSettings } from './screens/settings.js';
import { renderConjugationRef } from './screens/conjugation-ref.js';

const app = document.getElementById('app');

const router = new Router({
  '/': () => renderDashboard(app, router),
  '/practice': () => {
    const params = new URLSearchParams(window.location.hash.split('?')[1]);
    return renderPractice(app, router, params.get('mode') || 'review');
  },
  '/browse': () => renderBrowse(app, router),
  '/reference': () => renderConjugationRef(app, router),
  '/settings': () => renderSettings(app, router),
});

router.resolve();
