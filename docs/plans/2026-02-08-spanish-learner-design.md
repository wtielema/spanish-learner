# Spanish Vocabulary Learner — Design Document

**Date:** 2026-02-08
**Status:** Approved

## Overview

A Progressive Web App for learning the top 1000 Spanish nouns and top 100 verbs, optimized for offline use on iPhone/iPad during flights.

## Tech Stack

- **HTML/CSS/JavaScript** — vanilla, no framework
- **Service Worker** — caches all assets for full offline functionality
- **IndexedDB** — stores progress, stats, and spaced repetition state on-device
- **Static JSON** — bundled word lists
- **No backend** — everything runs and persists locally

Target: Safari on iOS (iPhone + iPad).

## Content

- **1000 nouns** — sourced from Spanish frequency lists, with gender and plural
- **100 verbs** — with conjugations for present, preterite, and future tenses (6 persons each)

### Data Models

**Noun:**
```json
{
  "id": "n001",
  "spanish": "tiempo",
  "english": "time",
  "gender": "m",
  "plural": "tiempos"
}
```

**Verb:**
```json
{
  "id": "v001",
  "spanish": "hablar",
  "english": "to speak",
  "conjugations": {
    "present": { "yo": "hablo", "tú": "hablas", "él": "habla", "nosotros": "hablamos", "vosotros": "habláis", "ellos": "hablan" },
    "preterite": { "yo": "hablé", "tú": "hablaste", "él": "habló", "nosotros": "hablamos", "vosotros": "hablasteis", "ellos": "hablaron" },
    "future": { "yo": "hablaré", "tú": "hablarás", "él": "hablará", "nosotros": "hablaremos", "vosotros": "hablaréis", "ellos": "hablarán" }
  }
}
```

**Progress record (per card):**
```json
{
  "cardId": "n001",
  "easeFactor": 2.5,
  "interval": 4,
  "nextReview": "2026-02-12",
  "repetitions": 3,
  "history": [
    { "date": "2026-02-08", "rating": "good", "mode": "flashcard" }
  ]
}
```

### Card Generation

- Each noun produces 2 cards (Spanish→English, English→Spanish)
- Each verb produces 2 meaning cards + 18 conjugation cards (6 persons x 3 tenses)
- Total: ~2000 noun cards + ~2000 verb cards

## Learning Modes

### Flashcard Mode (primary)
- Card shows a Spanish word
- User taps to reveal the answer
- Rates themselves: **Again** / **Hard** / **Good** / **Easy**
- Rating feeds the spaced repetition algorithm

### Multiple Choice Mode
- A Spanish word appears with 4 English options (or vice versa)
- Correct/incorrect feeds back into spaced repetition scores
- Available as quick-fire rounds for variety

### Spaced Repetition Engine
- Based on simplified SM-2 algorithm (as used by Anki)
- Each card tracks: interval, ease factor, next review date
- Words you struggle with appear more frequently
- New words introduced gradually (configurable: 5-30 per day, default 10)

### Verb Card Behavior
- First learn the infinitive + meaning
- Then conjugation cards: shown "hablar — yo — preterite", recall "hablé"
- Conjugation cards grouped by tense

## UI Screens

Four screens, dark mode focused:

### 1. Home / Dashboard
- Stats at a glance: words learned, review streak, today's progress, accuracy
- Two main buttons: "Start Review" and "Learn New Words"

### 2. Practice Screen
- Top bar shows progress (e.g., "12 / 30 cards")
- Card flips on tap (flashcard) or shows 4 options (multiple choice)
- Rating buttons appear after reveal

### 3. Word List / Browse
- Scrollable, searchable list of all words
- Color-coded mastery level per word (red → yellow → green)
- Tap to see full details and history

### 4. Settings
- New words per day (slider: 5-30)
- Preferred mode (flashcard / multiple choice / mixed)
- Reset progress

### Design Principles
- Large tap targets (airplane turbulence)
- High contrast white text on dark background
- No battery-draining animations
- Works in portrait and landscape

## Offline & Installation

### Service Worker
- First visit caches all HTML, CSS, JS, and JSON word lists
- App works 100% offline after first load
- All user data in IndexedDB, never leaves device

### Install Flow
- Visit URL in Safari → Share → Add to Home Screen
- Launches full-screen with custom icon, no browser chrome
- `manifest.json` provides app name, icon, theme color

### Data Safety
- Progress survives closing/reopening
- Warning in Settings: clearing Safari cache wipes data
- Future: "Export Progress" button (JSON file)
