(function attachCanvasRenderer(global) {
  function createCanvasRenderer(canvas, config, formatTime) {
    const ctx = canvas.getContext("2d");
    let viewportWidth = config.WIDTH;
    let viewportHeight = config.HEIGHT;
    let stageX = 0;
    let stageY = 0;
    let stageScale = 1;

    function resize(width, height) {
      viewportWidth = Math.max(1, Math.floor(width || config.WIDTH));
      viewportHeight = Math.max(1, Math.floor(height || config.HEIGHT));
      stageScale = Math.min(
        1,
        viewportWidth / config.WIDTH,
        viewportHeight / config.HEIGHT,
      );
      stageX = (viewportWidth - config.WIDTH * stageScale) / 2;
      stageY = (viewportHeight - config.HEIGHT * stageScale) / 2;
    }

    function laneCenter(lane) {
      return lane * config.LANE_WIDTH + config.LANE_WIDTH / 2;
    }

    function roundedRect(x, y, width, height, radius) {
      const r = Math.min(radius, width / 2, height / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + width, y, x + width, y + height, r);
      ctx.arcTo(x + width, y + height, x, y + height, r);
      ctx.arcTo(x, y + height, x, y, r);
      ctx.arcTo(x, y, x + width, y, r);
      ctx.closePath();
    }

    function updateTrackOffset() {
      return;
    }

    function draw(snapshot) {
      const shakeX = (Math.random() - 0.5) * snapshot.shakeAmount;
      const shakeY = (Math.random() - 0.5) * snapshot.shakeAmount;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawViewportBackdrop(snapshot);

      ctx.save();
      ctx.translate(stageX + shakeX, stageY + shakeY);
      ctx.scale(stageScale, stageScale);
      drawTrack(snapshot);
      drawWave(snapshot);
      drawPlayer(snapshot);
      drawParticles(snapshot.effects.particles);
      drawFloaters(snapshot.effects.floaters);
      drawOverlay(snapshot);
      ctx.restore();

      if (snapshot.flashAmount > 0.02) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = Math.min(0.45, snapshot.flashAmount);
        ctx.fillStyle = snapshot.flashColor;
        ctx.fillRect(0, 0, viewportWidth, viewportHeight);
        ctx.restore();
      }
    }

    function drawViewportBackdrop(snapshot) {
      const intensity = boostMotionLevel(snapshot);
      const grd = ctx.createLinearGradient(0, 0, 0, viewportHeight);
      grd.addColorStop(0, "#10171a");
      grd.addColorStop(0.45, "#15181d");
      grd.addColorStop(1, "#0f1012");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, viewportWidth, viewportHeight);

      if (intensity <= 0.01) return;

      ctx.save();
      ctx.globalAlpha = 0.08 + intensity * 0.12;
      ctx.strokeStyle = "#4ac7a5";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([18, 28]);
      const center = viewportWidth / 2;
      const lanePad = config.WIDTH * stageScale * 0.5 + 32;
      const offset = (snapshot.timestamp * (0.08 + intensity * 0.16)) % 46;

      for (let x = center - lanePad - 180; x <= center + lanePad + 180; x += 72) {
        ctx.beginPath();
        ctx.moveTo(x, -offset);
        ctx.lineTo(x, viewportHeight + 46);
        ctx.stroke();
      }

      ctx.setLineDash([]);
      ctx.restore();
    }

    function drawTrack(snapshot) {
      const grd = ctx.createLinearGradient(0, 0, 0, config.HEIGHT);
      grd.addColorStop(0, "#15282d");
      grd.addColorStop(0.45, "#20262e");
      grd.addColorStop(1, "#111214");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, config.WIDTH, config.HEIGHT);

      ctx.fillStyle = "rgba(255,255,255,0.78)";
      snapshot.effects.stars.forEach((star) => {
        ctx.globalAlpha = 0.24 + star.size / 5;
        ctx.fillRect(
          star.x,
          star.y,
          star.size,
          star.size * 3.2,
        );
      });
      ctx.globalAlpha = 1;

      for (let lane = 0; lane < config.LANES; lane += 1) {
        const x = lane * config.LANE_WIDTH;
        const flashState = snapshot.effects.laneFlashes[lane];
        ctx.fillStyle =
          lane === snapshot.playerLane
            ? "rgba(74,199,165,0.12)"
            : "rgba(255,255,255,0.025)";
        ctx.fillRect(x, 0, config.LANE_WIDTH, config.HEIGHT);

        if (flashState.alpha > 0) {
          ctx.save();
          ctx.globalAlpha = flashState.alpha;
          ctx.fillStyle = flashState.color;
          ctx.fillRect(x, 0, config.LANE_WIDTH, config.HEIGHT);
          ctx.restore();
        }

        if (lane > 0) {
          ctx.strokeStyle = "rgba(255,255,255,0.16)";
          ctx.lineWidth = 2;
          ctx.setLineDash([14, 14]);
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, config.HEIGHT);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      drawBoostMotion(snapshot);
      drawCatchZone(snapshot);

      ctx.strokeStyle = "rgba(241,211,91,0.76)";
      ctx.lineWidth = 3;
      ctx.setLineDash([16, 12]);
      ctx.beginPath();
      ctx.moveTo(18, config.CATCH_Y);
      ctx.lineTo(config.WIDTH - 18, config.CATCH_Y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    function drawCatchZone(snapshot) {
      const top = config.CATCH_Y - config.CATCH_WINDOW;
      const height = config.CATCH_WINDOW * 2;
      const activeItem = snapshot.wave
        ? snapshot.wave.items.find((item) => item.lane === snapshot.playerLane)
        : null;
      const zoneColor = activeItem && activeItem.kind === "empty" ? "#4ac7a5" : "#f1d35b";
      const waveY = snapshot.wave ? snapshot.wave.y : -Infinity;
      const approaching =
        snapshot.wave &&
        !snapshot.wave.handled &&
        waveY > top - 110 &&
        waveY < top + height + 18;
      const flipping = snapshot.timestamp < snapshot.flipUntil;

      ctx.save();
      for (let lane = 0; lane < config.LANES; lane += 1) {
        const x = lane * config.LANE_WIDTH;
        const activeLane = lane === snapshot.playerLane;
        ctx.fillStyle = activeLane
          ? `rgba(241,211,91,${approaching ? 0.18 : 0.09})`
          : "rgba(255,255,255,0.025)";
        if (activeLane && activeItem && activeItem.kind === "empty") {
          ctx.fillStyle = `rgba(74,199,165,${approaching ? 0.17 : 0.08})`;
        }
        ctx.fillRect(x + 10, top, config.LANE_WIDTH - 20, height);
      }

      const activeX = laneCenter(snapshot.playerLane);
      ctx.strokeStyle = zoneColor;
      ctx.globalAlpha = approaching || flipping ? 0.88 : 0.45;
      ctx.lineWidth = approaching || flipping ? 4 : 2;
      roundedRect(
        activeX - config.LANE_WIDTH / 2 + 16,
        top + 4,
        config.LANE_WIDTH - 32,
        height - 8,
        8,
      );
      ctx.stroke();

      ctx.restore();
    }

    function boostMotionLevel(snapshot) {
      const motion = Number.isFinite(snapshot.tuning.boostMotion)
        ? snapshot.tuning.boostMotion
        : 0.5;

      return Math.min(1, ((snapshot.speedStack || 0) / config.MAX_SPEED_STACK) * motion);
    }

    function drawBoostMotion(snapshot) {
      const stack = snapshot.speedStack || 0;
      const intensity = boostMotionLevel(snapshot);

      if (stack <= 0 || intensity <= 0.01) return;

      const step = 112 - intensity * 22;
      const dashLength = 22 + stack * 2.2;
      const offset = (snapshot.timestamp * (0.17 + intensity * 0.28)) % step;

      ctx.save();
      ctx.globalAlpha = 0.08 + intensity * 0.18;
      ctx.strokeStyle = "#4ac7a5";
      ctx.lineWidth = 1.4 + intensity * 2.1;
      ctx.lineCap = "round";

      for (let lane = 0; lane < config.LANES; lane += 1) {
        const x = laneCenter(lane);
        const inset = 47 - intensity * 7;

        for (let y = -step + offset; y < config.HEIGHT + step; y += step) {
          ctx.beginPath();
          ctx.moveTo(x - inset, y);
          ctx.lineTo(x - inset, y + dashLength);
          ctx.moveTo(x + inset, y + step * 0.42);
          ctx.lineTo(x + inset, y + step * 0.42 + dashLength);
          ctx.stroke();
        }
      }

      ctx.restore();
    }

    function drawWave(snapshot) {
      const wave = snapshot.wave;
      if (!wave) return;

      const itemSize = snapshot.tuning.itemSize;
      const top = config.CATCH_Y - config.CATCH_WINDOW;
      const bottom = config.CATCH_Y + config.CATCH_WINDOW;

      wave.items.forEach((item) => {
        const activeLane = item.lane === snapshot.playerLane;
        const nearCatch =
          activeLane &&
          !wave.handled &&
          wave.y > top - 78 &&
          wave.y < bottom + 12;
        const inCatchZone =
          activeLane &&
          !wave.handled &&
          wave.y >= top &&
          wave.y <= bottom;
        const tilePulse = nearCatch ? 1 + Math.sin(snapshot.timestamp / 58) * 0.035 : 1;

        if (item.kind === "empty") {
          drawEmptyGate(item.lane, wave.y, itemSize, nearCatch, inCatchZone, tilePulse);
          return;
        }

        const x = laneCenter(item.lane);
        const y = wave.y;
        const handled = wave.handled && activeLane;
        const pulse = handled ? 0.44 : 1;
        const danger = wave.crashed && activeLane;
        const boostGlow = Math.min(8, (snapshot.speedStack || 0) * 0.8);

        ctx.save();
        ctx.translate(x, y);
        ctx.scale(tilePulse, tilePulse);
        ctx.globalAlpha = pulse;
        ctx.shadowColor = danger
          ? "rgba(255,111,97,0.65)"
          : inCatchZone
            ? "rgba(241,211,91,0.74)"
            : "rgba(0,0,0,0.38)";
        ctx.shadowBlur = danger ? 26 : inCatchZone ? 26 : 14 + boostGlow;
        ctx.shadowOffsetY = 10;
        roundedRect(
          -itemSize / 2,
          -itemSize / 2,
          itemSize,
          itemSize,
          8,
        );
        ctx.fillStyle = danger ? "#ff6f61" : "#f2d55b";
        ctx.fill();
        ctx.shadowColor = "transparent";
        ctx.strokeStyle = inCatchZone ? "#f2f2ea" : "rgba(20,20,20,0.35)";
        ctx.lineWidth = inCatchZone ? 5 : 3;
        ctx.stroke();

        ctx.fillStyle = danger ? "#2a0907" : "#17140a";
        ctx.font = `900 ${Math.round(itemSize * 0.52)}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(item.value), 0, 2);
        ctx.restore();
      });
    }

    function drawEmptyGate(lane, y, itemSize, nearCatch, inCatchZone, tilePulse) {
      const x = laneCenter(lane);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(tilePulse, tilePulse);
      ctx.globalAlpha = nearCatch ? 0.72 : 0.44;
      ctx.strokeStyle = "#4ac7a5";
      ctx.lineWidth = inCatchZone ? 6 : 4;
      ctx.shadowColor = inCatchZone ? "rgba(74,199,165,0.64)" : "transparent";
      ctx.shadowBlur = inCatchZone ? 24 : 0;
      ctx.setLineDash([10, 10]);
      roundedRect(-itemSize / 2, -itemSize / 2, itemSize, itemSize, 8);
      ctx.stroke();
      ctx.shadowColor = "transparent";
      ctx.setLineDash([]);
      ctx.fillStyle = inCatchZone ? "rgba(74,199,165,0.16)" : "rgba(74,199,165,0.08)";
      ctx.fill();
      ctx.fillStyle = "#4ac7a5";
      ctx.font = `900 ${Math.max(12, Math.round(itemSize * 0.21))}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("BOOST", 0, 0);
      ctx.restore();
    }

    function drawPlayer(snapshot) {
      const x = laneCenter(snapshot.playerLane);
      const flipping = snapshot.timestamp < snapshot.flipUntil;
      const progress = flipping
        ? 1 - (snapshot.flipUntil - snapshot.timestamp) / config.FLIP_DURATION
        : 0;
      const lift = flipping ? Math.sin(progress * Math.PI) * 74 : 0;
      const spin = flipping ? progress * Math.PI * 2 : 0;
      const stack = snapshot.speedStack || 0;
      const boostWind = boostMotionLevel(snapshot);
      const run = snapshot.timestamp / Math.max(58, 90 - stack * 3.5);
      const stride = Math.sin(run) * (flipping ? 0.25 : 1);
      const armStride = Math.sin(run + Math.PI) * (flipping ? 0.2 : 1);
      const y = config.PLAYER_Y - lift;
      const playerScale = snapshot.tuning.playerScale;
      const scarfFlutter = Math.sin(snapshot.timestamp / 80) * (2 + boostWind * 5);
      const scarfTail = 48 + boostWind * 22;

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(playerScale, playerScale);
      ctx.rotate(spin);

      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(0, 56 + lift * 0.25, 39, 11, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.globalAlpha = 0.52;
      ctx.fillStyle = "#4ac7a5";
      ctx.beginPath();
      ctx.moveTo(-18, -4);
      ctx.lineTo(-scarfTail, -22 - boostWind * 7 + scarfFlutter);
      ctx.lineTo(-26 - boostWind * 8, 12 + scarfFlutter * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = "#6ba8ff";
      roundedRect(-23, -8, 46, 55, 8);
      ctx.fill();
      ctx.fillStyle = "#273248";
      roundedRect(-16, 1, 32, 30, 6);
      ctx.fill();
      ctx.fillStyle = "#f1d35b";
      roundedRect(-12, -3, 24, 8, 4);
      ctx.fill();

      ctx.fillStyle = "#f2f2ea";
      ctx.beginPath();
      ctx.arc(0, -24, 20, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#273248";
      ctx.beginPath();
      ctx.arc(0, -27, 22, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#4ac7a5";
      ctx.beginPath();
      ctx.moveTo(-24, -27);
      ctx.lineTo(23, -33);
      ctx.lineTo(29, -24);
      ctx.lineTo(-22, -19);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#101114";
      roundedRect(-13, -27, 28, 10, 5);
      ctx.fill();
      ctx.fillStyle = "#9fe5ff";
      roundedRect(-10, -25, 22, 5, 3);
      ctx.fill();

      ctx.strokeStyle = "#101114";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-17, 12);
      ctx.lineTo(flipping ? -39 : -31 + armStride * 10, 33 - armStride * 5);
      ctx.moveTo(17, 13);
      ctx.lineTo(flipping ? 38 : 31 - armStride * 10, 34 + armStride * 5);
      ctx.moveTo(-11, 43);
      ctx.lineTo(-24 + stride * 13, 68);
      ctx.moveTo(11, 43);
      ctx.lineTo(25 - stride * 13, 68);
      ctx.stroke();

      ctx.fillStyle = "#f1d35b";
      ctx.beginPath();
      ctx.ellipse(-24 + stride * 13, 70, 14, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(25 - stride * 13, 70, 14, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = flipping ? "#4ac7a5" : "#ff6f61";
      ctx.beginPath();
      ctx.moveTo(22, -2);
      ctx.lineTo(48, 12);
      ctx.lineTo(22, 16);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    function drawParticles(particles) {
      particles.forEach((particle) => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    function drawFloaters(floaters) {
      floaters.forEach((floater) => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, floater.life / floater.maxLife);
        ctx.translate(floater.x, floater.y);
        ctx.scale(floater.scale, floater.scale);
        ctx.fillStyle = floater.color;
        ctx.strokeStyle = "rgba(0,0,0,0.45)";
        ctx.lineWidth = 6;
        ctx.font = "950 24px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeText(floater.text, 0, 0);
        ctx.fillText(floater.text, 0, 0);
        ctx.restore();
      });
    }

    function drawOverlay(snapshot) {
      drawPickTray(snapshot);

      if (snapshot.lastGuessPulse) {
        const progress = 1 - snapshot.lastGuessPulse.life / snapshot.lastGuessPulse.maxLife;
        ctx.save();
        ctx.globalAlpha = Math.max(0, snapshot.lastGuessPulse.life / snapshot.lastGuessPulse.maxLife);
        ctx.translate(config.WIDTH / 2, config.HEIGHT / 2 - 18);
        ctx.scale(1 + progress * 0.18, 1 + progress * 0.18);
        ctx.fillStyle = "#6ba8ff";
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.lineWidth = 10;
        ctx.font = "950 52px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeText(snapshot.lastGuessPulse.text, 0, 0);
        ctx.fillText(snapshot.lastGuessPulse.text, 0, 0);
        ctx.restore();
      }

      if (snapshot.gameEnded) {
        const title = snapshot.endReason === "time" ? "시간 종료" : "게임 종료";
        drawEndOverlay(title, `${snapshot.score} SET`, snapshot.endReason === "time" ? "#f1d35b" : "#ff6f61");
        ctx.fillStyle = "#4ac7a5";
        ctx.font = "850 24px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`플레이 시간 ${formatTime(snapshot.finalTimeMs)}`, config.WIDTH / 2, config.HEIGHT / 2 + 56);
        return;
      }

      if (snapshot.paused) {
        drawEndOverlay("일시정지", "P 또는 버튼으로 재개", "#6ba8ff");
        return;
      }
    }

    function drawPickTray(snapshot) {
      const currentGuess = snapshot.gameState.currentGuess;
      const lastGuess = snapshot.gameState.history[0];
      const showingCurrent = currentGuess.length > 0;
      const values = showingCurrent
        ? currentGuess
        : lastGuess
          ? revealMatchedDigits(lastGuess.guess, snapshot.gameState.secret)
          : [];
      const label = showingCurrent || !lastGuess ? "PICK" : "HIT";
      const color = showingCurrent || !lastGuess ? "#f1d35b" : "#4ac7a5";
      const x = 332;
      const y = 18;
      const width = 140;
      const height = 70;
      const slotSize = 30;
      const gap = 8;
      const slotY = y + 33;
      const firstSlotX = x + 17;

      ctx.save();
      ctx.fillStyle = "rgba(16,17,20,0.54)";
      roundedRect(x, y, width, height, 8);
      ctx.fill();
      ctx.strokeStyle = `rgba(242,242,234,${showingCurrent ? 0.24 : 0.16})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.font = "900 12px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x + 14, y + 17);

      for (let index = 0; index < 3; index += 1) {
        const value = values[index];
        const slotX = firstSlotX + index * (slotSize + gap);
        ctx.fillStyle = value ? "rgba(242,242,234,0.12)" : "rgba(255,255,255,0.045)";
        roundedRect(slotX, slotY, slotSize, slotSize, 7);
        ctx.fill();
        ctx.strokeStyle = value ? color : "rgba(255,255,255,0.1)";
        ctx.lineWidth = value ? 2 : 1;
        ctx.stroke();

        ctx.fillStyle = value ? color : "rgba(242,242,234,0.28)";
        ctx.font = "950 18px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(value ? String(value) : ".", slotX + slotSize / 2, slotY + slotSize / 2 + 1);
      }

      ctx.restore();
    }

    function revealMatchedDigits(guess, secret) {
      const remaining = new Map();

      secret.forEach((digit) => {
        remaining.set(digit, (remaining.get(digit) || 0) + 1);
      });

      return guess.map((digit) => {
        const count = remaining.get(digit) || 0;
        if (count <= 0) {
          return null;
        }

        remaining.set(digit, count - 1);
        return digit;
      });
    }

    function drawBoostBadge(snapshot) {
      const stack = snapshot.speedStack || 0;
      if (stack <= 0) return;

      const level = Math.min(1, stack / config.MAX_SPEED_STACK);
      const x = config.WIDTH - 154;
      const y = 18;
      const width = 136;
      const height = 58;

      ctx.save();
      ctx.fillStyle = "rgba(16,17,20,0.62)";
      roundedRect(x, y, width, height, 8);
      ctx.fill();
      ctx.strokeStyle = `rgba(74,199,165,${0.35 + level * 0.4})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#aef4dc";
      ctx.font = "900 12px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("BOOST", x + 14, y + 20);

      ctx.fillStyle = "#f2f2ea";
      ctx.font = "950 25px Inter, system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`${stack}`, x + width - 14, y + 23);

      ctx.fillStyle = "rgba(255,255,255,0.12)";
      roundedRect(x + 14, y + 41, width - 28, 6, 3);
      ctx.fill();
      ctx.fillStyle = "#4ac7a5";
      roundedRect(x + 14, y + 41, (width - 28) * level, 6, 3);
      ctx.fill();
      ctx.restore();
    }

    function drawEndOverlay(title, subtitle, color) {
      ctx.fillStyle = "rgba(16,17,20,0.78)";
      ctx.fillRect(0, 0, config.WIDTH, config.HEIGHT);
      ctx.fillStyle = color;
      ctx.font = "950 58px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(title, config.WIDTH / 2, config.HEIGHT / 2 - 56);
      ctx.fillStyle = "#f2f2ea";
      ctx.font = "900 34px Inter, system-ui, sans-serif";
      ctx.fillText(subtitle, config.WIDTH / 2, config.HEIGHT / 2 + 6);
    }

    return {
      draw,
      laneCenter,
      resize,
      updateTrackOffset,
    };
  }

  global.RunningBaseballCanvas = {
    createCanvasRenderer,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
