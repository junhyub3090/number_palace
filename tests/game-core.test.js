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
});

deepEqual(core.scoreGuess([1, 2, 3], [3, 1, 4]), {
  strikes: 2,
  balls: 0,
});

deepEqual(core.scoreGuess([1, 2, 3], [3, 2, 1]), {
  strikes: 3,
  balls: 0,
});

deepEqual(core.scoreGuess([1, 2, 3], [1, 1, 1]), {
  strikes: 1,
  balls: 0,
});

deepEqual(core.scoreGuess([1, 1, 2], [1, 2, 2]), {
  strikes: 2,
  balls: 0,
});

deepEqual(core.scoreGuess([1, 1, 2], [1, 1, 1]), {
  strikes: 2,
  balls: 0,
});

deepEqual(core.digitPool(5), [1, 2, 3, 4, 5]);

equal(core.scoreSolvedSet(1), 500);
equal(core.scoreSolvedSet(4), 500);
equal(core.scoreSolvedSet(5), 450);
equal(core.scoreSolvedSet(6), 400);
equal(core.scoreSolvedSet(14), 150);
equal(core.scoreSolvedSet(100), 150);
equal(core.scoreSolvedSet(14, { minScore: 0 }), 0);
equal(core.scoreSolvedSet(3, { graceGuesses: 2, penaltyPerGuess: 25 }), 475);

{
  const bag = core.createDigitBag({ digitMax: 5, copies: 3 });
  deepEqual(bag, [1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5]);
}

{
  const result = core.takeWaveDigitsFromBag([1, 1, 1, 2, 2, 2, 3, 3, 3], {
    digitMax: 3,
    rng: makeRng([0, 0, 0]),
  });

  deepEqual(result.digits, [1, 2, 3]);
  deepEqual(result.bag, [1, 1, 2, 2, 3, 3]);
}

{
  const result = core.takeWaveDigitsFromBag([1, 1, 2, 2], {
    digitMax: 5,
    rng: makeRng([0, 0, 0]),
  });

  deepEqual(result.digits, [1, 2, 3]);
  equal(result.bag.length, 12);
}

deepEqual(
  core.createSecret({
    allowDuplicates: true,
    digitMax: 5,
    rng: makeRng([0, 0, 0]),
  }),
  [1, 1, 1],
);

deepEqual(
  core.createSecret({
    allowDuplicates: false,
    digitMax: 5,
    rng: makeRng([0, 0.99, 0.5]),
  }),
  [1, 5, 3],
);

{
  const wave = core.createWave(makeRng([0, 0, 0, 0]), [1, 2, 3]);
  equal(wave.items.filter((item) => item.kind === "empty").length, 1);
  deepEqual(
    wave.items.filter((item) => item.kind === "digit").map((item) => item.value),
    [4, 5, 6],
  );
}

{
  const wave = core.createWave(makeRng([0, 0, 0, 0]), [], {
    allowDuplicates: true,
    digitMax: 5,
  });
  equal(wave.items.filter((item) => item.kind === "empty").length, 1);
  deepEqual(
    wave.items.filter((item) => item.kind === "digit").map((item) => item.value),
    [1, 1, 1],
  );
}

{
  const wave = core.createWave(makeRng([0]), [], {
    digitMax: 9,
    waveDigits: [7, 8, 9],
  });

  deepEqual(
    wave.items.filter((item) => item.kind === "digit").map((item) => item.value),
    [7, 8, 9],
  );
}

{
  const state = core.createGameState({
    allowDuplicates: false,
    digitMax: 5,
    secret: [1, 2, 3],
    rng: makeRng([0, 0.12, 0.25, 0.38]),
  });
  const afterFirst = core.collectDigit(state, 1);
  const afterSecond = core.collectDigit(afterFirst, 2);
  const afterThird = core.collectDigit(afterSecond, 3);

  deepEqual(afterThird.currentGuess, []);
  deepEqual(afterThird.history[0], {
    guess: [1, 2, 3],
    strikes: 3,
    balls: 0,
  });
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
