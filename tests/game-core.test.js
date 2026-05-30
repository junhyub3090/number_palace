function loadCore() {
  if (typeof require === "function") {
    return require("../src/core/game-core.js");
  }

  ObjC.import("Foundation");
  var env = $.NSProcessInfo.processInfo.environment;
  var cwd = env.objectForKey("PWD").js;
  var path = $.NSString.alloc.initWithUTF8String(cwd + "/src/core/game-core.js");
  var source = $.NSString.stringWithContentsOfFileEncodingError(
    path,
    $.NSUTF8StringEncoding,
    null,
  ).js;
  eval(source);
  return RunningBaseballCore;
}

const core = loadCore();

function deepEqual(actual, expected, label) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(
      `${label || "deepEqual"} failed\nactual: ${actualJson}\nexpected: ${expectedJson}`,
    );
  }
}

function equal(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(
      `${label || "equal"} failed\nactual: ${actual}\nexpected: ${expected}`,
    );
  }
}

function makeRng(values) {
  let index = 0;
  return () => values[index++ % values.length];
}

deepEqual(core.scoreGuess([1, 2, 3], [1, 4, 3]), {
  strikes: 2,
  balls: 0,
  matchedDigits: [1, 3],
  missedDigits: [4],
});

deepEqual(core.scoreGuess([1, 2, 3], [3, 1, 4]), {
  strikes: 2,
  balls: 0,
  matchedDigits: [3, 1],
  missedDigits: [4],
});

deepEqual(core.scoreGuess([1, 2, 3], [3, 2, 1]), {
  strikes: 3,
  balls: 0,
  matchedDigits: [3, 2, 1],
  missedDigits: [],
});

deepEqual(core.scoreGuess([1, 2, 3], [1, 1, 1]), {
  strikes: 1,
  balls: 0,
  matchedDigits: [1],
  missedDigits: [1, 1],
});

deepEqual(core.scoreGuess([8, 4, 2], [1, 2, 3]), {
  strikes: 1,
  balls: 0,
  matchedDigits: [2],
  missedDigits: [1, 3],
});

deepEqual(core.scoreGuess([8, 8, 3], [8, 8, 1]), {
  strikes: 2,
  balls: 0,
  matchedDigits: [8, 8],
  missedDigits: [1],
});

equal(core.scoreGuessPoints(0), 0);
equal(core.scoreGuessPoints(1), 100);
equal(core.scoreGuessPoints(2), 300);
equal(core.scoreGuessPoints(3), 700);

{
  const wave = core.createWave(makeRng([0, 0, 0, 0]), [1, 2, 3]);
  equal(wave.items.filter((item) => item.kind === "empty").length, 1);
  deepEqual(
    wave.items.filter((item) => item.kind === "digit").map((item) => item.value),
    [4, 5, 6],
  );
}

{
  const state = core.createGameState({
    secret: [1, 2, 3],
    rng: makeRng([0, 0.12, 0.25, 0.38]),
  });
  const afterFirst = core.collectDigit(state, 1);
  const afterSecond = core.collectDigit(afterFirst, 2);
  const afterThird = core.collectDigit(afterSecond, 3);

  deepEqual(afterThird.currentGuess, []);
  deepEqual(afterThird.history, []);
  deepEqual(afterThird.lastResult, {
    guess: [1, 2, 3],
    strikes: 3,
    balls: 0,
    matchedDigits: [1, 2, 3],
    missedDigits: [],
    points: 700,
    secret: [1, 2, 3],
  });
  equal(afterThird.score, 700);
  equal(afterThird.solvedCount, 1);
  deepEqual(afterThird.solvedSecrets, [[1, 2, 3]]);
  deepEqual(afterThird.rejectedDigits, []);
  equal(afterThird.totalGuesses, 1);
}

{
  const state = core.createGameState({ secret: [1, 2, 3] });
  const afterFirst = core.collectDigit(state, 1);
  const afterSecond = core.collectDigit(afterFirst, 4);
  const afterThird = core.collectDigit(afterSecond, 9);

  deepEqual(afterThird.currentGuess, []);
  deepEqual(afterThird.history[0], {
    guess: [1, 4, 9],
    strikes: 1,
    balls: 0,
    matchedDigits: [1],
    missedDigits: [4, 9],
    points: 100,
    secret: [1, 2, 3],
  });
  equal(afterThird.score, 100);
  equal(afterThird.solvedCount, 0);
  deepEqual(afterThird.rejectedDigits, [4, 9]);
  deepEqual(afterThird.solvedSecrets, []);
  equal(afterThird.totalGuesses, 1);
}

{
  const state = core.createGameState({ secret: [1, 2, 3] });
  const afterFirst = core.collectDigit(state, 4);
  const afterSecond = core.collectDigit(afterFirst, 5);
  const afterThird = core.collectDigit(afterSecond, 6);

  equal(afterThird.score, 0);
  equal(afterThird.history[0].points, 0);
  equal(afterThird.solvedCount, 0);
  deepEqual(afterThird.rejectedDigits, [4, 5, 6]);
  deepEqual(afterThird.solvedSecrets, []);
}

{
  const state = core.createGameState({ secret: [8, 8, 8] });
  const guessOne = [8, 2, 2].reduce(
    (nextState, digit) => core.collectDigit(nextState, digit),
    state,
  );
  deepEqual(guessOne.knownDigits, [8]);
  deepEqual(guessOne.rejectedDigits, [2]);

  const guessTwo = [8, 3, 4].reduce(
    (nextState, digit) => core.collectDigit(nextState, digit),
    guessOne,
  );
  deepEqual(guessTwo.knownDigits, [8]);
  deepEqual(guessTwo.rejectedDigits, [2, 3, 4]);

  const guessThree = [8, 8, 3].reduce(
    (nextState, digit) => core.collectDigit(nextState, digit),
    guessTwo,
  );
  deepEqual(guessThree.knownDigits, [8, 8]);
  deepEqual(guessThree.rejectedDigits, [2, 3, 4]);
}

{
  const sorted = core.sortHistoryForDisplay([
    { guess: [9, 8, 7], strikes: 0, balls: 0 },
    { guess: [1, 9, 8], strikes: 1, balls: 0 },
    { guess: [1, 3, 2], strikes: 3, balls: 0 },
    { guess: [1, 2, 9], strikes: 2, balls: 0 },
    { guess: [1, 2, 3], strikes: 3, balls: 0 },
    { guess: [1, 2, 8], strikes: 2, balls: 0 },
  ]);

  deepEqual(
    sorted.map((entry) => `${entry.strikes}S:${entry.guess.join("")}`),
    ["3S:132", "3S:123", "2S:129", "2S:128", "1S:198", "0S:987"],
  );
}

console.log("game-core tests passed");
