// js/app.js
import { Router } from './router.js';

const app = document.getElementById('app');

function renderHome() {
  app.innerHTML = `
    <h1 style="text-align:center; margin: 40px 0;">Spanish Learner</h1>
    <p style="text-align:center; color: var(--text-secondary);">App is running.</p>
  `;
}

const router = new Router({
  '/': renderHome,
});

router.resolve();
