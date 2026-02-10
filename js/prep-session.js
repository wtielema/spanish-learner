import { DB } from './db.js';
import { SRS } from './srs.js';
import { generatePrepCards } from './cards.js';

const SESSION_CAP = 20;

export class PrepSession {
  constructor() {
    this.db = new DB();
    this.cards = [];
    this.current = 0;
    this.preps = [];
    this._allCards = [];
    this._progressMap = {};
  }

  async init(mode) {
    await this.db.init();

    this.preps = await fetch('data/prepositions.json').then(r => r.json());

    // Generate all possible cards
    this._allCards = this.preps.flatMap(p => generatePrepCards(p, this.preps));

    const allProgress = await this.db.getAllProgress();
    this._progressMap = Object.fromEntries(
      allProgress.filter(p => p.cardId.startsWith('p')).map(p => [p.cardId, p])
    );

    if (mode === 'prep-review') {
      this._buildReviewSession();
    } else {
      this._buildLearnSession();
    }
  }

  _buildLearnSession() {
    const newPerDay = 10;

    // Find prepositions that have NO progress at all (new)
    const newPreps = this.preps.filter(p => {
      const meaningId = `${p.id}-meaning`;
      return !this._progressMap[meaningId];
    });

    // Pick new preps, generate escalation-appropriate cards
    const selectedNewPreps = this._shuffle(newPreps).slice(0, 5);
    let cards = [];

    for (const prep of selectedNewPreps) {
      cards.push(...this._getCardsForPrep(prep));
    }

    // Also add some weak cards from already-started preps
    const weakPreps = this.preps
      .filter(p => {
        const meaningId = `${p.id}-meaning`;
        const prog = this._progressMap[meaningId];
        return prog && prog.easeFactor < 2.3;
      })
      .sort((a, b) => {
        const pa = this._progressMap[`${a.id}-meaning`];
        const pb = this._progressMap[`${b.id}-meaning`];
        return (pa.easeFactor || 2.5) - (pb.easeFactor || 2.5);
      });

    for (const prep of weakPreps.slice(0, 3)) {
      cards.push(...this._getCardsForPrep(prep));
    }

    this.cards = this._shuffle(cards).slice(0, Math.min(SESSION_CAP, newPerDay));
  }

  _buildReviewSession() {
    const today = new Date().toISOString().split('T')[0];

    // Find cards that are due
    const dueCards = this._allCards.filter(card => {
      const prog = this._progressMap[card.id];
      return prog && prog.nextReview <= today;
    });

    if (dueCards.length > 0) {
      // Filter by escalation level
      const filtered = dueCards.filter(card => this._cardAllowedByEscalation(card));
      this.cards = this._shuffle(filtered).slice(0, SESSION_CAP);
    } else {
      // Fallback: weakest practiced cards
      const practicedCards = this._allCards
        .filter(card => this._progressMap[card.id])
        .filter(card => this._cardAllowedByEscalation(card))
        .sort((a, b) => {
          const pa = this._progressMap[a.id];
          const pb = this._progressMap[b.id];
          return (pa.easeFactor || 2.5) - (pb.easeFactor || 2.5);
        });
      this.cards = practicedCards.slice(0, SESSION_CAP);
    }
  }

  _getCardsForPrep(prep) {
    const meaningId = `${prep.id}-meaning`;
    const prog = this._progressMap[meaningId];
    const ease = prog ? prog.easeFactor : 2.5;

    // All cards for this prep
    const allPrepCards = this._allCards.filter(c => c.wordId === prep.id);

    // Exercise escalation based on easeFactor
    return allPrepCards.filter(card => this._cardAllowedByEscalation(card));
  }

  _cardAllowedByEscalation(card) {
    const meaningId = `${card.wordId}-meaning`;
    const prog = this._progressMap[meaningId];
    const ease = prog ? prog.easeFactor : 2.5;

    // Meaning cards always allowed
    if (!card.exerciseType) return true;

    // easeFactor < 2.0: meaning + fill-in-MC only
    if (ease < 2.0) {
      return card.exerciseType === 'prep-fill-mc';
    }
    // 2.0-2.3: + contrastive pairs
    if (ease < 2.3) {
      return card.exerciseType === 'prep-fill-mc' || card.exerciseType === 'prep-contrastive';
    }
    // >= 2.3: all types including typing
    return true;
  }

  getCurrentCard() {
    return this.cards[this.current] || null;
  }

  async answer(rating) {
    const card = this.getCurrentCard();
    if (!card) return;

    let progress = await this.db.getProgress(card.id);
    if (!progress) {
      progress = SRS.newCard(card.id);
    }

    const updated = SRS.review(progress, rating);
    await this.db.saveProgress(card.id, updated);
    this._progressMap[card.id] = updated;

    this.current++;
    return this.getCurrentCard();
  }

  getDistractors(card, count = 3) {
    if (card.distractors) return card.distractors;

    // Build from other prepositions
    const others = this.preps
      .filter(p => p.spanish !== card.answer)
      .map(p => p.spanish);
    return this._shuffle(others).slice(0, count);
  }

  getProgress() {
    return { current: this.current, total: this.cards.length };
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
