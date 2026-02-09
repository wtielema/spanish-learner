export function generateNounCards(noun) {
  return [
    {
      id: `${noun.id}-es`,
      wordId: noun.id,
      type: 'noun',
      subtype: 'meaning',
      front: `${noun.spanish} (${noun.gender === 'm' ? 'el' : 'la'})`,
      back: noun.english,
      direction: 'es-en',
    },
    {
      id: `${noun.id}-en`,
      wordId: noun.id,
      type: 'noun',
      subtype: 'meaning',
      front: noun.english,
      back: `${noun.spanish} (${noun.gender === 'm' ? 'el' : 'la'})`,
      direction: 'en-es',
    },
  ];
}

export function generateVerbCards(verb) {
  const cards = [
    {
      id: `${verb.id}-es`,
      wordId: verb.id,
      type: 'verb',
      subtype: 'meaning',
      front: verb.spanish,
      back: verb.english,
      direction: 'es-en',
    },
    {
      id: `${verb.id}-en`,
      wordId: verb.id,
      type: 'verb',
      subtype: 'meaning',
      front: verb.english,
      back: verb.spanish,
      direction: 'en-es',
    },
  ];

  const persons = ['yo', 'tú', 'él', 'nosotros', 'vosotros', 'ellos'];
  const tenses = ['present', 'preterite', 'future'];

  for (const tense of tenses) {
    for (const person of persons) {
      cards.push({
        id: `${verb.id}-${tense}-${person}`,
        wordId: verb.id,
        type: 'verb',
        subtype: 'conjugation',
        front: `${verb.spanish} — ${person} — ${tense}`,
        back: verb.conjugations[tense][person],
        tense,
        person,
        direction: 'conjugation',
      });
    }
  }

  return cards;
}
