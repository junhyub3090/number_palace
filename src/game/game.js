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
  let speedStack;
  let elapsedMs;
  let finalTimeMs;
  let combo;
  let lastGuessPulse;
  let paused;

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
    elapsedMs = 0;
    finalTimeMs = null;
    paused = false;
    spawnCounter = 0;
    shakeAmount = 0;
    flashAmount = 0;
    flashColor = "rgba(255,255,255,0)";
    speedStack = 0;
    combo = 0;
    lastGuessPulse = null;
    message = "점프 존에서 공중제비를 돌면 숫자 캐치. 빈칸은 달려서 통과하면 부스트!";
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
    const base = core.createWave(Math.random, nextExcluded);
    nextExcluded = [];
    wave = {
      id: spawnCounter++,
      y: -86,
      speed: tuning.baseWaveSpeed + Math.min(72, gameState.history.length * 8),
      handled: false,
      consumedLane: null,
      crashed: false,
      items: base.items,
    };
    renderHud();
  }

  function moveLane(delta) {
    if (gameState.solved || paused) return;

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
    if (gameState.solved || paused || now - lastFlipAt < config.FLIP_COOLDOWN) return;

    audio.ensureAudio();
    flipUntil = now + config.FLIP_DURATION;
    lastFlipAt = now;
    shake(6);
    flash("rgba(74,199,165,0.24)", 0.34);
    effects.addFloater(renderer.laneCenter(playerLane), config.CATCH_Y - 68, "FLIP", "#4ac7a5", 0.72);
    effects.burst(
      renderer.laneCenter(playerLane),
      config.CATCH_Y,
      "#4ac7a5",
      scaledEffectCount(18),
      280,
    );
    message = "공중제비!";
    renderHud();
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

  function boostFromEmpty() {
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
    message = `빈칸 부스트 ${speedStack}`;
    audio.playEffect("boost");
  }

  function collectNumber(item) {
    const before = gameState.history.length;
    const x = renderer.laneCenter(item.lane);
    combo += 1;
    wave.consumedLane = item.lane;
    gameState = core.collectDigit(gameState, item.value);
    shake(10);
    effects.flashLane(item.lane, "#f1d35b", 0.62);
    flash("rgba(241,211,91,0.28)", 0.4);
    effects.burst(x, config.CATCH_Y, "#f1d35b", scaledEffectCount(28), 380);
    effects.addFloater(x, config.CATCH_Y - 54, `CATCH ${item.value}`, "#f1d35b", 1);
    message = `${item.value} 점프 캐치 · ${gameState.currentGuess.length}/3`;
    audio.playEffect("collect");

    if (gameState.history.length > before) {
      showGuessResult(gameState.history[0]);
    }

    if (gameState.solved) {
      showClearResult();
    }
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

  function showClearResult() {
    finalTimeMs = elapsedMs;
    flash("rgba(241,211,91,0.38)", 0.7);
    effects.burst(config.WIDTH / 2, config.HEIGHT / 2, "#f1d35b", scaledEffectCount(48), 460);
    message = `정답 ${gameState.secret.join("")} · ${hud.formatTime(finalTimeMs)}`;
    audio.playEffect("clear");

    if (window.FirebaseApi) {
      window.FirebaseApi.updateBestClearTime(finalTimeMs).catch(err => {
        console.error("최단 클리어 시간 업데이트 실패:", err);
      });
    }
  }

  function crashIntoNumber() {
    nextExcluded = waveDigits(wave);
    const lost = Math.min(speedStack, 2);
    speedStack = Math.max(0, speedStack - 2);
    combo = 0;
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
    message = lost > 0 ? `박치기 · 부스트 -${lost}` : "박치기 · 부스트 유지";
    audio.playEffect("crash");
  }

  function handleCatch(now) {
    if (paused || !wave || wave.handled || wave.y < config.CATCH_Y - config.CATCH_WINDOW) return;

    const item = currentLaneItem();
    const isFlipping = now < flipUntil;
    const passedCatchZone = wave.y > config.CATCH_Y + config.CATCH_WINDOW;

    if (!isFlipping && !passedCatchZone) return;

    wave.handled = true;

    if (!item || item.kind === "empty") {
      if (isFlipping) {
        passEmptyWhileFlipping();
      } else {
        boostFromEmpty();
      }
      renderHud();
      return;
    }

    if (isFlipping) {
      collectNumber(item);
    } else {
      crashIntoNumber();
    }

    renderHud();
  }

  function passEmptyWhileFlipping() {
    effects.flashLane(playerLane, "#6ba8ff", 0.24);
    effects.addFloater(
      renderer.laneCenter(playerLane),
      config.CATCH_Y - 34,
      "PASS",
      "#9fc5ff",
      0.72,
    );
    message = "빈칸 점프 통과 · 부스트 없음";
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
      if (!gameState.solved) {
        elapsedMs += dt * 1000;
      }

      const speed = speedMultiplier();
      effects.updateStars(dt, speed, speedStack);

      if (!gameState.solved) {
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
    if (gameState.solved) return;

    paused = !paused;
    message = paused ? "일시정지" : "재개";
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
      finalTimeMs,
      gameState,
      message,
      paused,
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
      flipUntil,
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
    } else if (event.code === "Space") {
      event.preventDefault();
      startFlip(performance.now());
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
      if (action === "flip") startFlip(performance.now());
    });
  });

  pauseButton.addEventListener("click", togglePause);
  restartButton.addEventListener("click", resetGame);

  resetGame();
  requestAnimationFrame(update);
})();
