(function attachCanvasRenderer(global) {
  function createCanvasRenderer(canvas, config, formatTime) {
    const ctx = canvas.getContext("2d");
    let viewportWidth = config.WIDTH;
    let viewportHeight = config.HEIGHT;
    let stageX = 0;
    let stageY = 0;
    let stageScale = 1;
    const digitPalette = ["#ffd85c", "#7bdcff", "#ff9dbc", "#a9e875", "#b9a4ff"];

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

    function seededUnit(seed) {
      const value = Math.sin(seed * 127.1) * 43758.5453;
      return value - Math.floor(value);
    }

    function fillPolygon(points, color) {
      ctx.fillStyle = color;
      ctx.beginPath();
      points.forEach(([x, y], index) => {
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.closePath();
      ctx.fill();
    }

    function strokePolygon(points, color, width) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      points.forEach(([x, y], index) => {
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.closePath();
      ctx.stroke();
    }

    function drawLimbSegment(x1, y1, x2, y2, width, color, edgeColor) {
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const nx = Math.cos(angle + Math.PI / 2) * width / 2;
      const ny = Math.sin(angle + Math.PI / 2) * width / 2;
      const points = [
        [x1 + nx, y1 + ny],
        [x2 + nx * 0.75, y2 + ny * 0.75],
        [x2 - nx * 0.75, y2 - ny * 0.75],
        [x1 - nx, y1 - ny],
      ];

      fillPolygon(points, color);
      if (edgeColor) {
        strokePolygon(points, edgeColor, 2);
      }
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
      grd.addColorStop(0, "#0e1b28");
      grd.addColorStop(0.45, "#141727");
      grd.addColorStop(1, "#0d1018");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, viewportWidth, viewportHeight);

      ctx.save();
      ctx.globalAlpha = 0.32;
      const glowA = ctx.createRadialGradient(
        viewportWidth * 0.18,
        viewportHeight * 0.16,
        0,
        viewportWidth * 0.18,
        viewportHeight * 0.16,
        viewportWidth * 0.42,
      );
      glowA.addColorStop(0, "rgba(123,220,255,0.32)");
      glowA.addColorStop(1, "rgba(123,220,255,0)");
      ctx.fillStyle = glowA;
      ctx.fillRect(0, 0, viewportWidth, viewportHeight);

      const glowB = ctx.createRadialGradient(
        viewportWidth * 0.82,
        viewportHeight * 0.12,
        0,
        viewportWidth * 0.82,
        viewportHeight * 0.12,
        viewportWidth * 0.36,
      );
      glowB.addColorStop(0, "rgba(255,216,92,0.22)");
      glowB.addColorStop(1, "rgba(255,216,92,0)");
      ctx.fillStyle = glowB;
      ctx.fillRect(0, 0, viewportWidth, viewportHeight);
      ctx.restore();

      if (intensity <= 0.01) return;

      ctx.save();
      ctx.globalAlpha = 0.06 + intensity * 0.11;
      ctx.strokeStyle = "#7bdcff";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([18, 28]);
      const center = viewportWidth / 2;
      const lanePad = config.WIDTH * stageScale * 0.5 + 32;
      const baseOffset = snapshot.timestamp * (0.08 + intensity * 0.16);

      for (let index = -7; index <= 7; index += 1) {
        const jitter = (seededUnit(index + 19) - 0.5) * 34;
        const x = center + index * 72 + jitter;
        const phase = seededUnit(index + 47) * 52;
        const offset = (baseOffset + phase) % 52;
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
      grd.addColorStop(0, "#17263a");
      grd.addColorStop(0.48, "#1b2033");
      grd.addColorStop(1, "#111521");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, config.WIDTH, config.HEIGHT);

      ctx.save();
      const sideGlow = ctx.createLinearGradient(0, 0, config.WIDTH, 0);
      sideGlow.addColorStop(0, "rgba(123,220,255,0.18)");
      sideGlow.addColorStop(0.24, "rgba(123,220,255,0)");
      sideGlow.addColorStop(0.76, "rgba(255,216,92,0)");
      sideGlow.addColorStop(1, "rgba(255,216,92,0.15)");
      ctx.fillStyle = sideGlow;
      ctx.fillRect(0, 0, config.WIDTH, config.HEIGHT);
      ctx.restore();

      ctx.fillStyle = "rgba(255,255,255,0.78)";
      snapshot.effects.stars.forEach((star) => {
        ctx.globalAlpha = 0.12 + star.size / 7;
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
        const laneActive = lane === snapshot.playerLane;
        ctx.fillStyle =
          laneActive
            ? "rgba(123,220,255,0.1)"
            : "rgba(255,255,255,0.022)";
        ctx.fillRect(x, 0, config.LANE_WIDTH, config.HEIGHT);

        if (laneActive) {
          ctx.save();
          ctx.globalAlpha = 0.2;
          ctx.strokeStyle = "#7bdcff";
          ctx.lineWidth = 2;
          roundedRect(x + 9, 16, config.LANE_WIDTH - 18, config.HEIGHT - 32, 8);
          ctx.stroke();
          ctx.restore();
        }

        if (flashState.alpha > 0) {
          ctx.save();
          ctx.globalAlpha = flashState.alpha;
          ctx.fillStyle = flashState.color;
          ctx.fillRect(x, 0, config.LANE_WIDTH, config.HEIGHT);
          ctx.restore();
        }

        if (lane > 0) {
          ctx.strokeStyle = "rgba(255,255,255,0.12)";
          ctx.lineWidth = 2;
          ctx.setLineDash([10, 18]);
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, config.HEIGHT);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      drawBoostMotion(snapshot);
      drawCatchZone(snapshot);

      ctx.strokeStyle = "rgba(255,216,92,0.72)";
      ctx.lineWidth = 4;
      ctx.setLineDash([18, 12]);
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
      const zoneColor = activeItem && activeItem.kind === "empty" ? "#7bdcff" : "#ffd85c";
      const waveY = snapshot.wave ? snapshot.wave.y : -Infinity;
      const approaching =
        snapshot.wave &&
        !snapshot.wave.handled &&
        waveY > top - 110 &&
        waveY < top + height + 18;
      ctx.save();
      for (let lane = 0; lane < config.LANES; lane += 1) {
        const x = lane * config.LANE_WIDTH;
        const activeLane = lane === snapshot.playerLane;
        ctx.fillStyle = activeLane
          ? `rgba(255,216,92,${approaching ? 0.16 : 0.07})`
          : "rgba(255,255,255,0.025)";
        if (activeLane && activeItem && activeItem.kind === "empty") {
          ctx.fillStyle = `rgba(123,220,255,${approaching ? 0.16 : 0.07})`;
        }
        roundedRect(x + 12, top, config.LANE_WIDTH - 24, height, 10);
        ctx.fill();
      }

      const activeX = laneCenter(snapshot.playerLane);
      ctx.strokeStyle = zoneColor;
      ctx.globalAlpha = approaching ? 0.82 : 0.44;
      ctx.lineWidth = approaching ? 4 : 2;
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

      const baseStep = 112 - intensity * 22;
      const baseDashLength = 22 + stack * 2.2;

      ctx.save();
      ctx.strokeStyle = "#7bdcff";
      ctx.lineWidth = 1.4 + intensity * 2.1;
      ctx.lineCap = "round";

      for (let lane = 0; lane < config.LANES; lane += 1) {
        const laneSeed = lane + 1;
        const laneStep = baseStep * (0.84 + seededUnit(laneSeed * 3) * 0.32);
        const laneSpeed = 0.14 + intensity * (0.24 + seededUnit(laneSeed * 5) * 0.16);
        const laneOffset = (
          snapshot.timestamp * laneSpeed +
          laneStep * seededUnit(laneSeed * 7)
        ) % laneStep;
        const columns = 2 + ((lane + stack) % 2);

        for (let rail = 0; rail < columns; rail += 1) {
          const railSeed = laneSeed * 31 + rail * 17;
          const side = rail === 0 ? -1 : rail === 1 ? 1 : seededUnit(railSeed) > 0.5 ? -0.35 : 0.35;
          const inset = 30 + seededUnit(railSeed + 3) * 34 - intensity * 8;
          const x =
            laneCenter(lane) +
            side * inset +
            Math.sin(snapshot.timestamp / (190 + railSeed * 4) + railSeed) * (2 + intensity * 4);
          const phase = laneStep * seededUnit(railSeed + 9);
          const dashLength = baseDashLength * (0.72 + seededUnit(railSeed + 13) * 0.72);
          const slant = (seededUnit(railSeed + 21) - 0.5) * (10 + intensity * 18);

          ctx.globalAlpha = 0.05 + intensity * (0.09 + seededUnit(railSeed + 33) * 0.1);
          ctx.lineWidth = 1.1 + intensity * (1.4 + seededUnit(railSeed + 37) * 1.6);

          for (let y = -laneStep + laneOffset + phase; y < config.HEIGHT + laneStep; y += laneStep) {
            ctx.beginPath();
            ctx.moveTo(x - slant, y);
            ctx.lineTo(x + slant * 0.3, y + dashLength);
            ctx.stroke();
          }
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
        const boostGlow = Math.min(8, (snapshot.speedStack || 0) * 0.8);
        const tileColor = digitPalette[Math.abs(item.value - 1) % digitPalette.length];
        const tileAccent = item.value % 2 === 0 ? "#ffffff" : "#2b2444";
        const wobble = nearCatch ? Math.sin(snapshot.timestamp / 48 + item.value) * 0.04 : 0;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(wobble);
        ctx.scale(tilePulse, tilePulse);
        ctx.globalAlpha = pulse;
        ctx.shadowColor = inCatchZone
          ? "rgba(255,216,92,0.7)"
          : "rgba(0,0,0,0.38)";
        ctx.shadowBlur = inCatchZone ? 26 : 14 + boostGlow;
        ctx.shadowOffsetY = 10;
        const tileGradient = ctx.createLinearGradient(0, -itemSize / 2, 0, itemSize / 2);
        tileGradient.addColorStop(0, "#fff3a8");
        tileGradient.addColorStop(0.14, tileColor);
        tileGradient.addColorStop(1, "#24314d");
        roundedRect(
          -itemSize / 2,
          -itemSize / 2,
          itemSize,
          itemSize,
          13,
        );
        ctx.fillStyle = tileGradient;
        ctx.fill();
        ctx.shadowColor = "transparent";
        ctx.strokeStyle = inCatchZone ? "#f2f2ea" : "rgba(255,255,255,0.28)";
        ctx.lineWidth = inCatchZone ? 5 : 3;
        ctx.stroke();

        ctx.globalAlpha = pulse * 0.24;
        ctx.fillStyle = "#ffffff";
        roundedRect(-itemSize * 0.32, -itemSize * 0.34, itemSize * 0.38, itemSize * 0.12, 6);
        ctx.fill();
        ctx.globalAlpha = pulse;

        ctx.fillStyle = item.value % 2 === 0 ? "#111521" : "#17140a";
        ctx.strokeStyle = tileAccent;
        ctx.lineWidth = 3;
        ctx.font = `900 ${Math.round(itemSize * 0.52)}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeText(String(item.value), 0, 2);
        ctx.fillText(String(item.value), 0, 2);
        ctx.restore();
      });
    }

    function drawEmptyGate(lane, y, itemSize, nearCatch, inCatchZone, tilePulse) {
      const x = laneCenter(lane);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(tilePulse, tilePulse);
      ctx.globalAlpha = nearCatch ? 0.82 : 0.52;
      ctx.strokeStyle = "#7bdcff";
      ctx.lineWidth = inCatchZone ? 6 : 4;
      ctx.shadowColor = inCatchZone ? "rgba(123,220,255,0.58)" : "transparent";
      ctx.shadowBlur = inCatchZone ? 24 : 0;
      ctx.setLineDash([10, 10]);
      roundedRect(-itemSize / 2, -itemSize / 2, itemSize, itemSize, 14);
      ctx.stroke();
      ctx.shadowColor = "transparent";
      ctx.setLineDash([]);
      ctx.fillStyle = inCatchZone ? "rgba(123,220,255,0.16)" : "rgba(123,220,255,0.08)";
      ctx.fill();
      ctx.fillStyle = "#7bdcff";
      ctx.font = `900 ${Math.max(12, Math.round(itemSize * 0.21))}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("GATE", 0, 0);
      ctx.restore();
    }

    function drawPlayer(snapshot) {
      const x = laneCenter(snapshot.playerLane);
      const stack = snapshot.speedStack || 0;
      const boostWind = boostMotionLevel(snapshot);
      const run = snapshot.timestamp / Math.max(58, 90 - stack * 3.5);
      const stride = Math.sin(run);
      const armStride = Math.sin(run + Math.PI);
      const y = config.PLAYER_Y;
      const playerScale = snapshot.tuning.playerScale;

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(playerScale, playerScale);
      ctx.rotate(-boostWind * 0.04);

      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(0, 58, 42, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      if (boostWind > 0.02) {
        ctx.save();
        ctx.globalAlpha = 0.14 + boostWind * 0.24;
        fillPolygon([[-18, 7], [-72 - boostWind * 22, -18], [-28, 24]], "#7bdcff");
        fillPolygon([[18, 9], [72 + boostWind * 22, -13], [28, 25]], "#b9a4ff");
        fillPolygon([[-10, 40], [-46 - boostWind * 20, 70], [2, 56]], "#ffd85c");
        fillPolygon([[10, 40], [46 + boostWind * 20, 70], [-2, 56]], "#ffd85c");
        ctx.restore();
      }

      ctx.lineJoin = "miter";
      ctx.lineCap = "butt";

      const leftArmX = -36 + armStride * 9;
      const rightArmX = 36 - armStride * 9;
      const leftKneeX = -18 + stride * 15;
      const rightKneeX = 18 - stride * 15;
      const leftFootX = -25 + stride * 18;
      const rightFootX = 25 - stride * 18;

      drawLimbSegment(-25, 0, leftArmX, 28 - armStride * 6, 12, "#273248", "#101114");
      drawLimbSegment(25, 1, rightArmX, 30 + armStride * 6, 12, "#273248", "#101114");
      drawLimbSegment(leftArmX, 28 - armStride * 6, leftArmX - 6, 42 - armStride * 2, 10, "#ffd85c", "#101114");
      drawLimbSegment(rightArmX, 30 + armStride * 6, rightArmX + 6, 44 + armStride * 2, 10, "#ffd85c", "#101114");

      drawLimbSegment(-13, 40, leftKneeX, 58, 15, "#202a3d", "#101114");
      drawLimbSegment(leftKneeX, 58, leftFootX, 79, 13, "#273248", "#101114");
      drawLimbSegment(13, 40, rightKneeX, 58, 15, "#202a3d", "#101114");
      drawLimbSegment(rightKneeX, 58, rightFootX, 79, 13, "#273248", "#101114");

      fillPolygon([[-38, -3], [-24, -16], [-10, -6], [-20, 13]], "#7bdcff");
      fillPolygon([[38, -3], [24, -16], [10, -6], [20, 13]], "#7bdcff");
      strokePolygon([[-38, -3], [-24, -16], [-10, -6], [-20, 13]], "#101114", 2);
      strokePolygon([[38, -3], [24, -16], [10, -6], [20, 13]], "#101114", 2);

      fillPolygon([[-25, -9], [0, -19], [27, -10], [32, 25], [12, 48], [-13, 48], [-32, 24]], "#1f2940");
      fillPolygon([[-18, -5], [0, -13], [0, 43], [-19, 34], [-25, 13]], "#314264");
      fillPolygon([[0, -13], [19, -5], [25, 13], [18, 34], [0, 43]], "#24314d");
      fillPolygon([[-10, 0], [12, 0], [17, 21], [0, 31], [-17, 21]], "#7bdcff");
      fillPolygon([[-7, 5], [8, 5], [11, 17], [0, 23], [-11, 17]], "#9fe5ff");
      strokePolygon([[-25, -9], [0, -19], [27, -10], [32, 25], [12, 48], [-13, 48], [-32, 24]], "#101114", 3);

      fillPolygon([[-24, -30], [-13, -51], [11, -54], [27, -37], [23, -19], [3, -10], [-18, -15]], "#eef4f7");
      fillPolygon([[-18, -31], [-8, -43], [15, -43], [21, -33], [14, -24], [-12, -24]], "#101114");
      fillPolygon([[-13, -32], [-5, -39], [14, -39], [17, -34], [10, -30], [-10, -28]], "#9fe5ff");
      fillPolygon([[-24, -31], [-13, -51], [-8, -43], [-18, -31]], "#c7d6df");
      fillPolygon([[11, -54], [27, -37], [21, -33], [15, -43]], "#d9e6ec");
      strokePolygon([[-24, -30], [-13, -51], [11, -54], [27, -37], [23, -19], [3, -10], [-18, -15]], "#101114", 3);

      fillPolygon([[-6, -15], [8, -15], [13, -7], [-10, -6]], "#ffd85c");
      fillPolygon([[-21, 78], [-5, 75], [1, 84], [-18, 88], [-31, 84]], "#ffd85c");
      fillPolygon([[21, 78], [5, 75], [-1, 84], [18, 88], [31, 84]], "#ffd85c");

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
        ctx.strokeStyle = "rgba(8,11,18,0.72)";
        ctx.lineWidth = 7;
        ctx.font = "950 26px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeText(floater.text, 0, 0);
        ctx.fillText(floater.text, 0, 0);
        ctx.restore();
      });
    }

    function drawOverlay(snapshot) {
      drawPickTray(snapshot);
      drawNextPreview(snapshot);

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
        drawEndOverlay(
          title,
          `${snapshot.score}점 · ${snapshot.clearedSets}세트`,
          snapshot.endReason === "time" ? "#f1d35b" : "#ff6f61",
        );
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
      const color = showingCurrent || !lastGuess ? "#ffd85c" : "#7bdcff";
      const width = 140;
      const height = 70;
      const x = config.WIDTH / 2 - width / 2;
      const y = 18;
      const slotSize = 30;
      const gap = 8;
      const slotY = y + 33;
      const firstSlotX = x + 17;

      ctx.save();
      const panelGradient = ctx.createLinearGradient(x, y, x, y + height);
      panelGradient.addColorStop(0, "rgba(38,47,76,0.82)");
      panelGradient.addColorStop(1, "rgba(15,19,34,0.78)");
      ctx.fillStyle = panelGradient;
      roundedRect(x, y, width, height, 8);
      ctx.fill();
      ctx.strokeStyle = showingCurrent
        ? "rgba(255,216,92,0.5)"
        : "rgba(123,220,255,0.42)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.font = "900 12px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x + 14, y + 17);

      for (let index = 0; index < 3; index += 1) {
        const value = values[index];
        const slotX = firstSlotX + index * (slotSize + gap);
        ctx.fillStyle = value ? "rgba(255,216,92,0.13)" : "rgba(255,255,255,0.045)";
        roundedRect(slotX, slotY, slotSize, slotSize, 7);
        ctx.fill();
        ctx.strokeStyle = value ? color : "rgba(255,255,255,0.1)";
        ctx.lineWidth = value ? 2 : 1;
        ctx.stroke();

        ctx.fillStyle = value ? "#f2f2ea" : "rgba(242,242,234,0.28)";
        ctx.font = "950 18px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(value ? String(value) : ".", slotX + slotSize / 2, slotY + slotSize / 2 + 1);
      }

      ctx.restore();
    }

    function drawNextPreview(snapshot) {
      const values = Array.isArray(snapshot.nextWaveDigits)
        ? snapshot.nextWaveDigits
        : [];
      const pickTrayWidth = 140;
      const gapFromPickTray = 10;
      const width = 128;
      const height = 70;
      const x = config.WIDTH / 2 + pickTrayWidth / 2 + gapFromPickTray;
      const y = 18;
      const slotSize = 27;
      const gap = 7;
      const slotY = y + 33;
      const firstSlotX = x + 13;

      ctx.save();
      const nextGradient = ctx.createLinearGradient(x, y, x, y + height);
      nextGradient.addColorStop(0, "rgba(35,47,78,0.78)");
      nextGradient.addColorStop(1, "rgba(14,18,32,0.74)");
      ctx.fillStyle = nextGradient;
      roundedRect(x, y, width, height, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(123,220,255,0.42)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#7bdcff";
      ctx.font = "900 11px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("NEXT", x + 14, y + 15);

      for (let index = 0; index < 3; index += 1) {
        const value = values[index];
        const slotX = firstSlotX + index * (slotSize + gap);
        ctx.fillStyle = value ? "rgba(123,220,255,0.14)" : "rgba(255,255,255,0.04)";
        roundedRect(slotX, slotY, slotSize, slotSize, 7);
        ctx.fill();
        ctx.strokeStyle = value ? "rgba(123,220,255,0.62)" : "rgba(255,255,255,0.1)";
        ctx.lineWidth = value ? 2 : 1;
        ctx.stroke();

        ctx.fillStyle = value ? "#f2f2ea" : "rgba(242,242,234,0.28)";
        ctx.font = "950 17px Inter, system-ui, sans-serif";
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
      ctx.fillStyle = "rgba(21,28,47,0.72)";
      roundedRect(x, y, width, height, 8);
      ctx.fill();
      ctx.strokeStyle = `rgba(123,220,255,${0.28 + level * 0.36})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#7bdcff";
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
      ctx.fillStyle = "#7bdcff";
      roundedRect(x + 14, y + 41, (width - 28) * level, 6, 3);
      ctx.fill();
      ctx.restore();
    }

    function drawEndOverlay(title, subtitle, color) {
      ctx.fillStyle = "rgba(9,12,20,0.82)";
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
