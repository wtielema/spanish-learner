export class SRS {
  static newCard(cardId) {
    return {
      cardId,
      easeFactor: 2.5,
      interval: 0,
      repetitions: 0,
      nextReview: new Date().toISOString().split('T')[0],
      history: [],
    };
  }

  static review(card, rating) {
    const updated = { ...card, history: [...card.history] };
    const today = new Date().toISOString().split('T')[0];

    updated.history.push({ date: today, rating });

    let { easeFactor, interval, repetitions } = updated;

    const easeDeltas = { again: -0.3, hard: -0.15, good: 0, easy: 0.15 };
    easeFactor = Math.max(1.3, easeFactor + (easeDeltas[rating] || 0));

    if (rating === 'again') {
      repetitions = 0;
      interval = 1;
    } else {
      repetitions += 1;
      if (repetitions === 1) {
        interval = 1;
      } else if (repetitions === 2) {
        interval = 3;
      } else {
        interval = Math.round(interval * easeFactor);
      }
      if (rating === 'easy') {
        interval = Math.round(interval * 1.3);
      }
    }

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + interval);

    updated.easeFactor = easeFactor;
    updated.interval = interval;
    updated.repetitions = repetitions;
    updated.nextReview = nextDate.toISOString().split('T')[0];

    return updated;
  }

  static getDueCards(cards) {
    const today = new Date().toISOString().split('T')[0];
    return cards.filter(c => c.nextReview <= today);
  }
}
