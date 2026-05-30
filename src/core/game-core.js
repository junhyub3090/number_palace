(function attachCore(global) {
  const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

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

  function normalizeGenerationOptions(options) {
    if (typeof options === "function") {
      return {
        allowDuplicates: false,
        digitMax: 9,
        rng: options,
      };
    }

    const settings = options || {};
    return {
      allowDuplicates: Boolean(settings.allowDuplicates),
      digitMax: Number.isFinite(settings.digitMax) ? settings.digitMax : 9,
      rng: settings.rng || Math.random,
    };
  }

  function digitPool(digitMax) {
    return DIGITS.filter((digit) => digit <= digitMax);
  }

  function createDigitBag(options) {
    const settings = normalizeGenerationOptions(options || {});
    const copies = Math.max(1, Math.floor(Number(options && options.copies) || 3));
    const bag = [];

    digitPool(settings.digitMax).forEach((digit) => {
      for (let index = 0; index < copies; index += 1) {
        bag.push(digit);
      }
    });

    return bag;
  }

  function uniqueDigitsInBag(bag) {
    const unique = [];

    (bag || []).forEach((digit) => {
      if (!unique.includes(digit)) {
        unique.push(digit);
      }
    });

    return unique;
  }

  function removeOneDigit(bag, digit) {
    const nextBag = bag.slice();
    const index = nextBag.indexOf(digit);

    if (index >= 0) {
      nextBag.splice(index, 1);
    }

    return nextBag;
  }

  function takeWaveDigitsFromBag(bag, options) {
    const settings = normalizeGenerationOptions(options || {});
    const count = Math.max(1, Math.floor(Number(options && options.count) || 3));
    const copies = Math.max(1, Math.floor(Number(options && options.copies) || 3));
    let nextBag = Array.isArray(bag) ? bag.slice() : [];

    if (uniqueDigitsInBag(nextBag).length < count) {
      nextBag = createDigitBag({
        copies,
        digitMax: settings.digitMax,
      });
    }

    const available = uniqueDigitsInBag(nextBag);
    const digits = pickDistinct(available, count, settings.rng);

    digits.forEach((digit) => {
      nextBag = removeOneDigit(nextBag, digit);
    });

    return {
      bag: nextBag,
      digits,
    };
  }

  function pickDigits(pool, count, rng, allowDuplicates) {
    if (!allowDuplicates) {
      return pickDistinct(pool, count, rng);
    }

    const picked = [];
    for (let index = 0; index < count; index += 1) {
      picked.push(pool[randomIndex(rng, pool.length)]);
    }

    return picked;
  }

  function createSecret(options) {
    const settings = normalizeGenerationOptions(options);
    return pickDigits(
      digitPool(settings.digitMax),
      3,
      settings.rng,
      settings.allowDuplicates,
    );
  }

  function createWave(rng, excludedDigits, options) {
    const waveDigits = options && Array.isArray(options.waveDigits)
      ? options.waveDigits.slice(0, 3)
      : null;
    const settings = normalizeGenerationOptions({
      ...(options || {}),
      rng: rng || Math.random,
    });
    const random = settings.rng;
    const excluded = new Set(excludedDigits || []);
    const fullPool = digitPool(settings.digitMax);
    let pool = fullPool.filter((digit) => !excluded.has(digit));

    if (pool.length < (settings.allowDuplicates ? 1 : 3)) {
      pool = fullPool.slice();
    }

    const emptyLane = randomIndex(random, 4);
    const digits = waveDigits || pickDigits(pool, 3, random, settings.allowDuplicates);
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
    let strikes = 0;
    const remaining = new Map();

    secret.forEach((digit) => {
      remaining.set(digit, (remaining.get(digit) || 0) + 1);
    });

    guess.forEach((digit) => {
      const count = remaining.get(digit) || 0;
      if (count > 0) {
        remaining.set(digit, count - 1);
        strikes += 1;
      }
    });

    return { strikes, balls: 0 };
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

  function scoreSolvedSet(guessCount, options) {
    const settings = options || {};
    const baseScore = Number.isFinite(settings.baseScore) ? settings.baseScore : 500;
    const graceGuesses = Number.isFinite(settings.graceGuesses) ? settings.graceGuesses : 4;
    const minScore = Math.max(
      0,
      Number.isFinite(settings.minScore) ? settings.minScore : 150,
    );
    const penaltyPerGuess = Number.isFinite(settings.penaltyPerGuess)
      ? settings.penaltyPerGuess
      : 50;
    const safeGuessCount = Math.max(0, Math.floor(Number(guessCount) || 0));
    const penaltySteps = Math.max(0, safeGuessCount - graceGuesses);

    return Math.max(minScore, baseScore - penaltySteps * penaltyPerGuess);
  }

  function createGameState(options) {
    const settings = options || {};
    const secret = settings.secret
      ? settings.secret.slice(0, 3)
      : createSecret(settings);

    return {
      secret,
      currentGuess: [],
      history: [],
      solved: false,
    };
  }

  function collectDigit(state, digit) {
    const nextGuess = state.currentGuess.concat(digit);
    const nextState = {
      secret: state.secret.slice(),
      currentGuess: nextGuess,
      history: state.history.slice(),
      solved: state.solved,
    };

    if (nextGuess.length === 3) {
      const score = scoreGuess(nextState.secret, nextGuess);
      const entry = {
        guess: nextGuess.slice(),
        strikes: score.strikes,
        balls: score.balls,
      };

      nextState.history = [entry].concat(nextState.history);
      nextState.currentGuess = [];
      nextState.solved = score.strikes === 3;
    }

    return nextState;
  }

  const api = {
    DIGITS,
    collectDigit,
    createDigitBag,
    createGameState,
    createSecret,
    createWave,
    digitPool,
    scoreSolvedSet,
    takeWaveDigitsFromBag,
    scoreGuess,
    sortHistoryForDisplay,
  };

  global.RunningBaseballCore = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
