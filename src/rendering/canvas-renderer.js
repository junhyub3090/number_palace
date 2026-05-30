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

      ctx.save();
      ctx.translate(shakeX, shakeY);
      drawTrack(snapshot);
      drawWave(snapshot.wave, snapshot.playerLane, snapshot.tuning.itemSize);
      drawPlayer(snapshot);
      drawParticles(snapshot.effects.particles);
      drawFloaters(snapshot.effects.floaters);
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

      ctx.strokeStyle = "rgba(241,211,91,0.76)";
      ctx.lineWidth = 3;
      ctx.setLineDash([16, 12]);
      ctx.beginPath();
      ctx.moveTo(18, config.CATCH_Y);
      ctx.lineTo(config.WIDTH - 18, config.CATCH_Y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    function drawWave(wave, playerLane, itemSize) {
      if (!wave) return;

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

        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.shadowColor = danger ? "rgba(255,111,97,0.65)" : "rgba(0,0,0,0.38)";
        ctx.shadowBlur = danger ? 26 : 16;
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
        ctx.strokeStyle = "rgba(20,20,20,0.35)";
        ctx.lineWidth = 3;
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
      ctx.fillText(`Guess ${snapshot.gameState.history.length + 1}`, 34, 40);
      ctx.fillStyle = "#4ac7a5";
      ctx.font = "800 15px Inter, system-ui, sans-serif";
      ctx.fillText(`${formatTime(snapshot.elapsedMs)}  ·  Boost ${snapshot.speedStack}`, 34, 65);

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

      if (snapshot.paused && !snapshot.gameState.solved && !snapshot.timedOut) {
        drawEndOverlay("일시정지", "P 또는 버튼으로 재개", "#6ba8ff");
        return;
      }

      if (snapshot.timedOut && !snapshot.gameState.solved) {
        drawEndOverlay("시간 종료", "새 게임으로 다시 도전", "#ff6f61");
        return;
      }

      if (!snapshot.gameState.solved) return;

      drawEndOverlay("정답!", snapshot.gameState.secret.join(""), "#f1d35b");
      ctx.fillStyle = "#4ac7a5";
      ctx.font = "850 26px Inter, system-ui, sans-serif";
      ctx.fillText(`걸린 시간 ${formatTime(snapshot.finalTimeMs)}`, config.WIDTH / 2, config.HEIGHT / 2 + 56);
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
