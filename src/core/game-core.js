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
    const digits = pickDigits(pool, 3, random, settings.allowDuplicates);
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
    createGameState,
    createSecret,
    createWave,
    digitPool,
    scoreGuess,
    sortHistoryForDisplay,
  };

  global.RunningBaseballCore = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
