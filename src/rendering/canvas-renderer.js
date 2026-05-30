(function attachCanvasRenderer(global) {
  function createCanvasRenderer(canvas, config, formatTime) {
    const ctx = canvas.getContext("2d");
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
      const cameraScale = cameraScaleFor(snapshot);

      ctx.fillStyle = "#101114";
      ctx.fillRect(0, 0, config.WIDTH, config.HEIGHT);

      ctx.save();
      ctx.translate(shakeX, shakeY);
      ctx.translate(config.WIDTH / 2, config.HEIGHT * 0.54);
      ctx.scale(cameraScale, cameraScale);
      ctx.translate(-config.WIDTH / 2, -config.HEIGHT * 0.54);
      drawTrack(snapshot);
      drawWave(
        snapshot.wave,
        snapshot.playerLane,
        snapshot.tuning.itemSize,
        snapshot.gameState.rejectedDigits,
      );
      drawPlayer(snapshot);
      drawHeldDigits(snapshot);
      drawParticles(snapshot.effects.particles);
      drawFloaters(snapshot.effects.floaters);
      ctx.restore();

      ctx.save();
      ctx.translate(shakeX, shakeY);
      drawKnownDigitsBanner(snapshot.gameState.knownDigits, snapshot.guessFlight);
      drawGuessFlight(snapshot);
      drawOverlay(snapshot);
      ctx.restore();

      if (snapshot.flashAmount > 0.02) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.45, snapshot.flashAmount);
        ctx.fillStyle = snapshot.flashColor;
        ctx.fillRect(0, 0, config.WIDTH, config.HEIGHT);
        ctx.restore();
      }
    }

    function cameraScaleFor(snapshot) {
      const speed = typeof snapshot.speedMultiplier === "function"
        ? snapshot.speedMultiplier()
        : 1;
      const pullback = Math.max(0, Math.min(0.1, (speed - 1) * 0.045));
      return 1 - pullback;
    }

    function drawTrack(snapshot) {
      const grd = ctx.createLinearGradient(0, 0, 0, config.HEIGHT);
      grd.addColorStop(0, "#15282d");
      grd.addColorStop(0.45, "#20262e");
      grd.addColorStop(1, "#111214");
      ctx.fillStyle = grd;
      ctx.fillRect(-80, -80, config.WIDTH + 160, config.HEIGHT + 160);

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

      ctx.strokeStyle = "rgba(241,211,91,0.76)";
      ctx.lineWidth = 3;
      ctx.setLineDash([16, 12]);
      ctx.beginPath();
      ctx.moveTo(18, config.CATCH_Y);
      ctx.lineTo(config.WIDTH - 18, config.CATCH_Y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    function drawWave(wave, playerLane, itemSize, rejectedDigits) {
      if (!wave) return;

      const rejected = new Set(rejectedDigits || []);

      wave.items.forEach((item) => {
        if (item.kind === "empty") {
          drawEmptyGate(item.lane, wave.y, itemSize);
          return;
        }

        const x = laneCenter(item.lane);
        const y = wave.y;
        const handled = wave.handled && item.lane === playerLane;
        const pulse = handled ? 0.44 : 1;
        const danger = wave.crashed && item.lane === playerLane;
        const knownMiss = rejected.has(item.value);

        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.shadowColor =
          danger || knownMiss ? "rgba(255,111,97,0.72)" : "rgba(0,0,0,0.38)";
        ctx.shadowBlur = danger || knownMiss ? 26 : 16;
        ctx.shadowOffsetY = 10;
        roundedRect(
          x - itemSize / 2,
          y - itemSize / 2,
          itemSize,
          itemSize,
          8,
        );
        ctx.fillStyle = danger ? "#ff6f61" : "#f2d55b";
        ctx.fill();
        ctx.shadowColor = "transparent";
        ctx.strokeStyle = knownMiss ? "#ff6f61" : "rgba(20,20,20,0.35)";
        ctx.lineWidth = knownMiss ? 5 : 3;
        ctx.stroke();

        ctx.fillStyle = danger ? "#2a0907" : "#17140a";
        ctx.font = `900 ${Math.round(itemSize * 0.52)}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(item.value), x, y + 2);
        ctx.restore();
      });
    }

    function drawEmptyGate(lane, y, itemSize) {
      const x = laneCenter(lane);
      ctx.save();
      ctx.globalAlpha = 0.44;
      ctx.strokeStyle = "#4ac7a5";
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 10]);
      roundedRect(x - itemSize / 2, y - itemSize / 2, itemSize, itemSize, 8);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(74,199,165,0.08)";
      ctx.fill();
      ctx.fillStyle = "#4ac7a5";
      ctx.font = `900 ${Math.max(12, Math.round(itemSize * 0.21))}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("BOOST", x, y);
      ctx.restore();
    }

    function drawPlayer(snapshot) {
      const x = laneCenter(snapshot.playerLane);
      const flipping = snapshot.timestamp < snapshot.flipUntil;
      const progress = flipping
        ? 1 - (snapshot.flipUntil - snapshot.timestamp) / config.FLIP_DURATION
        : 0;
      const lift = flipping ? Math.sin(progress * Math.PI) * 64 : 0;
      const spin = flipping ? progress * Math.PI * 2 : 0;
      const run = snapshot.timestamp / 90;
      const stride = Math.sin(run) * (flipping ? 0.25 : 1);
      const armStride = Math.sin(run + Math.PI) * (flipping ? 0.2 : 1);
      const y = config.PLAYER_Y - lift;
      const playerScale = snapshot.tuning.playerScale;

      if (snapshot.speedStack >= config.MAX_SPEED_STACK) {
        drawMaxBoostAura(x, y, snapshot.timestamp);
      }

      if (flipping) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(spin);
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = "#4ac7a5";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 4, 48, -Math.PI * 0.25, Math.PI * 1.15);
        ctx.stroke();
        ctx.restore();
      }

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
      ctx.lineTo(-48, -22);
      ctx.lineTo(-26, 12);
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

    function drawMaxBoostAura(x, y, timestamp) {
      const pulse = 0.82 + Math.sin(timestamp / 74) * 0.12;
      const flicker = Math.sin(timestamp / 37) * 6;

      ctx.save();
      ctx.translate(x, y + 16);
      ctx.globalCompositeOperation = "lighter";

      for (let index = 0; index < 7; index += 1) {
        const angle = (index / 7) * Math.PI * 2 + timestamp / 260;
        const flameX = Math.cos(angle) * (28 + Math.sin(timestamp / 90 + index) * 8);
        const flameY = Math.sin(angle) * 10 + 14;
        const height = 82 + Math.sin(timestamp / 62 + index) * 18;

        const gradient = ctx.createLinearGradient(flameX, flameY + 38, flameX, flameY - height);
        gradient.addColorStop(0, "rgba(255,111,97,0)");
        gradient.addColorStop(0.28, "rgba(255,111,97,0.72)");
        gradient.addColorStop(0.68, "rgba(241,211,91,0.78)");
        gradient.addColorStop(1, "rgba(255,255,255,0.2)");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(flameX - 22 * pulse, flameY + 34);
        ctx.quadraticCurveTo(flameX - 36, flameY - 18, flameX + flicker, flameY - height);
        ctx.quadraticCurveTo(flameX + 38, flameY - 16, flameX + 22 * pulse, flameY + 34);
        ctx.closePath();
        ctx.fill();
      }

      ctx.strokeStyle = "rgba(241,211,91,0.74)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 2, 58 + Math.sin(timestamp / 88) * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    function drawHeldDigits(snapshot) {
      const x = laneCenter(snapshot.playerLane);
      const y = config.PLAYER_Y + 86;
      const digits = snapshot.gameState.currentGuess;
      const slotSize = 30;
      const gap = 6;
      const totalWidth = slotSize * 3 + gap * 2;
      const left = x - totalWidth / 2;

      ctx.save();
      ctx.fillStyle = "rgba(16,17,20,0.74)";
      roundedRect(left - 10, y - 22, totalWidth + 20, 44, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(241,211,91,0.56)";
      ctx.lineWidth = 2;
      ctx.stroke();

      for (let index = 0; index < 3; index += 1) {
        const slotX = left + index * (slotSize + gap);
        const digit = digits[index];
        roundedRect(slotX, y - slotSize / 2, slotSize, slotSize, 6);
        ctx.fillStyle = digit ? "#f1d35b" : "rgba(255,255,255,0.1)";
        ctx.fill();
        ctx.strokeStyle = digit ? "rgba(20,20,20,0.42)" : "rgba(255,255,255,0.18)";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = digit ? "#17140a" : "rgba(242,242,234,0.42)";
        ctx.font = "900 18px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(digit ? String(digit) : ".", slotX + slotSize / 2, y + 1);
      }

      ctx.restore();
    }

    function drawKnownDigitsBanner(knownDigits, guessFlight) {
      const digits = guessFlight ? guessFlight.previousKnownDigits : (knownDigits || []);
      const width = 318;
      const height = 82;
      const x = config.WIDTH / 2 - width / 2;
      const y = 18;

      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.54)";
      roundedRect(x, y, width, height, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(241,211,91,0.42)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#aeb3aa";
      ctx.font = "900 13px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("알아낸 숫자", config.WIDTH / 2, y + 18);

      const slotSize = 38;
      const gap = 10;
      const totalWidth = 3 * slotSize + 2 * gap;
      const left = config.WIDTH / 2 - totalWidth / 2;

      for (let index = 0; index < 3; index += 1) {
        const digit = digits[index];
        const slotX = left + index * (slotSize + gap);
        const slotY = y + 35;
        roundedRect(slotX, slotY, slotSize, slotSize, 8);
        ctx.fillStyle = digit ? "#f1d35b" : "rgba(255,255,255,0.1)";
        ctx.fill();
        ctx.strokeStyle = digit ? "rgba(20,20,20,0.36)" : "rgba(255,255,255,0.18)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = digit ? "#17140a" : "rgba(242,242,234,0.48)";
        ctx.font = "950 24px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(digit ? String(digit) : ".", slotX + slotSize / 2, slotY + slotSize / 2 + 1);
      }

      ctx.restore();
    }

    function drawGuessFlight(snapshot) {
      const flight = snapshot.guessFlight;
      if (!flight) return;

      const progress = Math.max(
        0,
        Math.min(1, (snapshot.timestamp - flight.startedAt) / flight.duration),
      );
      const eased = 1 - Math.pow(1 - progress, 3);
      const arc = Math.sin(progress * Math.PI) * 74;
      const startX = laneCenter(snapshot.playerLane);
      const startY = config.PLAYER_Y + 86;
      const targetY = 18 + 35 + 19;
      const slotSize = 38;
      const gap = 10;
      const totalWidth = 3 * slotSize + 2 * gap;
      const targetLeft = config.WIDTH / 2 - totalWidth / 2;
      const startGap = 38;

      ctx.save();
      flight.guess.forEach((digit, index) => {
        const startSlotX = startX + (index - 1) * startGap;
        const targetX = targetLeft + index * (slotSize + gap) + slotSize / 2;
        const x = startSlotX + (targetX - startSlotX) * eased;
        const y = startY + (targetY - startY) * eased - arc;
        const scale = 1 + Math.sin(progress * Math.PI) * 0.22;
        const alpha = progress > 0.88 ? Math.max(0, 1 - (progress - 0.88) / 0.12) : 1;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        roundedRect(-17, -17, 34, 34, 7);
        ctx.fillStyle = "#f1d35b";
        ctx.fill();
        ctx.strokeStyle = "rgba(20,20,20,0.38)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#17140a";
        ctx.font = "950 21px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(digit), 0, 1);
        ctx.restore();
      });

      if (progress > 0.82) {
        const reveal = Math.min(1, (progress - 0.82) / 0.18);
        drawKnownReveal(flight.finalKnownDigits, reveal);
      }

      ctx.restore();
    }

    function drawKnownReveal(knownDigits, alpha) {
      const digits = knownDigits || [];
      const slotSize = 38;
      const gap = 10;
      const totalWidth = 3 * slotSize + 2 * gap;
      const left = config.WIDTH / 2 - totalWidth / 2;
      const y = 18 + 35;

      ctx.save();
      ctx.globalAlpha = alpha;
      for (let index = 0; index < 3; index += 1) {
        const digit = digits[index];
        const slotX = left + index * (slotSize + gap);
        roundedRect(slotX, y, slotSize, slotSize, 8);
        ctx.fillStyle = digit ? "#f1d35b" : "rgba(255,255,255,0.1)";
        ctx.fill();
        ctx.strokeStyle = digit ? "rgba(20,20,20,0.36)" : "rgba(255,255,255,0.18)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = digit ? "#17140a" : "rgba(242,242,234,0.48)";
        ctx.font = "950 24px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(digit ? String(digit) : ".", slotX + slotSize / 2, y + slotSize / 2 + 1);
      }
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
      ctx.fillStyle = "rgba(0,0,0,0.36)";
      roundedRect(18, 18, 230, 70, 8);
      ctx.fill();
      ctx.fillStyle = "#f2f2ea";
      ctx.font = "900 18px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(`Score ${snapshot.gameState.score}`, 34, 40);
      ctx.fillStyle = "#4ac7a5";
      ctx.font = "800 15px Inter, system-ui, sans-serif";
      ctx.fillText(`Solved ${snapshot.gameState.solvedCount}  ·  Boost ${snapshot.speedStack}`, 34, 65);

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

      if (snapshot.timedOut) {
        drawEndOverlay("시간 종료", `${snapshot.gameState.score}점`, "#ff6f61");
        ctx.fillStyle = "#4ac7a5";
        ctx.font = "850 26px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`정답 ${snapshot.gameState.solvedCount}개`, config.WIDTH / 2, config.HEIGHT / 2 + 56);
        return;
      }
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
      updateTrackOffset,
    };
  }

  global.RunningBaseballCanvas = {
    createCanvasRenderer,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
