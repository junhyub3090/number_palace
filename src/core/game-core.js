(function attachCore(global) {
  const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const SCORE_BY_STRIKES = [0, 100, 300, 700];

  function clampRandom(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(0.999999, value));
  }

  function randomIndex(rng, length) {
    return Math.floor(clampRandom(rng()) * length);
  }

  function pickDistinct(pool, count, rng) {
    const remaining = pool.slice();
    const picked = [];

    while (picked.length < count && remaining.length > 0) {
      const index = randomIndex(rng, remaining.length);
      picked.push(remaining.splice(index, 1)[0]);
    }

    return picked;
  }

  function createSecret(rng) {
    const random = rng || Math.random;
    return [
      DIGITS[randomIndex(random, DIGITS.length)],
      DIGITS[randomIndex(random, DIGITS.length)],
      DIGITS[randomIndex(random, DIGITS.length)],
    ];
  }

  function createWave(rng, excludedDigits) {
    const random = rng || Math.random;
    const excluded = new Set(excludedDigits || []);
    let pool = DIGITS.filter((digit) => !excluded.has(digit));

    if (pool.length < 3) {
      pool = DIGITS.slice();
    }

    const emptyLane = randomIndex(random, 4);
    const digits = pickDistinct(pool, 3, random);
    let digitIndex = 0;

    return {
      items: [0, 1, 2, 3].map((lane) => {
        if (lane === emptyLane) {
          return { lane, kind: "empty" };
        }

        return {
          lane,
          kind: "digit",
          value: digits[digitIndex++],
        };
      }),
    };
  }

  function scoreGuess(secret, guess) {
    const remaining = secret.slice();
    const matchedDigits = [];
    const missedDigits = [];

    guess.forEach((digit) => {
      const index = remaining.indexOf(digit);
      if (index !== -1) {
        matchedDigits.push(digit);
        remaining.splice(index, 1);
      } else {
        missedDigits.push(digit);
      }
    });

    return { strikes: matchedDigits.length, balls: 0, matchedDigits, missedDigits };
  }

  function scoreGuessPoints(strikes) {
    return SCORE_BY_STRIKES[strikes] || 0;
  }

  function countDigits(digits) {
    return digits.reduce((counts, digit) => {
      counts[digit] = (counts[digit] || 0) + 1;
      return counts;
    }, {});
  }

  function expandKnownDigits(counts) {
    return DIGITS.flatMap((digit) => {
      const count = counts[digit] || 0;
      return Array.from({ length: count }, () => digit);
    }).slice(0, 3);
  }

  function updateKnownDigits(currentKnownDigits, matchedDigits, secret) {
    const knownCounts = countDigits(currentKnownDigits || []);
    const matchedCounts = countDigits(matchedDigits || []);
    const secretCounts = countDigits(secret || []);

    DIGITS.forEach((digit) => {
      const nextCount = Math.max(knownCounts[digit] || 0, matchedCounts[digit] || 0);
      knownCounts[digit] = Math.min(nextCount, secretCounts[digit] || 0);
    });

    return expandKnownDigits(knownCounts);
  }

  function updateRejectedDigits(currentRejectedDigits, missedDigits, secret) {
    const rejected = new Set(currentRejectedDigits || []);
    const secretSet = new Set(secret || []);

    (missedDigits || []).forEach((digit) => {
      if (!secretSet.has(digit)) {
        rejected.add(digit);
      }
    });

    return DIGITS.filter((digit) => rejected.has(digit));
  }

  function sortHistoryForDisplay(history) {
    return history
      .map((entry, index) => ({ entry, index }))
      .sort((left, right) => {
        if (right.entry.strikes !== left.entry.strikes) {
          return right.entry.strikes - left.entry.strikes;
        }

        return left.index - right.index;
      })
      .map((item) => item.entry);
  }

  function createGameState(options) {
    const settings = options || {};
    const secret = settings.secret
      ? settings.secret.slice(0, 3)
      : createSecret(settings.rng || Math.random);

    return {
      secret,
      currentGuess: [],
      history: [],
      knownDigits: (settings.knownDigits || []).slice(0, 3),
      lastResult: null,
      rejectedDigits: (settings.rejectedDigits || []).slice(),
      score: settings.score || 0,
      solvedCount: settings.solvedCount || 0,
      solvedSecrets: (settings.solvedSecrets || []).map((secretEntry) => secretEntry.slice()),
      totalGuesses: settings.totalGuesses || 0,
    };
  }

  function collectDigit(state, digit, options) {
    const settings = options || {};
    const nextGuess = state.currentGuess.concat(digit);
    const nextState = {
      secret: state.secret.slice(),
      currentGuess: nextGuess,
      history: state.history.slice(),
      knownDigits: state.knownDigits.slice(),
      lastResult: state.lastResult,
      rejectedDigits: state.rejectedDigits.slice(),
      score: state.score,
      solvedCount: state.solvedCount,
      solvedSecrets: state.solvedSecrets.map((secretEntry) => secretEntry.slice()),
      totalGuesses: state.totalGuesses,
    };

    if (nextGuess.length === 3) {
      const score = scoreGuess(nextState.secret, nextGuess);
      const points = scoreGuessPoints(score.strikes);
      const entry = {
        guess: nextGuess.slice(),
        strikes: score.strikes,
        balls: score.balls,
        matchedDigits: score.matchedDigits.slice(),
        missedDigits: score.missedDigits.slice(),
        points,
        secret: nextState.secret.slice(),
      };

      nextState.score += points;
      nextState.totalGuesses += 1;
      nextState.lastResult = entry;
      nextState.knownDigits = updateKnownDigits(
        nextState.knownDigits,
        score.matchedDigits,
        nextState.secret,
      );
      nextState.rejectedDigits = updateRejectedDigits(
        nextState.rejectedDigits,
        score.missedDigits,
        nextState.secret,
      );
      nextState.currentGuess = [];

      if (score.strikes === 3) {
        nextState.solvedCount += 1;
        nextState.solvedSecrets = [entry.secret.slice()].concat(nextState.solvedSecrets);
        nextState.secret = createSecret(settings.rng || Math.random);
        nextState.knownDigits = [];
        nextState.rejectedDigits = [];
        nextState.history = [];
      } else {
        nextState.history = [entry].concat(nextState.history);
      }
    }

    return nextState;
  }

  const api = {
    DIGITS,
    collectDigit,
    createGameState,
    createSecret,
    createWave,
    scoreGuess,
    scoreGuessPoints,
    sortHistoryForDisplay,
    updateKnownDigits,
    updateRejectedDigits,
  };

  global.RunningBaseballCore = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
