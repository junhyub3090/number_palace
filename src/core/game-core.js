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

  function createSecret(rng) {
    return pickDistinct(DIGITS, 3, rng || Math.random);
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
    let strikes = 0;
    const matchedDigits = new Set();

    guess.forEach((digit) => {
      if (secret.includes(digit) && !matchedDigits.has(digit)) {
        matchedDigits.add(digit);
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
      : createSecret(settings.rng || Math.random);

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
    scoreGuess,
    sortHistoryForDisplay,
  };

  global.RunningBaseballCore = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
