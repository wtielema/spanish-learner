import { DB } from './db.js';
import { SRS } from './srs.js';
import { generateNounCards, generateVerbCards } from './cards.js';

export class Session {
  constructor() {
    this.db = new DB();
    this.cards = [];
    this.current = 0;
    this._allCards = [];
  }

  async init(mode) {
    await this.db.init();

    const [nounsResp, verbsResp] = await Promise.all([
      fetch('data/nouns.json').then(r => r.json()),
      fetch('data/verbs.json').then(r => r.json()),
    ]);

    this._allCards = [
      ...nounsResp.flatMap(generateNounCards),
      ...verbsResp.flatMap(generateVerbCards),
    ];

    const allProgress = await this.db.getAllProgress();
    const progressMap = Object.fromEntries(allProgress.map(p => [p.cardId, p]));

    if (mode === 'review') {
      const dueCards = this._allCards.filter(card => {
        const progress = progressMap[card.id];
        return progress && SRS.getDueCards([progress]).length > 0;
      });
      this.cards = this._shuffle(dueCards).slice(0, 30);
    } else {
      const newPerDay = (await this.db.getSetting('newPerDay')) || 10;
      const newCards = this._allCards.filter(card => !progressMap[card.id]);
      this.cards = this._shuffle(newCards).slice(0, newPerDay);
    }
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

    this.current++;
    return this.getCurrentCard();
  }

  getDistractors(card, count = 3) {
    const others = this._allCards
      .filter(c => c.type === card.type && c.id !== card.id && c.direction === card.direction)
      .map(c => c.back);
    const shuffled = this._shuffle([...new Set(others)]);
    return shuffled.slice(0, count);
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
