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
  let shakeAmount;
  let flashAmount;
  let flashColor;
  let message;
  let speedStack;
  let elapsedMs;
  let finalTimeMs;
  let score;
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
    gameEnded = false;
    endReason = null;
    paused = false;
    spawnCounter = 0;
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
    spawnWave();
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

  function spawnWave() {
    const base = core.createWave(Math.random, [], generationOptions());
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

  function generationOptions() {
    return {
      allowDuplicates: tuning.allowDuplicates,
      digitMax: tuning.digitMax,
    };
  }

  function timeLimitMs() {
    return Math.max(1, tuning.timeLimitSeconds || 120) * 1000;
  }

  function remainingMs() {
    return Math.max(0, timeLimitMs() - elapsedMs);
  }

  function moveLane(delta) {
    if (gameEnded || paused) return;

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

  function startDash(now) {
    if (gameEnded || paused || !wave || wave.handled || now - lastDashAt < config.DASH_COOLDOWN) return;

    const item = currentLaneItem();
    lastDashAt = now;
    audio.ensureAudio();
    wave.handled = true;
    wave.y = Math.max(wave.y, config.CATCH_Y);
    shake(9);
    flash("rgba(107,168,255,0.22)", 0.34);
    effects.flashLane(playerLane, "#6ba8ff", 0.42);
    effects.addFloater(
      renderer.laneCenter(playerLane),
      config.CATCH_Y - 76,
      "DASH",
      "#6ba8ff",
      0.92,
    );

    if (!item || item.kind === "empty") {
      boostFromEmpty("dash");
      spawnWave();
      renderHud();
      return;
    }

    const completedSet = collectNumber(item, "dash");
    if (!completedSet && !gameEnded) {
      spawnWave();
    }
    renderHud();
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

  function boostFromEmpty(source) {
    speedStack = Math.min(config.MAX_SPEED_STACK, speedStack + 1);
    combo += 1;
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
      `BOOST ${speedStack}`,
      "#4ac7a5",
      1,
    );
    message = source === "dash"
      ? `빈칸 대쉬 부스트 ${speedStack}/${config.MAX_SPEED_STACK}`
      : `빈칸 부스트 ${speedStack}/${config.MAX_SPEED_STACK}`;
    audio.playEffect("boost");
  }

  function collectNumber(item, source) {
    const before = gameState.history.length;
    const x = renderer.laneCenter(item.lane);
    combo += 1;
    wave.consumedLane = item.lane;
    gameState = core.collectDigit(gameState, item.value);
    shake(10);
    effects.flashLane(item.lane, "#f1d35b", 0.62);
    flash("rgba(241,211,91,0.28)", 0.4);
    effects.burst(x, config.CATCH_Y, "#f1d35b", scaledEffectCount(28), 380);
    effects.addFloater(
      x,
      config.CATCH_Y - 54,
      source === "dash" ? `DASH ${item.value}` : `CATCH ${item.value}`,
      "#f1d35b",
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
      completeSet();
      return true;
    }

    return false;
  }

  function showGuessResult(last) {
    lastGuessPulse = {
      text: `${last.guess.join("")}  ${last.strikes}S`,
      life: 1.25,
      maxLife: 1.25,
    };
    flash("rgba(107,168,255,0.26)", 0.45);
    effects.burst(config.WIDTH / 2, config.HEIGHT / 2, "#6ba8ff", scaledEffectCount(30), 360);
    message = `${last.guess.join("")}: ${last.strikes}S`;
    audio.playEffect("guess");
  }

  function completeSet() {
    const solvedSecret = gameState.secret.join("");
    score += 1;
    flash("rgba(241,211,91,0.38)", 0.7);
    effects.burst(config.WIDTH / 2, config.HEIGHT / 2, "#f1d35b", scaledEffectCount(48), 460);
    effects.addFloater(config.WIDTH / 2, config.HEIGHT / 2 + 54, `SET ${score}`, "#f1d35b", 1.18);
    message = `정답 ${solvedSecret} · ${score}세트 클리어`;
    audio.playEffect("clear");
    gameState = core.createGameState(generationOptions());
    combo = 0;
    hintProgress = 0;
    excludedHintDigits = [];
    spawnWave();
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
    hintProgress = Math.min(3, hintProgress + 1);
    combo += 1;
    shake(4);
    effects.flashLane(playerLane, "#6ba8ff", 0.38);
    flash("rgba(107,168,255,0.18)", 0.28);
    effects.burst(
      renderer.laneCenter(playerLane),
      config.CATCH_Y,
      "#6ba8ff",
      scaledEffectCount(12),
      230,
    );
    effects.addFloater(
      renderer.laneCenter(playerLane),
      config.CATCH_Y - 38,
      `HINT ${hintProgress}/3`,
      "#9fc5ff",
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
        wave.y += wave.speed * speed * dt;
        handleCatch(timestamp);

        if (wave.y > config.HEIGHT + 100) {
          spawnWave();
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
    message = `${reason === "time" ? "시간 종료" : "게임 종료"} · ${score}세트`;
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
      excludedHintDigits,
      hintProgress,
      message,
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
    button.addEventListener("click", () => {
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
