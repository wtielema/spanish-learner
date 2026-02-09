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

// --- Verb Training Card Generators ---

const PERSONS = ['yo', 'tú', 'él', 'nosotros', 'vosotros', 'ellos'];
const TENSES = ['present', 'preterite', 'future'];
const PERSON_LABELS = {
  'yo': 'yo',
  'tú': 'tú',
  'él': 'él/ella',
  'nosotros': 'nosotros',
  'vosotros': 'vosotros',
  'ellos': 'ellos/ellas'
};
const TENSE_LABELS = {
  'present': 'Present',
  'preterite': 'Preterite',
  'future': 'Future'
};

export function extractStem(infinitive) {
  return infinitive.slice(0, -2);
}

export function normalizeAccents(str) {
  const map = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n', 'ü': 'u' };
  return str.toLowerCase().replace(/[áéíóúñü]/g, c => map[c] || c);
}

export function generateVerbTrainingCards(verb, exerciseLevel, patterns) {
  switch (exerciseLevel) {
    case 'introduction':
      return makeIntroductionCards(verb, patterns);
    case 'mc':
      return makeMCLevelCards(verb, patterns);
    case 'flashcard':
      return makeFlashcardLevelCards(verb, patterns);
    case 'typing':
      return makeTypingLevelCards(verb, patterns);
    default:
      return makeMCLevelCards(verb, patterns);
  }
}

function makeIntroductionCards(verb, patterns) {
  const cards = [];

  // Meaning card
  cards.push({
    id: `vt-${verb.id}-meaning`,
    wordId: verb.id,
    type: 'verb-training',
    exerciseType: 'conjugation-mc',
    subtype: 'meaning',
    front: verb.spanish,
    back: verb.english,
    verb,
    direction: 'es-en',
  });

  // Form recognition (present only) for introduction
  cards.push(...makeFormRecognitionCards(verb, ['present']));

  // MC conjugation for key persons in present
  for (const person of ['yo', 'tú', 'él', 'nosotros']) {
    cards.push({
      id: `vt-${verb.id}-mc-present-${person}`,
      wordId: verb.id,
      type: 'verb-training',
      exerciseType: 'conjugation-mc',
      subtype: 'conjugation',
      front: `${verb.spanish} — ${PERSON_LABELS[person]} — Present`,
      back: verb.conjugations.present[person],
      verb,
      tense: 'present',
      person,
      direction: 'conjugation',
    });
  }

  return cards;
}

function makeMCLevelCards(verb, patterns) {
  const cards = [];

  // Form recognition across all tenses
  cards.push(...makeFormRecognitionCards(verb, TENSES));

  // MC conjugation cards
  for (const tense of TENSES) {
    for (const person of ['yo', 'tú', 'él', 'nosotros']) {
      cards.push({
        id: `vt-${verb.id}-mc-${tense}-${person}`,
        wordId: verb.id,
        type: 'verb-training',
        exerciseType: 'conjugation-mc',
        subtype: 'conjugation',
        front: `${verb.spanish} — ${PERSON_LABELS[person]} — ${TENSE_LABELS[tense]}`,
        back: verb.conjugations[tense][person],
        verb,
        tense,
        person,
        direction: 'conjugation',
      });
    }
  }

  // Fill-in MC if sentences exist
  if (verb.sentences && verb.sentences.length > 0) {
    cards.push(...makeFillInMCCards(verb));
  }

  return cards;
}

function makeFlashcardLevelCards(verb, patterns) {
  const cards = [];

  // Flashcard conjugation
  for (const tense of TENSES) {
    for (const person of ['yo', 'tú', 'él', 'nosotros']) {
      cards.push({
        id: `vt-${verb.id}-flash-${tense}-${person}`,
        wordId: verb.id,
        type: 'verb-training',
        exerciseType: 'flashcard-conjugation',
        subtype: 'conjugation',
        front: `${verb.spanish} — ${PERSON_LABELS[person]} — ${TENSE_LABELS[tense]}`,
        back: verb.conjugations[tense][person],
        verb,
        tense,
        person,
        direction: 'conjugation',
      });
    }
  }

  // Fill-in MC
  if (verb.sentences && verb.sentences.length > 0) {
    cards.push(...makeFillInMCCards(verb));
  }

  // Pattern match
  if (verb.pattern && patterns) {
    cards.push(makePatternMatchCard(verb, patterns));
  }

  return cards;
}

function makeTypingLevelCards(verb, patterns) {
  const cards = [];

  // Typed production
  cards.push(...makeProductionCards(verb));

  // Sentence fill-in typing
  if (verb.sentences && verb.sentences.length > 0) {
    cards.push(...makeFillInTypingCards(verb));
  }

  return cards;
}

export function makeFormRecognitionCards(verb, tenses) {
  const cards = [];

  for (const tense of tenses) {
    // Person identification: show form, guess who
    for (const person of ['yo', 'él', 'nosotros']) {
      cards.push({
        id: `vt-${verb.id}-fr-person-${tense}-${person}`,
        wordId: verb.id,
        type: 'verb-training',
        exerciseType: 'form-recognition',
        subtype: 'person-id',
        prompt: verb.conjugations[tense][person],
        answer: person,
        verb,
        tense,
        person,
        options: PERSONS.map(p => ({ value: p, label: PERSON_LABELS[p] })),
      });
    }

    // Tense identification: show form, guess when
    cards.push({
      id: `vt-${verb.id}-fr-tense-${tense}-yo`,
      wordId: verb.id,
      type: 'verb-training',
      exerciseType: 'form-recognition',
      subtype: 'tense-id',
      prompt: verb.conjugations[tense].yo,
      answer: tense,
      verb,
      tense,
      person: 'yo',
      options: TENSES.map(t => ({ value: t, label: TENSE_LABELS[t] })),
    });
  }

  return cards;
}

export function makeProductionCards(verb) {
  const cards = [];

  for (const tense of TENSES) {
    for (const person of ['yo', 'tú', 'él', 'nosotros']) {
      cards.push({
        id: `vt-${verb.id}-prod-${tense}-${person}`,
        wordId: verb.id,
        type: 'verb-training',
        exerciseType: 'production',
        subtype: 'typed-conjugation',
        prompt: `${verb.spanish} — ${PERSON_LABELS[person]} — ${TENSE_LABELS[tense]}`,
        answer: verb.conjugations[tense][person],
        verb,
        tense,
        person,
        stem: extractStem(verb.spanish),
      });
    }
  }

  return cards;
}

export function makeFillInMCCards(verb) {
  if (!verb.sentences) return [];

  return verb.sentences.map((sentence, i) => {
    // Build distractors from same verb's other forms
    const distractors = [];
    for (const t of TENSES) {
      for (const p of PERSONS) {
        const form = verb.conjugations[t][p];
        if (form !== sentence.answer && !distractors.includes(form)) {
          distractors.push(form);
        }
      }
    }
    const shuffledDistractors = distractors.sort(() => Math.random() - 0.5).slice(0, 3);

    return {
      id: `vt-${verb.id}-fillin-mc-${i}`,
      wordId: verb.id,
      type: 'verb-training',
      exerciseType: 'fill-in-mc',
      subtype: 'sentence-fill',
      sentence: sentence.text,
      sentenceEn: sentence.en || '',
      answer: sentence.answer,
      verb,
      tense: sentence.tense,
      person: sentence.person,
      distractors: shuffledDistractors,
    };
  });
}

export function makeFillInTypingCards(verb) {
  if (!verb.sentences) return [];

  return verb.sentences.map((sentence, i) => ({
    id: `vt-${verb.id}-fillin-type-${i}`,
    wordId: verb.id,
    type: 'verb-training',
    exerciseType: 'fill-in-typing',
    subtype: 'sentence-fill',
    sentence: sentence.text,
    sentenceEn: sentence.en || '',
    answer: sentence.answer,
    verb,
    tense: sentence.tense,
    person: sentence.person,
    stem: extractStem(verb.spanish),
  }));
}

export function makePatternMatchCard(verb, patterns) {
  const patternNames = Object.keys(patterns);
  const correctPattern = verb.pattern;
  const otherPatterns = patternNames.filter(p => p !== correctPattern);
  const shuffledOthers = otherPatterns.sort(() => Math.random() - 0.5).slice(0, 3);
  const options = [correctPattern, ...shuffledOthers].sort(() => Math.random() - 0.5);

  return {
    id: `vt-${verb.id}-pattern`,
    wordId: verb.id,
    type: 'verb-training',
    exerciseType: 'pattern-match',
    subtype: 'pattern-id',
    prompt: `${verb.spanish} → ${verb.conjugations.present.yo}`,
    answer: correctPattern,
    verb,
    options: options.map(p => ({ value: p, label: patterns[p].name })),
    patterns,
  };
}
