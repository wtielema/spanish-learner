export async function renderConjugationRef(app, router) {
  let verbs = [];
  let patterns = {};
  let preps = [];
  try {
    [verbs, patterns, preps] = await Promise.all([
      fetch('data/verbs.json').then(r => r.json()),
      fetch('data/verb-patterns.json').then(r => r.json()),
      fetch('data/prepositions.json').then(r => r.json()).catch(() => []),
    ]);
  } catch (e) { /* offline fallback */ }

  const PERSONS = ['yo', 'tú', 'él', 'nosotros', 'vosotros', 'ellos'];
  const TENSES = ['present', 'preterite', 'future'];
  const TENSE_LABELS = { present: 'Present', preterite: 'Preterite', future: 'Future' };

  const patternOrder = [
    'regular-ar', 'regular-er', 'regular-ir',
    'stem-e-ie', 'stem-o-ue', 'stem-e-i',
    'yo-irreg', 'irregular',
  ];

  const tierNames = { 1: 'Tier 1 — Regular', 2: 'Tier 2 — Stem-Changing', 3: 'Tier 3 — Irregular' };
  const patternTier = {
    'regular-ar': 1, 'regular-er': 1, 'regular-ir': 1,
    'stem-e-ie': 2, 'stem-o-ue': 2, 'stem-e-i': 2,
    'yo-irreg': 3, 'irregular': 3,
  };

  function getExampleVerb(patternId) {
    const p = patterns[patternId];
    if (!p) return null;
    return verbs.find(v => v.spanish === p.example) || verbs.find(v => v.pattern === patternId);
  }

  function renderEndingsTable(patternId) {
    const p = patterns[patternId];
    if (!p) return '';
    const exVerb = getExampleVerb(patternId);

    return TENSES.map(tense => {
      const endings = p.endings[tense];
      const rows = PERSONS.map(person => {
        const ending = endings[person] || '—';
        const form = exVerb ? (exVerb.conjugations[tense][person] || '—') : '';
        const isStemChange = p.stemChangePersons.includes(person);
        return `<tr class="${isStemChange ? 'ref-stem-change' : ''}">
          <td class="ref-person">${person}</td>
          <td class="ref-ending">${ending}</td>
          <td class="ref-form">${form}</td>
        </tr>`;
      }).join('');

      return `
        <div class="ref-tense-block">
          <h4 class="ref-tense-title">${TENSE_LABELS[tense]}</h4>
          <table class="ref-table">
            <thead><tr><th>Person</th><th>Ending</th><th>${exVerb ? exVerb.spanish : 'Example'}</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    }).join('');
  }

  function renderPatternSection(patternId) {
    const p = patterns[patternId];
    if (!p) return '';
    const verbCount = verbs.filter(v => v.pattern === patternId).length;

    return `
      <div class="ref-pattern-card" id="pattern-${patternId}">
        <div class="ref-pattern-header">
          <h3 class="ref-pattern-name">${p.name}</h3>
          <span class="ref-verb-count">${verbCount} verbs</span>
        </div>
        <p class="ref-pattern-desc">${p.description}</p>
        ${p.stemChangePersons.length > 0 ? `<p class="ref-stem-note">Stem changes in: <strong>${p.stemChangePersons.join(', ')}</strong></p>` : ''}
        <div class="ref-tenses-grid">
          ${renderEndingsTable(patternId)}
        </div>
      </div>
    `;
  }

  // Group patterns by tier
  let currentTier = 0;
  let sectionsHTML = '';

  for (const patternId of patternOrder) {
    const tier = patternTier[patternId];
    if (tier !== currentTier) {
      if (currentTier !== 0) sectionsHTML += '</div>'; // close prev tier
      sectionsHTML += `<div class="ref-tier-section"><h2 class="ref-tier-title">${tierNames[tier]}</h2>`;
      currentTier = tier;
    }
    sectionsHTML += renderPatternSection(patternId);
  }
  sectionsHTML += '</div>'; // close last tier

  // Quick rules summary
  const quickRules = `
    <div class="ref-quick-rules">
      <h2 class="ref-section-title">Quick Rules</h2>
      <div class="ref-rule-card">
        <h4>Regular Verbs</h4>
        <p>Remove -ar/-er/-ir ending to get the stem, then add the endings for each tense and person.</p>
        <p class="ref-example">hablar → habl- + -o = <strong>hablo</strong></p>
      </div>
      <div class="ref-rule-card">
        <h4>Stem-Changing Verbs</h4>
        <p>The stem vowel changes in stressed positions (all persons except nosotros and vosotros in present tense).</p>
        <p class="ref-example">pensar (e→ie): pi<strong>e</strong>nso, pi<strong>e</strong>nsas, pero pensamos</p>
      </div>
      <div class="ref-rule-card">
        <h4>Future Tense</h4>
        <p>Add endings to the full infinitive (not the stem). Same endings for -ar, -er, and -ir verbs: -é, -ás, -á, -emos, -éis, -án.</p>
        <p class="ref-example">hablar + -é = <strong>hablaré</strong></p>
      </div>
      <div class="ref-rule-card">
        <h4>Yo-form Irregulars</h4>
        <p>Only the yo form is irregular in present tense (-go or -zco). Other persons follow regular patterns.</p>
        <p class="ref-example">tener → <strong>tengo</strong>, but tienes, tiene, tenemos...</p>
      </div>
      <div class="ref-rule-card">
        <h4>Accent Marks</h4>
        <p>Preterite yo and él forms always carry accent marks on regular verbs: -é/-í (yo), -ó/-ió (él). Future tense accents on all persons except nosotros.</p>
      </div>
    </div>
  `;

  // Preposition reference section
  const porPrep = preps.find(p => p.spanish === 'por');
  const paraPrep = preps.find(p => p.spanish === 'para');

  const porParaSection = (porPrep && paraPrep) ? `
    <div class="ref-quick-rules">
      <h2 class="ref-section-title">Key Distinctions</h2>
      <div class="ref-pattern-card" id="prep-por-para">
        <div class="ref-pattern-header">
          <h3 class="ref-pattern-name">Por vs Para</h3>
        </div>
        <p class="ref-pattern-desc">The most commonly confused pair. Both translate to "for" in English, but have distinct uses.</p>
        <div class="ref-por-para-grid">
          <div class="ref-por-para-col">
            <div class="ref-tense-block">
              <h4 class="ref-tense-title" style="color: var(--accent);">Por</h4>
              ${porPrep.usages.map(u => `
                <div class="ref-prep-usage">
                  <span class="ref-prep-usage-label">${u.meaning}</span>
                  <span class="ref-prep-usage-ex">${u.example}</span>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="ref-por-para-col">
            <div class="ref-tense-block">
              <h4 class="ref-tense-title" style="color: var(--success);">Para</h4>
              ${paraPrep.usages.map(u => `
                <div class="ref-prep-usage">
                  <span class="ref-prep-usage-label">${u.meaning}</span>
                  <span class="ref-prep-usage-ex">${u.example}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
      <div class="ref-rule-card">
        <h4>Personal "a"</h4>
        <p>Use <strong>a</strong> before a person when they are the direct object of a verb.</p>
        <p class="ref-example">Veo <strong>a</strong> mi madre. — I see my mother.</p>
      </div>
      <div class="ref-rule-card">
        <h4>Contractions</h4>
        <p><strong>a + el = al</strong> and <strong>de + el = del</strong> are the only two contractions in Spanish.</p>
        <p class="ref-example">Voy <strong>al</strong> parque. — Viene <strong>del</strong> mercado.</p>
      </div>
    </div>
  ` : '';

  function renderPrepCard(prep) {
    const hasCollocations = prep.collocations && prep.collocations.length > 0;
    return `
      <div class="ref-pattern-card" id="prep-${prep.id}">
        <div class="ref-pattern-header">
          <h3 class="ref-pattern-name">${prep.spanish}</h3>
          <span class="ref-verb-count">${prep.primaryMeaning}</span>
        </div>
        <div class="ref-tenses-grid">
          <div class="ref-tense-block">
            <h4 class="ref-tense-title">Usages</h4>
            <table class="ref-table">
              <thead><tr><th>Meaning</th><th>Example</th></tr></thead>
              <tbody>
                ${prep.usages.map(u => `
                  <tr>
                    <td class="ref-prep-usage-label">${u.meaning}</td>
                    <td><span class="ref-prep-usage-ex">${u.example}</span><br><span class="ref-prep-usage-en">${u.exampleEn}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ${hasCollocations ? `
            <div class="ref-tense-block">
              <h4 class="ref-tense-title">Collocations</h4>
              <table class="ref-table">
                <thead><tr><th>Expression</th><th>Example</th></tr></thead>
                <tbody>
                  ${prep.collocations.map(c => `
                    <tr>
                      <td><span class="ref-ending">${c.verb} ${prep.spanish}</span><br><span class="ref-prep-usage-en">${c.meaning}</span></td>
                      <td class="ref-prep-usage-ex">${c.example}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  const prepCommon = preps.filter(p => ['a','de','en','con','por','para','sin','entre'].includes(p.spanish));
  const prepIntermediate = preps.filter(p => ['desde','hasta','hacia','sobre','contra','durante','según','tras'].includes(p.spanish));
  const prepLessCom = preps.filter(p => ['ante','bajo','mediante','excepto','salvo','versus','vía'].includes(p.spanish));

  const prepSectionsHTML = `
    <div class="ref-tier-section">
      <h2 class="ref-tier-title">Common Prepositions</h2>
      ${prepCommon.map(renderPrepCard).join('')}
    </div>
    <div class="ref-tier-section">
      <h2 class="ref-tier-title">Intermediate Prepositions</h2>
      ${prepIntermediate.map(renderPrepCard).join('')}
    </div>
    <div class="ref-tier-section">
      <h2 class="ref-tier-title">Less Common Prepositions</h2>
      ${prepLessCom.map(renderPrepCard).join('')}
    </div>
  `;

  // Top-level tab state
  let activeTab = 'verbs'; // verbs | prepositions

  function renderPage() {
    app.innerHTML = `
      <div class="conjugation-ref">
        <div class="ref-header">
          <button class="practice-close" id="ref-back">&larr;</button>
          <h1 class="ref-title">Reference</h1>
        </div>
        <div class="ref-tab-bar">
          <button class="ref-tab ${activeTab === 'verbs' ? 'active' : ''}" data-tab="verbs">Conjugations</button>
          <button class="ref-tab ${activeTab === 'prepositions' ? 'active' : ''}" data-tab="prepositions">Prepositions</button>
        </div>
        ${activeTab === 'verbs' ? `
          ${quickRules}
          <h2 class="ref-section-title" style="margin-top: 32px;">All Patterns</h2>
          <div class="ref-nav-chips">
            ${patternOrder.map(id => `<button class="ref-chip" data-target="pattern-${id}">${patterns[id]?.name || id}</button>`).join('')}
          </div>
          ${sectionsHTML}
        ` : `
          ${porParaSection}
          <h2 class="ref-section-title" style="margin-top: 24px;">All Prepositions</h2>
          <div class="ref-nav-chips">
            ${preps.map(p => `<button class="ref-chip" data-target="prep-${p.id}">${p.spanish}</button>`).join('')}
          </div>
          ${prepSectionsHTML}
        `}
        <div style="height: 80px;"></div>
        <nav class="bottom-nav">
          <button class="nav-btn" data-route="/">Home</button>
          <button class="nav-btn" data-route="/browse">Browse</button>
          <button class="nav-btn active" data-route="/reference">Reference</button>
          <button class="nav-btn" data-route="/progress">Progress</button>
          <button class="nav-btn" data-route="/settings">Settings</button>
        </nav>
      </div>
    `;

    document.getElementById('ref-back').addEventListener('click', () => router.navigate('/'));

    document.querySelectorAll('.ref-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        activeTab = tab.dataset.tab;
        renderPage();
      });
    });

    document.querySelectorAll('.ref-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const target = document.getElementById(chip.dataset.target);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => router.navigate(btn.dataset.route));
    });
  }

  renderPage();

}
