import { DB } from './db.js';
import { generateVerbTrainingCards, normalizeAccents } from './cards.js';

const TENSES = ['present', 'preterite', 'future'];
const SESSION_CAP = 20;
const NEW_VERBS_PER_SESSION = 3;
const TIER_UNLOCK_THRESHOLD = 0.6;

export class VerbSession {
  constructor() {
    this.db = new DB();
    this.cards = [];
    this.current = 0;
    this.verbs = [];
    this.patterns = {};
    this.verbProgressMap = {};
    this.verbTrainingMode = 'auto';
  }

  async init(mode) {
    await this.db.init();

    const [verbsResp, patternsResp] = await Promise.all([
      fetch('data/verbs.json').then(r => r.json()),
      fetch('data/verb-patterns.json').then(r => r.json()),
    ]);

    this.verbs = verbsResp;
    this.patterns = patternsResp;
    this.verbTrainingMode = (await this.db.getSetting('verbTrainingMode')) || 'auto';

    const allVerbProgress = await this.db.getAllVerbProgress();
    this.verbProgressMap = Object.fromEntries(allVerbProgress.map(p => [p.verbId, p]));

    if (mode === 'verb-review') {
      this._buildReviewSession();
    } else {
      this._buildLearnSession();
    }
  }

  _getUnlockedTiers() {
    const tiers = [1]; // Tier 1 always open

    const tier1Verbs = this.verbs.filter(v => v.tier === 1);
    const tier1Mastered = tier1Verbs.filter(v => {
      const p = this.verbProgressMap[v.id];
      return p && p.mastery >= TIER_UNLOCK_THRESHOLD;
    }).length;

    if (tier1Verbs.length > 0 && tier1Mastered / tier1Verbs.length >= TIER_UNLOCK_THRESHOLD) {
      tiers.push(2);

      const tier2Verbs = this.verbs.filter(v => v.tier === 2);
      const tier2Mastered = tier2Verbs.filter(v => {
        const p = this.verbProgressMap[v.id];
        return p && p.mastery >= TIER_UNLOCK_THRESHOLD;
      }).length;

      if (tier2Verbs.length > 0 && tier2Mastered / tier2Verbs.length >= TIER_UNLOCK_THRESHOLD) {
        tiers.push(3);
      }
    }

    return tiers;
  }

  _getExerciseLevel(verbId) {
    if (this.verbTrainingMode === 'mc') return 'mc';
    if (this.verbTrainingMode === 'typing') return 'typing';

    // Auto mode: escalate based on mastery
    const progress = this.verbProgressMap[verbId];
    if (!progress) return 'introduction';

    const mastery = progress.mastery || 0;
    if (mastery < 0.7) return 'mc';
    if (mastery <= 0.85) return 'flashcard';
    return 'typing';
  }

  _buildLearnSession() {
    const unlockedTiers = this._getUnlockedTiers();
    const availableVerbs = this.verbs.filter(v => v.tier && unlockedTiers.includes(v.tier));

    // Find new verbs (no progress yet)
    const newVerbs = availableVerbs.filter(v => !this.verbProgressMap[v.id]);
    const selectedNew = this._shuffle(newVerbs).slice(0, NEW_VERBS_PER_SESSION);

    // Find weak verbs to review (have progress but low mastery)
    const weakVerbs = availableVerbs
      .filter(v => {
        const p = this.verbProgressMap[v.id];
        return p && p.mastery < 0.85;
      })
      .sort((a, b) => (this.verbProgressMap[a.id].mastery || 0) - (this.verbProgressMap[b.id].mastery || 0));
    const selectedWeak = weakVerbs.slice(0, Math.max(0, 5 - selectedNew.length));

    const sessionVerbs = [...selectedNew, ...selectedWeak];
    this._generateCards(sessionVerbs);
  }

  _buildReviewSession() {
    const allWithProgress = this.verbs.filter(v => this.verbProgressMap[v.id]);

    // Sort by mastery (lowest first) and pick verbs that need review
    const dueVerbs = allWithProgress
      .filter(v => {
        const p = this.verbProgressMap[v.id];
        if (!p.nextReview) return true;
        return p.nextReview <= new Date().toISOString().split('T')[0];
      })
      .sort((a, b) => (this.verbProgressMap[a.id].mastery || 0) - (this.verbProgressMap[b.id].mastery || 0));

    let sessionVerbs = dueVerbs.slice(0, 8);

    // Nothing due — fall back to weakest practiced verbs for extra practice
    if (sessionVerbs.length === 0 && allWithProgress.length > 0) {
      sessionVerbs = allWithProgress
        .sort((a, b) => (this.verbProgressMap[a.id].mastery || 0) - (this.verbProgressMap[b.id].mastery || 0))
        .slice(0, 8);
    }

    this._generateCards(sessionVerbs);
  }

  _generateCards(sessionVerbs) {
    let allCards = [];

    for (const verb of sessionVerbs) {
      const level = this._getExerciseLevel(verb.id);
      const cards = generateVerbTrainingCards(verb, level, this.patterns);
      allCards.push(...cards);
    }

    // Interleave by tense: round-robin present/preterite/future cards
    allCards = this._interleaveByTense(allCards);

    // Cap at SESSION_CAP
    this.cards = allCards.slice(0, SESSION_CAP);
  }

  _interleaveByTense(cards) {
    const byTense = { present: [], preterite: [], future: [], other: [] };

    for (const card of cards) {
      const tense = card.tense || 'other';
      if (byTense[tense]) {
        byTense[tense].push(card);
      } else {
        byTense.other.push(card);
      }
    }

    // Shuffle within each tense bucket
    for (const key of Object.keys(byTense)) {
      byTense[key] = this._shuffle(byTense[key]);
    }

    // Round-robin interleave
    const result = [];
    const tenseOrder = ['present', 'preterite', 'future'];
    let idx = { present: 0, preterite: 0, future: 0 };
    let added = true;

    while (added) {
      added = false;
      for (const tense of tenseOrder) {
        if (idx[tense] < byTense[tense].length) {
          result.push(byTense[tense][idx[tense]]);
          idx[tense]++;
          added = true;
        }
      }
    }

    // Append non-tense cards (meaning, pattern, etc.)
    result.push(...byTense.other);

    return result;
  }

  getCurrentCard() {
    return this.cards[this.current] || null;
  }

  async answer(rating) {
    const card = this.cards[this.current];
    if (!card) return;

    // Update verb-level progress
    const verbId = card.wordId;
    let progress = this.verbProgressMap[verbId];

    if (!progress) {
      progress = {
        verbId,
        mastery: 0,
        tenseMastery: { present: 0, preterite: 0, future: 0 },
        tenseTouched: { present: false, preterite: false, future: false },
        totalReviews: 0,
        nextReview: new Date().toISOString().split('T')[0],
        history: [],
      };
    }
    // Ensure tenseTouched exists for older progress records
    if (!progress.tenseTouched) {
      progress.tenseTouched = {
        present: progress.tenseMastery.present > 0,
        preterite: progress.tenseMastery.preterite > 0,
        future: progress.tenseMastery.future > 0,
      };
    }

    // Update tense mastery with exponential moving average
    const ratingScore = { again: 0, hard: 0.4, good: 0.8, easy: 1.0 };
    const score = ratingScore[rating] || 0;
    // Higher alpha early on so progress feels faster, settling down over time
    const reviews = progress.totalReviews || 0;
    const alpha = reviews < 5 ? 0.5 : reviews < 15 ? 0.35 : 0.25;

    const tense = card.tense || 'present';
    if (progress.tenseMastery[tense] !== undefined) {
      progress.tenseMastery[tense] = progress.tenseMastery[tense] * (1 - alpha) + score * alpha;
      progress.tenseTouched[tense] = true;
    }

    // Overall mastery = average of PRACTICED tenses only (don't penalize untouched tenses)
    const touchedTenses = Object.keys(progress.tenseTouched).filter(t => progress.tenseTouched[t]);
    const touchedCount = touchedTenses.length || 1;
    const touchedSum = touchedTenses.reduce((sum, t) => sum + progress.tenseMastery[t], 0);
    // Scale down slightly if not all tenses practiced yet (max 90% if only 1 tense, 95% if 2)
    const tenseCompleteness = touchedCount / 3;
    const scaleFactor = 0.7 + 0.3 * tenseCompleteness;
    progress.mastery = (touchedSum / touchedCount) * scaleFactor;

    progress.totalReviews++;
    progress.history.push({
      date: new Date().toISOString().split('T')[0],
      rating,
      tense,
      cardType: card.exerciseType,
    });

    // Keep history trimmed
    if (progress.history.length > 50) {
      progress.history = progress.history.slice(-50);
    }

    // Calculate next review date based on mastery
    const interval = progress.mastery < 0.3 ? 1
      : progress.mastery < 0.6 ? 3
      : progress.mastery < 0.85 ? 7
      : 14;
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + interval);
    progress.nextReview = nextDate.toISOString().split('T')[0];

    this.verbProgressMap[verbId] = progress;
    await this.db.saveVerbProgress(verbId, progress);

    this.current++;
    return this.getCurrentCard();
  }

  getDistractors(card, count = 3) {
    if (!card.verb) return [];

    const verb = card.verb;
    const correctAnswer = card.back || card.answer;
    const forms = new Set();

    // Collect forms from the same verb (different person/tense)
    for (const tense of TENSES) {
      for (const person of Object.keys(verb.conjugations[tense])) {
        const form = verb.conjugations[tense][person];
        if (form !== correctAnswer) {
          forms.add(form);
        }
      }
    }

    const shuffled = this._shuffle([...forms]);
    return shuffled.slice(0, count);
  }

  getProgress() {
    return { current: this.current, total: this.cards.length };
  }

  getTierProgress() {
    const tiers = {};
    for (const tier of [1, 2, 3]) {
      const tierVerbs = this.verbs.filter(v => v.tier === tier);
      const mastered = tierVerbs.filter(v => {
        const p = this.verbProgressMap[v.id];
        return p && p.mastery >= TIER_UNLOCK_THRESHOLD;
      }).length;
      tiers[tier] = {
        total: tierVerbs.length,
        mastered,
        percent: tierVerbs.length > 0 ? Math.round((mastered / tierVerbs.length) * 100) : 0,
        unlocked: this._getUnlockedTiers().includes(tier),
      };
    }
    return tiers;
  }

  getDueCount() {
    const today = new Date().toISOString().split('T')[0];
    return this.verbs.filter(v => {
      const p = this.verbProgressMap[v.id];
      return p && (!p.nextReview || p.nextReview <= today);
    }).length;
  }

  _shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}
