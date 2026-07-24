/**
 * i18n.js — UI string constants for the photosphere guessing game.
 *
 * English-only for MVP. Structured as a lookup table so adding
 * another language in the future means adding a new key to LANG
 * and populating one mapping object per language block.
 */

const LANG = {
    // ── Game chrome ─────────────────────────────────────────────────────
    guessHere:       '🔍 Guess Here!',
    guessesRemaining: (n) => `${n} guess${n === 1 ? '' : 'es'} remaining`,
    hintButton:      '💡 Hint',
    playAgain:       '🔄 Play Again',
    findMore:        'Find More Games',
    learnMore:       'Learn more on Wikipedia →',

    // ── Feedback: correct ──────────────────────────────────────────────
    correctDefaultTitle: '🎉 Correct!',

    // ── Feedback: incorrect ────────────────────────────────────────────
    genericMiss:     'Nothing special here — keep looking!',
    outOfGuesses:    '😔 Out of guesses!',
    answerWas:       'The answer was:',

    // ── Score card ─────────────────────────────────────────────────────
    scoreFirstTry:   'First try!',
    scoreSecondTry:  'Second try!',
    scoreThirdTry:   'Got it on the last guess!',
    scoreFailed:     'Better luck next time!',

    // ── Loading / errors ───────────────────────────────────────────────
    loading:         'Loading photosphere…',
    loadingGame:     'Loading game…',
    errorNoPage:     'No game page specified. Add ?page=User:Example/MyGame to the URL.',
    errorBadJSON:    'The game data is not valid JSON.',
    errorNoGame:     'No game data found on this page.',
    errorNoPrompt:   'Game data is missing a prompt.',
    errorNoAnswer:   'Game data is missing an answer zone.',
    errorLoad:       'Failed to load the game.',
    errorViewer:     'Pannellum viewer error:',

    // ── Mobile ──────────────────────────────────────────────────────────
    mobileHint:      'Center the crosshair on your guess, then tap the button',
};

// Export for use in <script> tags (global) and ES module importers
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LANG };
}
