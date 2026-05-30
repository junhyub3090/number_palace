(function attachCanvasRenderer(global) {
  function createCanvasRenderer(canvas, config, formatTime) {
    const ctx = canvas.getContext("2d");
    const NUMBER_FONT_FAMILY =
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const DIGIT_TILE_COLORS = [
      "#d6bb57",
      "#68b89b",
      "#719bd6",
      "#d7848b",
      "#a88bd6",
      "#70b8c8",
      "#d39a58",
      "#94bc6a",
      "#d482bd",
    ];
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

    function digitColor(value) {
      const numericValue = Number(value);
      if (!Number.isFinite(numericValue)) return DIGIT_TILE_COLORS[0];

      return DIGIT_TILE_COLORS[
        Math.abs(Math.round(numericValue) - 1) % DIGIT_TILE_COLORS.length
      ];
    }

    function numberFont(size, weight = 950) {
      return `${weight} ${Math.round(size)}px ${NUMBER_FONT_FAMILY}`;
    }

    function drawNumberText(value, x, y, size, color) {
      ctx.fillStyle = color;
      ctx.font = numberFont(size);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(value), x, y);
    }

    function drawDigitTile(value, x, y, size, options = {}) {
      const radius = options.radius || Math.max(6, Math.round(size * 0.18));
      const active = Boolean(options.active);
      const color = digitColor(value);
      const borderWidth =
        options.borderWidth || (active ? Math.max(3, size * 0.09) : Math.max(1.5, size * 0.052));

      ctx.save();
      ctx.translate(x, y);
      roundedRect(-size / 2, -size / 2, size, size, radius);
      ctx.fillStyle = color;
      ctx.fill();

      ctx.shadowColor = "transparent";
      ctx.fillStyle = active ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.15)";
      roundedRect(
        -size / 2 + size * 0.12,
        -size / 2 + size * 0.1,
        size * 0.76,
        size * 0.22,
        Math.max(4, radius * 0.6),
      );
      ctx.fill();

      ctx.strokeStyle = active ? "#f2f2ea" : "rgba(16,17,20,0.46)";
      ctx.lineWidth = borderWidth;
      roundedRect(-size / 2, -size / 2, size, size, radius);
      ctx.stroke();

      drawNumberText(
        value,
        0,
        size * 0.035,
        options.fontSize || size * 0.54,
        options.textColor || "#17140a",
      );
      ctx.restore();
    }

    function drawEmptyNumberSlot(x, y, size, options = {}) {
      const radius = options.radius || Math.max(6, Math.round(size * 0.18));

      ctx.save();
      ctx.translate(x, y);
      roundedRect(-size / 2, -size / 2, size, size, radius);
      ctx.fillStyle = "rgba(255,255,255,0.045)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = options.borderWidth || 1;
      ctx.stroke();
      drawNumberText(".", 0, size * 0.02, options.fontSize || size * 0.56, "rgba(242,242,234,0.3)");
      ctx.restore();
    }

    function seededUnit(seed) {
      const value = Math.sin(seed * 127.1) * 43758.5453;
      return value - Math.floor(value);
    }

    function clamp01(value) {
      return Math.max(0, Math.min(1, value || 0));
    }

    function easeOutCubic(progress) {
      const inverted = 1 - clamp01(progress);
      return 1 - inverted * inverted * inverted;
    }

    function dashImpactProgress(snapshot, impact) {
      if (!impact) return 0;

      return clamp01((snapshot.timestamp - impact.startTime) / (impact.duration * 1000));
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
      grd.addColorStop(0, "#10171a");
      grd.addColorStop(0.45, "#15181d");
      grd.addColorStop(1, "#0f1012");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, viewportWidth, viewportHeight);

      if (intensity <= 0.01) return;

      ctx.save();
      ctx.globalAlpha = 0.06 + intensity * 0.11;
      ctx.strokeStyle = "#4ac7a5";
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
      ctx.globalAlpha = approaching ? 0.88 : 0.45;
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
      ctx.strokeStyle = "#4ac7a5";
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

          ctx.globalAlpha = 0.06 + intensity * (0.11 + seededUnit(railSeed + 33) * 0.11);
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
      const impact = wave.dashImpact || null;
      const impactProgress = dashImpactProgress(snapshot, impact);
      const collisionProgress = impact ? impact.collisionProgress || 0.5 : 0;
      const afterImpactProgress = impact
        ? clamp01((impactProgress - collisionProgress) / Math.max(0.001, 1 - collisionProgress))
        : 0;
      const preImpactProgress = impact && collisionProgress > 0
        ? clamp01(impactProgress / collisionProgress)
        : impactProgress;

      if (impact) {
        drawDashImpactCue(wave, impact, impactProgress, itemSize);
      }

      wave.items.forEach((item) => {
        const activeLane = item.lane === snapshot.playerLane;
        const impactActive = impact && item.lane === impact.lane;
        const impactHit = Boolean(impactActive && impactProgress >= collisionProgress);
        const impactAlpha = impact
          ? impactActive && impactHit
            ? Math.max(0, 1 - afterImpactProgress * 5)
            : impactActive
              ? 1
              : 1 - afterImpactProgress * 0.2
          : 1;
        const impactYOffset = impact
          ? impactActive
            ? impactHit
              ? config.CATCH_Y - wave.y
              : 0
            : 0
          : 0;
        const impactScale = impact
          ? impactActive
            ? impactHit
              ? 1 + afterImpactProgress * 0.72
              : 1 + preImpactProgress * 0.16
            : 1
          : 1;
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
        const inDashImpact = Boolean(
          impactActive &&
          impactProgress >= Math.max(0, collisionProgress - 0.08) &&
          afterImpactProgress < 0.45,
        );
        const tilePulse = nearCatch ? 1 + Math.sin(snapshot.timestamp / 58) * 0.035 : 1;
        const itemY = wave.y + impactYOffset;

        if (item.kind === "empty") {
          drawEmptyGate(
            item.lane,
            itemY,
            itemSize,
            nearCatch || Boolean(impactActive),
            inCatchZone || inDashImpact,
            tilePulse * impactScale,
            impactAlpha,
          );
          return;
        }

        const x = laneCenter(item.lane);
        const y = itemY;
        const handled = wave.handled && activeLane && !impact;
        const pulse = handled ? 0.44 : 1;
        const boostGlow = Math.min(8, (snapshot.speedStack || 0) * 0.8);

        ctx.save();
        ctx.translate(x, y);
        ctx.scale(tilePulse * impactScale, tilePulse * impactScale);
        ctx.globalAlpha = pulse * impactAlpha;
        ctx.shadowColor = inCatchZone || inDashImpact
          ? "rgba(241,211,91,0.74)"
          : "rgba(0,0,0,0.38)";
        ctx.shadowBlur = inCatchZone || inDashImpact ? 26 : 14 + boostGlow;
        ctx.shadowOffsetY = 10;
        drawDigitTile(item.value, 0, 0, itemSize, {
          active: inCatchZone || inDashImpact,
          radius: 8,
        });
        ctx.restore();
      });
    }

    function drawDashImpactCue(wave, impact, progress, itemSize) {
      const laneItem = wave.items.find((item) => item.lane === impact.lane);
      const color = laneItem && laneItem.kind === "empty" ? "#4ac7a5" : "#f1d35b";
      const x = laneCenter(impact.lane);
      const collisionProgress = impact.collisionProgress || 0.5;
      const preImpactProgress = collisionProgress > 0
        ? clamp01(progress / collisionProgress)
        : progress;
      const late = clamp01((progress - collisionProgress) / Math.max(0.001, 1 - collisionProgress));
      const ring = Math.sin(late * Math.PI);

      ctx.save();
      ctx.lineCap = "round";

      ctx.globalAlpha = 0.14 + preImpactProgress * 0.22;
      ctx.fillStyle = color;
      roundedRect(
        x - config.LANE_WIDTH / 2 + 12,
        Math.max(40, wave.y - itemSize * 1.25),
        config.LANE_WIDTH - 24,
        Math.max(28, Math.min(180, config.CATCH_Y - wave.y + itemSize * 0.9)),
        8,
      );
      ctx.fill();

      for (let lane = 0; lane < config.LANES; lane += 1) {
        const laneX = laneCenter(lane);
        const laneOffset = (lane - 1.5) * 4;
        ctx.globalAlpha = lane === impact.lane ? 0.24 + preImpactProgress * 0.3 : 0.08 + progress * 0.14;
        ctx.strokeStyle = lane === impact.lane ? color : "rgba(242,242,234,0.42)";
        ctx.lineWidth = lane === impact.lane ? 4 : 2;
        ctx.beginPath();
        ctx.moveTo(laneX - 30 + laneOffset, Math.max(30, wave.y - itemSize * 2.2));
        ctx.lineTo(laneX + 16 + laneOffset, Math.min(config.HEIGHT + 170, wave.y + itemSize * 2.7));
        ctx.stroke();
      }

      if (late > 0) {
        ctx.globalAlpha = 0.44 * ring;
        ctx.fillStyle = color;
        roundedRect(
          x - config.LANE_WIDTH / 2 + 18,
          config.CATCH_Y - 12,
          config.LANE_WIDTH - 36,
          24,
          8,
        );
        ctx.fill();

        ctx.globalAlpha = 0.86 * ring;
        ctx.strokeStyle = color;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.arc(x, config.CATCH_Y, 28 + late * 58, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = 0.62 * ring;
        ctx.strokeStyle = "#f2f2ea";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x - 78, config.CATCH_Y);
        ctx.lineTo(x - 28, config.CATCH_Y);
        ctx.moveTo(x + 28, config.CATCH_Y);
        ctx.lineTo(x + 78, config.CATCH_Y);
        ctx.moveTo(x, config.CATCH_Y - 58);
        ctx.lineTo(x, config.CATCH_Y - 24);
        ctx.moveTo(x, config.CATCH_Y + 24);
        ctx.lineTo(x, config.CATCH_Y + 58);
        ctx.stroke();

        ctx.globalAlpha = 0.72 * ring;
        fillPolygon(
          [[x - 12, config.CATCH_Y - 14], [x - 55, config.CATCH_Y - 36], [x - 22, config.CATCH_Y + 2]],
          color,
        );
        fillPolygon(
          [[x + 12, config.CATCH_Y + 14], [x + 56, config.CATCH_Y + 38], [x + 22, config.CATCH_Y - 2]],
          color,
        );
        fillPolygon(
          [[x - 8, config.CATCH_Y + 18], [x - 38, config.CATCH_Y + 70], [x + 8, config.CATCH_Y + 32]],
          "#f2f2ea",
        );
      }

      ctx.restore();
    }

    function drawEmptyGate(lane, y, itemSize, nearCatch, inCatchZone, tilePulse, alpha = 1) {
      const x = laneCenter(lane);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(tilePulse, tilePulse);
      ctx.globalAlpha = (nearCatch ? 0.72 : 0.44) * alpha;
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
      ctx.font = numberFont(Math.max(12, itemSize * 0.21), 900);
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
        ctx.globalAlpha = 0.18 + boostWind * 0.28;
        fillPolygon([[-18, 7], [-72 - boostWind * 22, -18], [-28, 24]], "#4ac7a5");
        fillPolygon([[18, 9], [72 + boostWind * 22, -13], [28, 25]], "#6ba8ff");
        fillPolygon([[-10, 40], [-46 - boostWind * 20, 70], [2, 56]], "#f1d35b");
        fillPolygon([[10, 40], [46 + boostWind * 20, 70], [-2, 56]], "#f1d35b");
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
      drawLimbSegment(leftArmX, 28 - armStride * 6, leftArmX - 6, 42 - armStride * 2, 10, "#f1d35b", "#101114");
      drawLimbSegment(rightArmX, 30 + armStride * 6, rightArmX + 6, 44 + armStride * 2, 10, "#f1d35b", "#101114");

      drawLimbSegment(-13, 40, leftKneeX, 58, 15, "#202a3d", "#101114");
      drawLimbSegment(leftKneeX, 58, leftFootX, 79, 13, "#273248", "#101114");
      drawLimbSegment(13, 40, rightKneeX, 58, 15, "#202a3d", "#101114");
      drawLimbSegment(rightKneeX, 58, rightFootX, 79, 13, "#273248", "#101114");

      fillPolygon([[-38, -3], [-24, -16], [-10, -6], [-20, 13]], "#6ba8ff");
      fillPolygon([[38, -3], [24, -16], [10, -6], [20, 13]], "#6ba8ff");
      strokePolygon([[-38, -3], [-24, -16], [-10, -6], [-20, 13]], "#101114", 2);
      strokePolygon([[38, -3], [24, -16], [10, -6], [20, 13]], "#101114", 2);

      fillPolygon([[-25, -9], [0, -19], [27, -10], [32, 25], [12, 48], [-13, 48], [-32, 24]], "#1f2940");
      fillPolygon([[-18, -5], [0, -13], [0, 43], [-19, 34], [-25, 13]], "#314264");
      fillPolygon([[0, -13], [19, -5], [25, 13], [18, 34], [0, 43]], "#24314d");
      fillPolygon([[-10, 0], [12, 0], [17, 21], [0, 31], [-17, 21]], "#4ac7a5");
      fillPolygon([[-7, 5], [8, 5], [11, 17], [0, 23], [-11, 17]], "#9fe5ff");
      strokePolygon([[-25, -9], [0, -19], [27, -10], [32, 25], [12, 48], [-13, 48], [-32, 24]], "#101114", 3);

      fillPolygon([[-24, -30], [-13, -51], [11, -54], [27, -37], [23, -19], [3, -10], [-18, -15]], "#eef4f7");
      fillPolygon([[-18, -31], [-8, -43], [15, -43], [21, -33], [14, -24], [-12, -24]], "#101114");
      fillPolygon([[-13, -32], [-5, -39], [14, -39], [17, -34], [10, -30], [-10, -28]], "#9fe5ff");
      fillPolygon([[-24, -31], [-13, -51], [-8, -43], [-18, -31]], "#c7d6df");
      fillPolygon([[11, -54], [27, -37], [21, -33], [15, -43]], "#d9e6ec");
      strokePolygon([[-24, -30], [-13, -51], [11, -54], [27, -37], [23, -19], [3, -10], [-18, -15]], "#101114", 3);

      fillPolygon([[-6, -15], [8, -15], [13, -7], [-10, -6]], "#f1d35b");
      fillPolygon([[-21, 78], [-5, 75], [1, 84], [-18, 88], [-31, 84]], "#f1d35b");
      fillPolygon([[21, 78], [5, 75], [-1, 84], [18, 88], [31, 84]], "#f1d35b");

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
        ctx.font = numberFont(24);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeText(floater.text, 0, 0);
        ctx.fillText(floater.text, 0, 0);
        ctx.restore();
      });
    }

    function drawOverlay(snapshot) {
      drawTopStats(snapshot);
      drawHitTray(snapshot);
      drawPickTray(snapshot);
      drawNextPreview(snapshot);

      drawGuessPulse(snapshot.lastGuessPulse);

      if (snapshot.gameEnded) {
        const title = snapshot.endReason === "time" ? "시간 종료" : "게임 종료";
        drawEndOverlay(
          title,
          `${snapshot.score}점 · ${snapshot.clearedSets}세트`,
          snapshot.endReason === "time" ? "#f1d35b" : "#ff6f61",
        );
        ctx.fillStyle = "#4ac7a5";
        ctx.font = numberFont(24, 850);
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

    function drawGuessPulse(pulse) {
      if (!pulse) return;

      if (pulse.success) {
        drawSuccessPulse(pulse);
        return;
      }

      const progress = 1 - pulse.life / pulse.maxLife;
      ctx.save();
      ctx.globalAlpha = Math.max(0, pulse.life / pulse.maxLife);
      ctx.translate(config.WIDTH / 2, config.HEIGHT / 2 - 18);
      ctx.scale(1 + progress * 0.18, 1 + progress * 0.18);
      ctx.fillStyle = "#6ba8ff";
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = 10;
      ctx.font = numberFont(52);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeText(pulse.text, 0, 0);
      ctx.fillText(pulse.text, 0, 0);
      ctx.restore();
    }

    function drawSuccessPulse(pulse) {
      const progress = 1 - pulse.life / pulse.maxLife;
      const alpha = Math.max(0, pulse.life / pulse.maxLife);
      const centerX = config.WIDTH / 2;
      const centerY = config.HEIGHT / 2 - 22;
      const ringSize = 72 + progress * 132;
      const secondRingSize = 112 + progress * 172;

      ctx.save();
      ctx.globalAlpha = alpha;

      const glow = ctx.createRadialGradient(centerX, centerY, 12, centerX, centerY, 230);
      glow.addColorStop(0, "rgba(241,211,91,0.34)");
      glow.addColorStop(0.42, "rgba(241,211,91,0.14)");
      glow.addColorStop(1, "rgba(241,211,91,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, config.WIDTH, config.HEIGHT);

      ctx.translate(centerX, centerY);
      ctx.rotate(progress * 0.08);
      ctx.strokeStyle = `rgba(241,211,91,${0.82 * alpha})`;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(0, 0, ringSize, -Math.PI * 0.14, Math.PI * 1.14);
      ctx.stroke();

      ctx.strokeStyle = `rgba(242,242,234,${0.5 * alpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, secondRingSize, Math.PI * 0.18, Math.PI * 1.55);
      ctx.stroke();

      ctx.scale(1 + Math.sin(progress * Math.PI) * 0.12, 1 + Math.sin(progress * Math.PI) * 0.12);
      ctx.fillStyle = "#f1d35b";
      ctx.strokeStyle = "rgba(0,0,0,0.62)";
      ctx.lineWidth = 12;
      ctx.font = numberFont(70);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeText(pulse.text, 0, -8);
      ctx.fillText(pulse.text, 0, -8);

      ctx.fillStyle = "#f2f2ea";
      ctx.strokeStyle = "rgba(0,0,0,0.48)";
      ctx.lineWidth = 7;
      ctx.font = numberFont(28, 900);
      ctx.strokeText(pulse.subtext || "3S", 0, 53);
      ctx.fillText(pulse.subtext || "3S", 0, 53);

      if (pulse.points) {
        ctx.fillStyle = "#4ac7a5";
        ctx.strokeStyle = "rgba(0,0,0,0.45)";
        ctx.lineWidth = 6;
        ctx.font = numberFont(25, 950);
        ctx.strokeText(pulse.points, 0, 89);
        ctx.fillText(pulse.points, 0, 89);
      }

      ctx.restore();
    }

    function drawTopStats(snapshot) {
      const x = 18;
      const y = 18;
      const width = 174;
      const height = 62;
      const remaining = formatTime(snapshot.remainingMs);
      const valueX = x + 76;

      ctx.save();
      ctx.fillStyle = "rgba(16,17,20,0.56)";
      roundedRect(x, y, width, height, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(242,242,234,0.16)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = "#aeb3aa";
      ctx.font = numberFont(10, 900);
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("TIME", x + 14, y + 18);

      ctx.fillStyle = "#f2f2ea";
      ctx.font = numberFont(18);
      ctx.fillText(remaining, valueX, y + 18);

      ctx.fillStyle = "#aeb3aa";
      ctx.font = numberFont(10, 900);
      ctx.fillText("SCORE", x + 14, y + 43);

      ctx.fillStyle = "#f1d35b";
      ctx.font = numberFont(19);
      ctx.fillText(String(snapshot.score), valueX, y + 43);
      ctx.restore();
    }

    function drawHitTray(snapshot) {
      const lastGuess = snapshot.gameState.history[0];
      const values = lastGuess
        ? revealMatchedDigits(lastGuess.guess, snapshot.gameState.secret)
        : [];

      drawNumberTray({
        label: "HIT",
        values,
        color: "#4ac7a5",
        x: config.WIDTH / 2 - 70,
        y: 18,
        width: 140,
        height: 62,
        slotSize: 28,
      });
    }

    function drawPickTray(snapshot) {
      drawNumberTray({
        label: "PICK",
        values: snapshot.gameState.currentGuess,
        color: "#f1d35b",
        x: config.WIDTH / 2 - 70,
        y: 88,
        width: 140,
        height: 70,
        slotSize: 30,
        active: snapshot.gameState.currentGuess.length > 0,
      });
    }

    function drawNumberTray(options) {
      const {
        label,
        values,
        color,
        x,
        y,
        width,
        height,
        slotSize,
        active = false,
      } = options;
      const gap = 8;
      const slotsWidth = slotSize * 3 + gap * 2;
      const slotY = y + height - slotSize - 7;
      const firstSlotX = x + (width - slotsWidth) / 2;

      ctx.save();
      ctx.fillStyle = "rgba(16,17,20,0.54)";
      roundedRect(x, y, width, height, 8);
      ctx.fill();
      ctx.strokeStyle = active ? color : "rgba(242,242,234,0.16)";
      ctx.globalAlpha = active ? 0.95 : 1;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.fillStyle = color;
      ctx.font = numberFont(12, 900);
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x + 14, y + 17);

      for (let index = 0; index < 3; index += 1) {
        const value = values[index];
        const slotX = firstSlotX + index * (slotSize + gap);
        const slotCenterX = slotX + slotSize / 2;
        const slotCenterY = slotY + slotSize / 2;

        if (value) {
          drawDigitTile(value, slotCenterX, slotCenterY, slotSize, {
            active,
            borderWidth: active ? 2 : 1.5,
            fontSize: slotSize * 0.56,
            radius: 7,
          });
        } else {
          drawEmptyNumberSlot(slotCenterX, slotCenterY, slotSize, {
            fontSize: slotSize * 0.56,
            radius: 7,
          });
        }
      }

      ctx.restore();
    }

    function drawNextPreview(snapshot) {
      const values = Array.isArray(snapshot.nextWaveDigits)
        ? snapshot.nextWaveDigits
        : [];
      const width = 140;
      const height = 62;
      const x = config.WIDTH - width - 18;
      const y = 18;
      const slotSize = 28;
      const gap = 8;
      const slotY = y + 27;
      const firstSlotX = x + 18;

      ctx.save();
      ctx.fillStyle = "rgba(16,17,20,0.48)";
      roundedRect(x, y, width, height, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(107,168,255,0.34)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = "#9fc5ff";
      ctx.font = numberFont(11, 900);
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("NEXT", x + 14, y + 15);

      for (let index = 0; index < 3; index += 1) {
        const value = values[index];
        const slotX = firstSlotX + index * (slotSize + gap);
        const slotCenterX = slotX + slotSize / 2;
        const slotCenterY = slotY + slotSize / 2;

        if (value) {
          drawDigitTile(value, slotCenterX, slotCenterY, slotSize, {
            borderWidth: 1.5,
            fontSize: 16,
            radius: 7,
          });
        } else {
          drawEmptyNumberSlot(slotCenterX, slotCenterY, slotSize, {
            fontSize: 16,
            radius: 7,
          });
        }
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
      ctx.font = numberFont(12, 900);
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("BOOST", x + 14, y + 20);

      ctx.fillStyle = "#f2f2ea";
      ctx.font = numberFont(25);
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
      ctx.font = numberFont(58);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(title, config.WIDTH / 2, config.HEIGHT / 2 - 56);
      ctx.fillStyle = "#f2f2ea";
      ctx.font = numberFont(34, 900);
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
