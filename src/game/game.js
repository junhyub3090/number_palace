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
  const pauseButton = document.getElementById("pauseButton");
  const deathButton = document.getElementById("deathButton");
  const restartButton = document.getElementById("restartButton");

  let tuning = { ...config.DEFAULT_TUNING };
  let gameState;
  let playerLane;
  let wave;
  let lastDashAt;
  let lastFrame;
  let spawnCounter;
  let digitBag;
  let nextWaveDigits;
  let shakeAmount;
  let flashAmount;
  let flashColor;
  let message;
  let speedStack;
  let elapsedMs;
  let finalTimeMs;
  let score;
  let clearedSets;
  let lastSetPoints;
  let gameEnded;
  let endReason;
  let combo;
  let hintProgress;
  let excludedHintDigits;
  let lastGuessPulse;
  let paused;

  window.RunningBaseballDevControls.createDevControls(
    document,
    tuning,
    (nextTuning) => {
      const shouldReset =
        gameState &&
        (tuning.digitMax !== nextTuning.digitMax ||
          tuning.allowDuplicates !== nextTuning.allowDuplicates);
      tuning = nextTuning;
      if (shouldReset) {
        resetGame();
      } else if (gameState) {
        if (!gameEnded && elapsedMs >= timeLimitMs()) {
          endGame("time");
          return;
        }
        renderHud();
      }
    },
  );

  function resizeCanvas() {
    const width = Math.max(1, Math.floor(window.innerWidth || config.WIDTH));
    const height = Math.max(1, Math.floor(window.innerHeight || config.HEIGHT));
    canvas.width = width;
    canvas.height = height;
    renderer.resize(width, height);
  }

  function resetGame() {
    gameState = core.createGameState(generationOptions());
    playerLane = 1;
    lastDashAt = -Infinity;
    lastFrame = performance.now();
    elapsedMs = 0;
    finalTimeMs = null;
    score = 0;
    clearedSets = 0;
    lastSetPoints = 0;
    gameEnded = false;
    endReason = null;
    paused = false;
    spawnCounter = 0;
    digitBag = core.createDigitBag(bagOptions());
    const firstWaveDigits = takeWaveDigits();
    nextWaveDigits = takeWaveDigits();
    shakeAmount = 0;
    flashAmount = 0;
    flashColor = "rgba(255,255,255,0)";
    speedStack = 0;
    combo = 0;
    hintProgress = 0;
    excludedHintDigits = [];
    lastGuessPulse = null;
    message = "숫자는 닿으면 캐치. 빈칸은 천천히 통과하면 힌트, 대쉬로 통과하면 부스트!";
    effects.reset();
    spawnWave(firstWaveDigits);
    updatePauseButton();
    renderHud();
  }

  function speedMultiplier() {
    const boost = speedStack * tuning.boostGain;
    return Math.min(
      tuning.speedCap,
      1 + boost + Math.min(0.14, gameState.history.length * 0.018),
    );
  }

  function spawnWave(waveDigits) {
    const digits = Array.isArray(waveDigits) && waveDigits.length === 3
      ? waveDigits
      : takeWaveDigits();
    const base = core.createWave(Math.random, [], {
      ...generationOptions(),
      waveDigits: digits,
    });
    wave = {
      id: spawnCounter++,
      y: -86,
      speed: tuning.baseWaveSpeed + Math.min(72, gameState.history.length * 8),
      handled: false,
      consumedLane: null,
      items: base.items,
    };
    renderHud();
  }

  function advanceWave() {
    const currentDigits = Array.isArray(nextWaveDigits) && nextWaveDigits.length === 3
      ? nextWaveDigits
      : takeWaveDigits();
    nextWaveDigits = takeWaveDigits();
    spawnWave(currentDigits);
  }

  function generationOptions() {
    return {
      allowDuplicates: tuning.allowDuplicates,
      digitMax: tuning.digitMax,
    };
  }

  function bagOptions() {
    return {
      copies: 3,
      digitMax: tuning.digitMax,
    };
  }

  function takeWaveDigits() {
    const result = core.takeWaveDigitsFromBag(digitBag, {
      ...bagOptions(),
      rng: Math.random,
    });
    digitBag = result.bag;
    return result.digits;
  }

  function timeLimitMs() {
    return Math.max(1, tuning.timeLimitSeconds || 120) * 1000;
  }

  function remainingMs() {
    return Math.max(0, timeLimitMs() - elapsedMs);
  }

  function moveLane(delta) {
    if (gameEnded || paused || (wave && wave.dashImpact)) return;

    const nextLane = Math.max(0, Math.min(config.LANES - 1, playerLane + delta));
    if (nextLane !== playerLane) {
      effects.flashLane(nextLane, "#6ba8ff", 0.28);
    }
    playerLane = nextLane;
  }

  function startDash(now) {
    if (gameEnded || paused || !wave || wave.handled || now - lastDashAt < config.DASH_COOLDOWN) return;

    const item = currentLaneItem();
    const highlightColor = itemHighlightColor(item);
    lastDashAt = now;
    audio.ensureAudio();
    wave.handled = true;
    wave.dashImpact = {
      lane: playerLane,
      startTime: now,
      duration: 0.12,
      startY: wave.y,
      impactY: config.CATCH_Y,
      endY: config.HEIGHT + 420,
      resolved: false,
    };
    wave.dashImpact.collisionProgress = Math.max(
      0,
      Math.min(1, (wave.dashImpact.impactY - wave.dashImpact.startY) /
        (wave.dashImpact.endY - wave.dashImpact.startY)),
    );
    effects.addDashTrail({
      startTime: now,
      duration: wave.dashImpact.duration,
      itemSize: tuning.itemSize,
      items: wave.items.map((candidate) => ({
        lane: candidate.lane,
        kind: candidate.kind,
        value: candidate.value,
        active: candidate.lane === playerLane,
        startY: wave.dashImpact.startY,
        endY: candidate.lane === playerLane
          ? wave.dashImpact.impactY
          : config.HEIGHT + 120,
      })),
      life: 0.3,
    });
    shake(12);
    flash(colorWithAlpha(highlightColor, 0.28), 0.46);
    effects.flashLane(playerLane, highlightColor, 0.62);
    effects.addFloater(
      renderer.laneCenter(playerLane),
      config.CATCH_Y - 92,
      "DASH",
      highlightColor,
      0.58,
    );
    audio.playEffect("dash");
    message = item && item.kind === "digit"
      ? `${item.value} 대쉬 진입`
      : "빈칸 대쉬 진입";
    renderHud();
  }

  function updateDashImpact(timestamp) {
    if (!wave || !wave.dashImpact) return;

    const impact = wave.dashImpact;
    const progress = Math.min(1, (timestamp - impact.startTime) / (impact.duration * 1000));

    wave.y = impact.startY + (impact.endY - impact.startY) * progress;

    if (!impact.resolved && progress >= impact.collisionProgress) {
      impact.resolved = true;
      wave.y = impact.impactY;
      resolveDashImpact();
    }

    if (progress < 1) return;

    if (!gameEnded) {
      advanceWave();
      renderHud();
    }
  }

  function resolveDashImpact() {
    if (!wave || !wave.dashImpact) return;

    const impact = wave.dashImpact;
    const item = wave.items.find((candidate) => candidate.lane === impact.lane);
    const color = itemHighlightColor(item);
    const x = renderer.laneCenter(impact.lane);

    wave.consumedLane = impact.lane;
    shake(22);
    flash(colorWithAlpha(color, item && item.kind === "empty" ? 0.38 : 0.42), 0.72);
    effects.flashLane(impact.lane, color, 0.78);
    effects.burst(x, config.CATCH_Y, color, scaledEffectCount(42), 720);
    effects.burst(x, config.CATCH_Y, "#f2f2ea", scaledEffectCount(16), 520);

    if (!item || item.kind === "empty") {
      boostFromEmpty("dash");
      renderHud();
      return;
    }

    collectNumber(item, "dash", { deferAdvance: true, impact: true });
    renderHud();
  }

  function currentLaneItem() {
    return wave.items.find((item) => item.lane === playerLane);
  }

  function digitColor(value) {
    if (typeof config.digitColor === "function") {
      return config.digitColor(value);
    }

    return "#f1d35b";
  }

  function itemHighlightColor(item) {
    if (item && item.kind === "digit") {
      return digitColor(item.value);
    }

    return config.BOOST_COLOR || "#f2f2ea";
  }

  function boostGlowColor() {
    return config.BOOST_GLOW_COLOR || "#cfe4ff";
  }

  function colorWithAlpha(color, alpha) {
    const hex = String(color || "").replace("#", "");
    const safeAlpha = Math.max(0, Math.min(1, alpha || 0));

    if (hex.length !== 6) {
      return `rgba(242,242,234,${safeAlpha})`;
    }

    const red = parseInt(hex.slice(0, 2), 16);
    const green = parseInt(hex.slice(2, 4), 16);
    const blue = parseInt(hex.slice(4, 6), 16);

    return `rgba(${red},${green},${blue},${safeAlpha})`;
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

  function boostFromEmpty(source) {
    const color = itemHighlightColor({ kind: "empty" });
    const glowColor = boostGlowColor();
    speedStack = Math.min(config.MAX_SPEED_STACK, speedStack + 1);
    combo += 1;
    shake(5);
    effects.flashLane(playerLane, color, 0.58);
    flash(colorWithAlpha(color, 0.26), 0.38);
    effects.burst(
      renderer.laneCenter(playerLane),
      config.CATCH_Y,
      color,
      scaledEffectCount(16),
      260,
    );
    effects.burst(
      renderer.laneCenter(playerLane),
      config.CATCH_Y,
      glowColor,
      scaledEffectCount(8),
      220,
    );
    effects.addFloater(
      renderer.laneCenter(playerLane),
      config.CATCH_Y - 32,
      `BOOST ${speedStack}`,
      glowColor,
      1,
    );
    message = source === "dash"
      ? `빈칸 대쉬 부스트 ${speedStack}/${config.MAX_SPEED_STACK}`
      : `빈칸 부스트 ${speedStack}/${config.MAX_SPEED_STACK}`;
    audio.playEffect("boost");
  }

  function collectNumber(item, source, options = {}) {
    const before = gameState.history.length;
    const x = renderer.laneCenter(item.lane);
    const color = digitColor(item.value);
    combo += 1;
    wave.consumedLane = item.lane;
    gameState = core.collectDigit(gameState, item.value);
    shake(source === "dash" ? 14 : 10);
    effects.flashLane(item.lane, color, 0.66);
    flash(colorWithAlpha(color, 0.3), source === "dash" ? 0.52 : 0.4);
    effects.burst(
      x,
      config.CATCH_Y,
      color,
      scaledEffectCount(options.impact ? 44 : 28),
      options.impact ? 680 : 380,
    );
    effects.addFloater(
      x,
      config.CATCH_Y - 54,
      source === "dash" ? `DASH ${item.value}` : `CATCH ${item.value}`,
      color,
      source === "dash" ? 1.08 : 1,
    );
    message = source === "dash"
      ? `${item.value} 대쉬 캐치 · ${gameState.currentGuess.length}/3`
      : `${item.value} 캐치 · ${gameState.currentGuess.length}/3`;
    audio.playEffect("collect");

    if (gameState.history.length > before) {
      showGuessResult(gameState.history[0]);
    }

    if (gameState.solved) {
      completeSet({ deferAdvance: Boolean(options.deferAdvance) });
      return true;
    }

    return false;
  }

  function showGuessResult(last) {
    const isPerfect = last.strikes === 3;

    lastGuessPulse = {
      text: isPerfect ? "정답!" : `${last.guess.join("")}  ${last.strikes}S`,
      subtext: isPerfect ? `${last.guess.join("")}  3S` : "",
      success: isPerfect,
      life: isPerfect ? 1.72 : 1.25,
      maxLife: isPerfect ? 1.72 : 1.25,
    };
    message = `${last.guess.join("")}: ${last.strikes}S`;

    if (isPerfect) {
      shake(18);
      flash("rgba(241,211,91,0.62)", 0.96);
      effects.burst(config.WIDTH / 2, config.HEIGHT / 2 - 18, "#f1d35b", scaledEffectCount(76), 660);
      effects.burst(config.WIDTH / 2, config.HEIGHT / 2 - 18, "#f2f2ea", scaledEffectCount(34), 520);

      for (let lane = 0; lane < config.LANES; lane += 1) {
        effects.flashLane(lane, "#f1d35b", 0.58);
        effects.burst(renderer.laneCenter(lane), config.CATCH_Y, "#f1d35b", scaledEffectCount(10), 360);
      }
      return;
    }

    flash("rgba(107,168,255,0.26)", 0.45);
    effects.burst(config.WIDTH / 2, config.HEIGHT / 2, "#6ba8ff", scaledEffectCount(30), 360);
    audio.playEffect("guess");
  }

  function setScoreForGuessCount(guessCount) {
    return core.scoreSolvedSet(guessCount, {
      baseScore: 500,
      graceGuesses: Math.max(0, tuning.scoreGraceGuesses || 4),
      minScore: 150,
      penaltyPerGuess: 50,
    });
  }

  function completeSet(options = {}) {
    const solvedSecret = gameState.secret.join("");
    const guessCount = gameState.history.length;
    lastSetPoints = setScoreForGuessCount(guessCount);
    if (lastGuessPulse && lastGuessPulse.success) {
      lastGuessPulse.points = `+${lastSetPoints}`;
    }
    score += lastSetPoints;
    clearedSets += 1;
    shake(14);
    flash("rgba(241,211,91,0.48)", 0.86);
    effects.burst(config.WIDTH / 2, config.HEIGHT / 2, "#f1d35b", scaledEffectCount(64), 560);
    effects.addFloater(
      config.WIDTH / 2,
      config.HEIGHT / 2 + 54,
      `+${lastSetPoints}`,
      "#f1d35b",
      1.18,
    );
    message = `정답 ${solvedSecret} · ${guessCount}회 · +${lastSetPoints}점`;
    audio.playEffect("clear");
    gameState = core.createGameState(generationOptions());
    combo = 0;
    hintProgress = 0;
    excludedHintDigits = [];
    if (!options.deferAdvance) {
      advanceWave();
    }
  }

  function handleCatch(now) {
    if (gameEnded || paused || !wave || wave.handled || wave.y < config.CATCH_Y - config.CATCH_WINDOW) return;

    const item = currentLaneItem();

    wave.handled = true;

    if (!item || item.kind === "empty") {
      collectHintFromEmpty();
      renderHud();
      return;
    }

    collectNumber(item, "touch");
    renderHud();
  }

  function collectHintFromEmpty() {
    const color = itemHighlightColor({ kind: "empty" });
    hintProgress = Math.min(3, hintProgress + 1);
    combo += 1;
    shake(4);
    effects.flashLane(playerLane, color, 0.38);
    flash(colorWithAlpha(color, 0.18), 0.28);
    effects.burst(
      renderer.laneCenter(playerLane),
      config.CATCH_Y,
      color,
      scaledEffectCount(12),
      230,
    );
    effects.addFloater(
      renderer.laneCenter(playerLane),
      config.CATCH_Y - 38,
      `HINT ${hintProgress}/3`,
      boostGlowColor(),
      0.84,
    );
    audio.playEffect("guess");

    if (hintProgress >= 3) {
      revealExcludedDigit();
      return;
    }

    message = `빈칸 힌트 조각 ${hintProgress}/3`;
  }

  function revealExcludedDigit() {
    hintProgress = 0;
    const secretDigits = new Set(gameState.secret);
    const candidates = core
      .digitPool(tuning.digitMax)
      .filter((digit) => !secretDigits.has(digit) && !excludedHintDigits.includes(digit));

    if (candidates.length === 0) {
      message = "제외할 숫자가 더 없음";
      return;
    }

    const digit = candidates[Math.floor(Math.random() * candidates.length)];
    excludedHintDigits = excludedHintDigits.concat(digit).sort((left, right) => left - right);
    flash("rgba(107,168,255,0.28)", 0.46);
    effects.addFloater(
      renderer.laneCenter(playerLane),
      config.CATCH_Y - 62,
      `NOT ${digit}`,
      "#9fc5ff",
      1.05,
    );
    message = `${digit}은 정답 숫자가 아님`;
  }

  function updateLastGuessPulse(dt) {
    if (!lastGuessPulse) return;

    lastGuessPulse.life -= dt;
    if (lastGuessPulse.life <= 0) {
      lastGuessPulse = null;
    }
  }

  function update(timestamp) {
    const dt = Math.min(0.033, (timestamp - lastFrame) / 1000);
    lastFrame = timestamp;

    if (!paused) {
      if (!gameEnded) {
        elapsedMs += dt * 1000;
        if (elapsedMs >= timeLimitMs()) {
          elapsedMs = timeLimitMs();
          endGame("time");
        }
      }

      const speed = speedMultiplier();
      effects.updateStars(dt, speed, speedStack);

      if (!gameEnded) {
        if (wave.dashImpact) {
          updateDashImpact(timestamp);
        } else {
          wave.y += wave.speed * speed * dt;
          handleCatch(timestamp);
        }

        if (!wave.dashImpact && wave.y > config.HEIGHT + 100) {
          advanceWave();
        }
      }

      effects.update(dt);
      updateLastGuessPulse(dt);
      shakeAmount *= 0.84;
      flashAmount *= 0.84;
    }

    renderer.draw(createRenderSnapshot(timestamp));
    renderLiveStats();
    requestAnimationFrame(update);
  }

  function togglePause() {
    if (gameEnded) return;

    paused = !paused;
    message = paused ? "일시정지" : "재개";
    updatePauseButton();
    renderHud();
  }

  function endGame(reason) {
    if (gameEnded) return;

    gameEnded = true;
    endReason = reason;
    finalTimeMs = elapsedMs;
    paused = false;
    speedStack = 0;
    combo = 0;
    flash(reason === "time" ? "rgba(241,211,91,0.3)" : "rgba(255,111,97,0.34)", 0.65);
    effects.burst(
      config.WIDTH / 2,
      config.HEIGHT / 2,
      reason === "time" ? "#f1d35b" : "#ff6f61",
      scaledEffectCount(42),
      420,
    );
    message = `${reason === "time" ? "시간 종료" : "게임 종료"} · ${score}점 · ${clearedSets}세트`;
    audio.playEffect("guess");
    updatePauseButton();
    renderHud();
  }

  function updatePauseButton() {
    pauseButton.textContent = paused ? "재개" : "정지";
    pauseButton.setAttribute("aria-pressed", String(paused));
  }

  function createViewState() {
    return {
      elapsedMs,
      endReason,
      finalTimeMs,
      gameState,
      gameEnded,
      clearedSets,
      excludedHintDigits,
      hintProgress,
      lastSetPoints,
      message,
      nextWaveDigits,
      paused,
      remainingMs: remainingMs(),
      score,
      speedMultiplierValue: speedMultiplier(),
      speedStack,
      tuning,
    };
  }

  function createRenderSnapshot(timestamp) {
    return {
      ...createViewState(),
      effects: effects.snapshot(),
      flashAmount,
      flashColor,
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
    if (event.key === "ArrowLeft" || event.code === "KeyA") {
      event.preventDefault();
      audio.ensureAudio();
      moveLane(-1);
    } else if (event.key === "ArrowRight" || event.code === "KeyD") {
      event.preventDefault();
      audio.ensureAudio();
      moveLane(1);
    } else if (
      event.code === "KeyZ" ||
      event.code === "Space" ||
      event.key === "ArrowUp" ||
      event.code === "KeyW"
    ) {
      event.preventDefault();
      startDash(performance.now());
    } else if (event.key === "p" || event.key === "P") {
      event.preventDefault();
      togglePause();
    }
  });

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const action = button.dataset.action;
      audio.ensureAudio();
      if (action === "left") moveLane(-1);
      if (action === "right") moveLane(1);
      if (action === "dash") startDash(performance.now());
    });
  });

  pauseButton.addEventListener("click", togglePause);
  deathButton.addEventListener("click", () => {
    audio.ensureAudio();
    endGame("death");
  });
  restartButton.addEventListener("click", resetGame);
  window.addEventListener("resize", resizeCanvas);

  resizeCanvas();
  resetGame();
  requestAnimationFrame(update);
})();
