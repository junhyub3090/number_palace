(function runGame() {
  const core = window.RunningBaseballCore;
  const config = window.RunningBaseballConfig;
  const hud = window.RunningBaseballHud;
  const audio = window.RunningBaseballAudio.createAudioController();
  const canvas = document.getElementById("gameCanvas");
  const renderer = window.RunningBaseballCanvas.createCanvasRenderer(
    canvas,
    config,
    hud.formatTime,
  );
  const effects = window.RunningBaseballEffects.createEffects(config, renderer.laneCenter);
  const elements = hud.getHudElements(document);
  const restartButton = document.getElementById("restartButton");

  let tuning = { ...config.DEFAULT_TUNING };
  let gameState;
  let playerLane;
  let wave;
  let nextExcluded;
  let flipUntil;
  let lastFlipAt;
  let lastFrame;
  let spawnCounter;
  let shakeAmount;
  let flashAmount;
  let flashColor;
  let message;
  let boostPower;
  let speedStack;
  let startTime;
  let elapsedMs;
  let guessFlight;
  let lastGuessPulse;
  let timedOut;

  window.RunningBaseballDevControls.createDevControls(
    document,
    tuning,
    (nextTuning) => {
      tuning = nextTuning;
      if (gameState) {
        renderHud();
      }
    },
  );

  function resetGame() {
    gameState = core.createGameState();
    playerLane = 1;
    nextExcluded = [];
    flipUntil = 0;
    lastFlipAt = -Infinity;
    lastFrame = performance.now();
    startTime = lastFrame;
    elapsedMs = 0;
    timedOut = false;
    spawnCounter = 0;
    shakeAmount = 0;
    flashAmount = 0;
    flashColor = "rgba(255,255,255,0)";
    boostPower = 0;
    speedStack = 0;
    guessFlight = null;
    lastGuessPulse = null;
    message = "제한시간 동안 1S 이상 추측해서 점수를 모으세요.";
    effects.reset();
    spawnWave();
    renderHud();
  }

  function speedMultiplier() {
    const elapsedSeconds = elapsedMs / 1000;
    const baseAcceleration = Number.isFinite(tuning.baseAcceleration)
      ? tuning.baseAcceleration
      : config.DEFAULT_TUNING.baseAcceleration;
    const boostGain = Number.isFinite(tuning.boostGain)
      ? tuning.boostGain
      : config.DEFAULT_TUNING.boostGain;
    const speedCap = Number.isFinite(tuning.speedCap)
      ? tuning.speedCap
      : config.DEFAULT_TUNING.speedCap;
    const baseRamp = Math.min(0.85, elapsedSeconds * baseAcceleration);
    const boost = boostPower * boostGain;
    return Math.min(
      speedCap,
      1 + baseRamp + boost + Math.min(0.12, gameState.totalGuesses * 0.004),
    );
  }

  function spawnWave() {
    const base = core.createWave(Math.random, nextExcluded);
    const baseWaveSpeed = Number.isFinite(tuning.baseWaveSpeed)
      ? tuning.baseWaveSpeed
      : config.DEFAULT_TUNING.baseWaveSpeed;
    nextExcluded = [];
    wave = {
      id: spawnCounter++,
      y: -86,
      speed: baseWaveSpeed + Math.min(72, gameState.totalGuesses * 3),
      handled: false,
      consumedLane: null,
      crashed: false,
      items: base.items,
    };
    renderHud();
  }

  function moveLane(delta) {
    if (timedOut) return;

    const nextLane = Math.max(0, Math.min(config.LANES - 1, playerLane + delta));
    if (nextLane !== playerLane) {
      effects.flashLane(nextLane, "#6ba8ff", 0.28);
      effects.addFloater(
        renderer.laneCenter(nextLane),
        config.PLAYER_Y - 92,
        delta < 0 ? "LEFT" : "RIGHT",
        "#9fc5ff",
        0.7,
      );
    }
    playerLane = nextLane;
  }

  function startFlip(now) {
    if (timedOut || now - lastFlipAt < config.FLIP_COOLDOWN) return;

    audio.ensureAudio();
    flipUntil = now + config.FLIP_DURATION;
    lastFlipAt = now;
    shake(4);
    flash("rgba(74,199,165,0.22)", 0.32);
    effects.addFloater(renderer.laneCenter(playerLane), config.PLAYER_Y - 118, "FLIP!", "#4ac7a5", 0.72);
    effects.burst(
      renderer.laneCenter(playerLane),
      config.PLAYER_Y - 44,
      "#4ac7a5",
      scaledEffectCount(12),
      220,
    );
    audio.playEffect("flip");
  }

  function waveDigits(activeWave) {
    return activeWave.items
      .filter((item) => item.kind === "digit")
      .map((item) => item.value);
  }

  function currentLaneItem() {
    return wave.items.find((item) => item.lane === playerLane);
  }

  function flash(color, amount) {
    flashColor = color;
    flashAmount = Math.max(flashAmount, amount * tuning.effectIntensity);
  }

  function scaledEffectCount(count) {
    return Math.max(0, Math.round(count * tuning.effectIntensity));
  }

  function shake(amount) {
    shakeAmount = Math.max(shakeAmount, amount * tuning.shakeIntensity);
  }

  function addBoost(amount, label) {
    const previous = speedStack;
    speedStack = Math.min(config.MAX_SPEED_STACK, speedStack + amount);
    const gained = speedStack - previous;

    if (gained <= 0) {
      message = "부스트 최대";
      return;
    }

    shake(5);
    effects.flashLane(playerLane, "#4ac7a5", 0.55);
    flash("rgba(74,199,165,0.25)", 0.38);
    effects.burst(
      renderer.laneCenter(playerLane),
      config.CATCH_Y,
      "#4ac7a5",
      scaledEffectCount(16),
      260,
    );
    effects.addFloater(
      renderer.laneCenter(playerLane),
      config.CATCH_Y - 32,
      `${label} +${gained}`,
      "#4ac7a5",
      1,
    );
    message = `${label} +${gained}`;
    audio.playEffect("boost");
  }

  function boostFromEmpty() {
    addBoost(1, "BOOST");
  }

  function collectNumber(item, now) {
    const before = gameState.totalGuesses;
    const previousKnownDigits = gameState.knownDigits.slice();
    const x = renderer.laneCenter(item.lane);
    wave.consumedLane = item.lane;
    gameState = core.collectDigit(gameState, item.value);
    shake(7);
    effects.flashLane(item.lane, "#f1d35b", 0.62);
    flash("rgba(241,211,91,0.24)", 0.34);
    effects.burst(x, config.CATCH_Y, "#f1d35b", scaledEffectCount(20), 320);
    effects.addFloater(x, config.CATCH_Y - 48, `+${item.value}`, "#f1d35b", 1);
    message = `${item.value} 수집 · ${gameState.currentGuess.length}/3`;
    audio.playEffect("collect");

    if (gameState.totalGuesses > before) {
      startGuessFlight(gameState.lastResult, previousKnownDigits, now);
      if (gameState.lastResult.strikes === 3) {
        showRoundClear(gameState.lastResult);
      } else {
        showGuessResult(gameState.lastResult);
      }
    }
  }

  function startGuessFlight(last, previousKnownDigits, now) {
    guessFlight = {
      duration: 680,
      finalKnownDigits: last.strikes === 3 ? last.secret.slice() : gameState.knownDigits.slice(),
      guess: last.guess.slice(),
      previousKnownDigits: previousKnownDigits.slice(),
      startedAt: now,
    };
  }

  function showGuessResult(last) {
    lastGuessPulse = {
      text: `${last.guess.join("")}  ${last.strikes}S  +${last.points}`,
      life: 1.25,
      maxLife: 1.25,
    };
    flash("rgba(107,168,255,0.26)", 0.45);
    effects.burst(config.WIDTH / 2, config.HEIGHT / 2, "#6ba8ff", scaledEffectCount(30), 360);
    message = `${last.guess.join("")}: ${last.strikes}S · +${last.points}`;
    audio.playEffect("guess");
  }

  function showRoundClear(last) {
    lastGuessPulse = {
      text: `${last.guess.join("")}  정답  +${last.points}`,
      life: 1.35,
      maxLife: 1.35,
    };
    flash("rgba(241,211,91,0.38)", 0.7);
    effects.burst(config.WIDTH / 2, config.HEIGHT / 2, "#f1d35b", scaledEffectCount(48), 460);
    message = `정답 ${last.secret.join("")} · +${last.points} · 다음 문제`;
    audio.playEffect("clear");
  }

  function crashIntoNumber() {
    nextExcluded = waveDigits(wave);
    const lost = Math.min(speedStack, 2);
    speedStack = Math.max(0, speedStack - 2);
    wave.crashed = true;
    shake(18);
    effects.flashLane(playerLane, "#ff6f61", 0.75);
    flash("rgba(255,111,97,0.36)", 0.58);
    effects.burst(
      renderer.laneCenter(playerLane),
      config.CATCH_Y,
      "#ff6f61",
      scaledEffectCount(24),
      340,
    );
    effects.addFloater(
      renderer.laneCenter(playerLane),
      config.CATCH_Y - 46,
      lost > 0 ? `CRASH -${lost}` : "CRASH",
      "#ff6f61",
      1.05,
    );
    message = `${nextExcluded.join(", ")} 다음 제외 · 부스트 ${lost > 0 ? `-${lost}` : "유지"}`;
    audio.playEffect("crash");
  }

  function handleCatch(now) {
    if (timedOut || !wave || wave.handled || Math.abs(wave.y - config.CATCH_Y) > 26) return;

    const item = currentLaneItem();
    wave.handled = true;

    if (!item || item.kind === "empty") {
      if (now < flipUntil) {
        passEmptyWhileFlipping();
      } else {
        boostFromEmpty();
      }
      renderHud();
      return;
    }

    if (now < flipUntil) {
      collectNumber(item, now);
    } else {
      crashIntoNumber();
    }

    renderHud();
  }

  function passEmptyWhileFlipping() {
    addBoost(2, "JUMP BOOST");
  }

  function updateLastGuessPulse(dt) {
    if (!lastGuessPulse) return;

    lastGuessPulse.life -= dt;
    if (lastGuessPulse.life <= 0) {
      lastGuessPulse = null;
    }
  }

  function updateGuessFlight(timestamp) {
    if (!guessFlight) return;

    if (timestamp - guessFlight.startedAt > guessFlight.duration) {
      guessFlight = null;
    }
  }

  function updateBoostPower(dt) {
    const delta = speedStack - boostPower;
    if (Math.abs(delta) < 0.01) {
      boostPower = speedStack;
      return;
    }

    const response = delta > 0 ? 3.6 : 5.4;
    boostPower += delta * Math.min(1, dt * response);
  }

  function update(timestamp) {
    const dt = Math.min(0.033, (timestamp - lastFrame) / 1000);
    lastFrame = timestamp;

    if (!timedOut) {
      elapsedMs = timestamp - startTime;
      if (elapsedMs >= tuning.timeLimitSeconds * 1000) {
        handleTimeout();
      }
    }

    const speed = speedMultiplier();
    effects.updateStars(dt, speed, speedStack);

    if (!timedOut) {
      wave.y += wave.speed * speed * dt;
      handleCatch(timestamp);

      if (wave.y > config.HEIGHT + 100) {
        spawnWave();
      }
    }

    updateBoostPower(dt);
    effects.update(dt);
    updateLastGuessPulse(dt);
    updateGuessFlight(timestamp);
    shakeAmount *= 0.84;
    flashAmount *= 0.84;
    renderer.draw(createRenderSnapshot(timestamp));
    renderLiveStats();
    requestAnimationFrame(update);
  }

  function handleTimeout() {
    timedOut = true;
    elapsedMs = tuning.timeLimitSeconds * 1000;
    message = `시간 종료 · ${gameState.score}점 · 정답 ${gameState.solvedCount}개`;
    flash("rgba(255,111,97,0.28)", 0.55);
    effects.burst(config.WIDTH / 2, config.HEIGHT / 2, "#ff6f61", scaledEffectCount(32), 360);
    audio.playEffect("crash");
    renderHud();
  }

  function createViewState() {
    return {
      elapsedMs,
      gameState,
      message,
      nextExcluded,
      speedMultiplier,
      speedStack,
      timedOut,
      tuning,
    };
  }

  function createRenderSnapshot(timestamp) {
    return {
      ...createViewState(),
      effects: effects.snapshot(),
      flashAmount,
      flashColor,
      flipUntil,
      guessFlight,
      lastGuessPulse,
      playerLane,
      shakeAmount,
      timestamp,
      wave,
    };
  }

  function renderLiveStats() {
    hud.renderLiveStats(elements, createViewState());
  }

  function renderHud() {
    hud.renderHud(elements, core, createViewState());
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      audio.ensureAudio();
      moveLane(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      audio.ensureAudio();
      moveLane(1);
    } else if (event.code === "Space") {
      event.preventDefault();
      startFlip(performance.now());
    }
  });

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      audio.ensureAudio();
      if (action === "left") moveLane(-1);
      if (action === "right") moveLane(1);
      if (action === "flip") startFlip(performance.now());
    });
  });

  restartButton.addEventListener("click", resetGame);

  resetGame();
  requestAnimationFrame(update);
})();
