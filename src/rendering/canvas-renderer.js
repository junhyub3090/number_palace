(function attachCanvasRenderer(global) {
  function createCanvasRenderer(canvas, config, formatTime) {
    const ctx = canvas.getContext("2d");
    const NUMBER_FONT_FAMILY =
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
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
      if (typeof config.digitColor === "function") {
        return config.digitColor(value);
      }

      return "#d6bb57";
    }

    function boostColor() {
      return config.BOOST_COLOR || "#f2f2ea";
    }

    function boostGlowColor() {
      return config.BOOST_GLOW_COLOR || "#cfe4ff";
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

    function drawLimbSegment(x1, y1, x2, y2, width, color, edgeColor, edgeWidth = 1.6) {
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
        strokePolygon(points, edgeColor, edgeWidth);
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
      ctx.beginPath();
      ctx.rect(0, 0, config.WIDTH, config.HEIGHT);
      ctx.clip();
      drawTrack(snapshot);
      drawDashTrails(snapshot.effects.dashTrails || [], snapshot);
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
      ctx.strokeStyle = boostGlowColor();
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
      const zoneColor = activeItem && activeItem.kind === "empty" ? boostColor() : "#f1d35b";
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
          ctx.fillStyle = colorWithAlpha(boostColor(), approaching ? 0.2 : 0.09);
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
      ctx.strokeStyle = boostGlowColor();
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
        const consumedByDash =
          impact &&
          wave.consumedLane === item.lane &&
          impactProgress >= collisionProgress;
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
        const itemX = laneCenter(item.lane);

        if (consumedByDash) {
          return;
        }

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

        const x = itemX;
        const y = itemY;
        const handled = wave.handled && activeLane && !impact;
        const pulse = handled ? 0.44 : 1;
        const boostGlow = Math.min(8, (snapshot.speedStack || 0) * 0.8);

        ctx.save();
        ctx.translate(x, y);
        ctx.scale(tilePulse * impactScale, tilePulse * impactScale);
        ctx.globalAlpha = pulse * impactAlpha;
        ctx.shadowColor = inCatchZone || inDashImpact
          ? colorWithAlpha(digitColor(item.value), 0.74)
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

    function drawDashTrails(trails, snapshot) {
      if (!trails.length) return;

      trails.forEach((trail) => {
        const durationMs = Math.max(1, (trail.duration || 0.12) * 1000);
        const runProgress = easeOutCubic((snapshot.timestamp - trail.startTime) / durationMs);
        const lifeProgress = clamp01(trail.life / trail.maxLife);
        const grow = Math.max(0.12, runProgress);
        const fade = Math.min(1, lifeProgress * 1.25);
        const itemSize = trail.itemSize || snapshot.tuning.itemSize;
        const items = (trail.items || []).slice().sort((left, right) => {
          if (left.active === right.active) return left.lane - right.lane;
          return left.active ? 1 : -1;
        });

        items.forEach((item) => {
          const color = item.kind === "empty" ? boostColor() : digitColor(item.value);
          drawPersistentDashTrail(item, itemSize, color, grow, fade);
        });
      });
    }

    function colorWithAlpha(color, alpha) {
      const hex = String(color || "").replace("#", "");
      const safeAlpha = clamp01(alpha);

      if (hex.length !== 6) {
        return `rgba(242,242,234,${safeAlpha})`;
      }

      const red = parseInt(hex.slice(0, 2), 16);
      const green = parseInt(hex.slice(2, 4), 16);
      const blue = parseInt(hex.slice(4, 6), 16);

      return `rgba(${red},${green},${blue},${safeAlpha})`;
    }

    function mixColorWithWhite(color, amount) {
      const hex = String(color || "").replace("#", "");
      const mix = clamp01(amount);

      if (hex.length !== 6) {
        return "#f2f2ea";
      }

      const red = parseInt(hex.slice(0, 2), 16);
      const green = parseInt(hex.slice(2, 4), 16);
      const blue = parseInt(hex.slice(4, 6), 16);
      const nextRed = Math.round(red + (242 - red) * mix);
      const nextGreen = Math.round(green + (242 - green) * mix);
      const nextBlue = Math.round(blue + (234 - blue) * mix);

      return `#${[nextRed, nextGreen, nextBlue]
        .map((value) => value.toString(16).padStart(2, "0"))
        .join("")}`;
    }

    function drawPersistentDashTrail(item, itemSize, color, grow, fade) {
      const x = laneCenter(item.lane);
      const active = Boolean(item.active);
      const startY = item.startY - itemSize * 0.28;
      const targetY = item.startY + (item.endY - item.startY) * grow;
      const top = Math.min(startY, targetY);
      const bottom = Math.max(startY, targetY);
      const length = bottom - top;

      if (length < 10 || fade <= 0.01) return;

      const width = itemSize * (active ? 0.86 : 0.66);
      const glowWidth = width * (active ? 1.36 : 1.16);
      const baseAlpha = (active ? 0.52 : 0.3) * fade;
      const brightColor = mixColorWithWhite(color, active ? 0.82 : 0.68);
      const streakCount = Math.max(3, Math.min(12, Math.floor(length / (itemSize * 0.58))));

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      const glow = ctx.createLinearGradient(x, top, x, bottom);
      glow.addColorStop(0, colorWithAlpha(color, 0));
      glow.addColorStop(0.2, colorWithAlpha(color, baseAlpha * 0.36));
      glow.addColorStop(0.72, colorWithAlpha(color, baseAlpha * 1.08));
      glow.addColorStop(1, active
        ? colorWithAlpha(brightColor, 0.62 * fade)
        : colorWithAlpha(color, baseAlpha * 0.76));

      ctx.globalAlpha = 1;
      ctx.fillStyle = glow;
      roundedRect(
        x - glowWidth / 2,
        top,
        glowWidth,
        length,
        Math.max(7, itemSize * 0.16),
      );
      ctx.fill();

      const center = ctx.createLinearGradient(x, top, x, bottom);
      center.addColorStop(0, colorWithAlpha(brightColor, 0));
      center.addColorStop(0.18, colorWithAlpha(brightColor, baseAlpha * 0.52));
      center.addColorStop(0.76, colorWithAlpha(brightColor, baseAlpha * 1.45));
      center.addColorStop(1, colorWithAlpha(brightColor, active ? 0.88 * fade : 0.56 * fade));

      ctx.globalAlpha = 1;
      ctx.strokeStyle = center;
      ctx.lineWidth = active ? width * 0.28 : width * 0.2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, top + itemSize * 0.08);
      ctx.lineTo(x, bottom - itemSize * 0.08);
      ctx.stroke();

      for (let index = 0; index < streakCount; index += 1) {
        const depth = streakCount === 1 ? 1 : index / (streakCount - 1);
        const easeDepth = easeOutCubic(depth);
        const y = top + length * easeDepth;
        const opacity = baseAlpha * (0.18 + easeDepth * 0.54) * (1 - depth * 0.2);
        const dashWidth = width * (0.34 + easeDepth * (active ? 0.44 : 0.28));
        const slant = itemSize * (active ? 0.16 : 0.1);

        if (opacity <= 0.01) continue;

        ctx.globalAlpha = opacity;
        ctx.strokeStyle = brightColor;
        ctx.lineWidth = active ? 4 : 2.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x - dashWidth / 2 - slant * 0.25, y + slant * 0.5);
        ctx.lineTo(x + dashWidth / 2 + slant * 0.25, y - slant * 0.5);
        ctx.stroke();
      }

      ctx.restore();
    }

    function drawDashMeteorTrail(x, y, itemSize, color, active, progress, alpha) {
      const length = itemSize * (active ? 3.6 : 2.4);
      const width = itemSize * (active ? 0.55 : 0.36);
      const fade = Math.max(0, Math.min(1, alpha));
      const sparkleAlpha = active ? 0.44 : 0.22;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      const trail = ctx.createLinearGradient(x, y - length, x, y + itemSize * 0.25);
      trail.addColorStop(0, "rgba(255,255,255,0)");
      trail.addColorStop(0.24, `${color}00`);
      trail.addColorStop(0.72, color);
      trail.addColorStop(1, active ? "rgba(242,242,234,0.82)" : "rgba(242,242,234,0.38)");

      ctx.globalAlpha = (active ? 0.5 : 0.24) * fade;
      ctx.fillStyle = trail;
      ctx.beginPath();
      ctx.moveTo(x - width * 0.18, y + itemSize * 0.18);
      ctx.lineTo(x - width, y - length * (0.78 + progress * 0.16));
      ctx.lineTo(x, y - length);
      ctx.lineTo(x + width, y - length * (0.78 + progress * 0.16));
      ctx.lineTo(x + width * 0.18, y + itemSize * 0.18);
      ctx.closePath();
      ctx.fill();

      ctx.globalAlpha = sparkleAlpha * fade;
      ctx.strokeStyle = active ? "#f2f2ea" : color;
      ctx.lineWidth = active ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(x - width * 0.52, y - length * 0.18);
      ctx.lineTo(x - width * 0.18, y - length * 0.52);
      ctx.moveTo(x + width * 0.54, y - length * 0.3);
      ctx.lineTo(x + width * 0.2, y - length * 0.66);
      ctx.stroke();

      ctx.restore();
    }

    function drawDashImpactCue(wave, impact, progress, itemSize) {
      const laneItem = wave.items.find((item) => item.lane === impact.lane);
      const color = laneItem && laneItem.kind === "empty"
        ? boostColor()
        : laneItem && laneItem.kind === "digit"
          ? digitColor(laneItem.value)
          : "#f1d35b";
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
      ctx.strokeStyle = boostColor();
      ctx.lineWidth = inCatchZone ? 6 : 4;
      ctx.shadowColor = inCatchZone ? colorWithAlpha(boostGlowColor(), 0.74) : "transparent";
      ctx.shadowBlur = inCatchZone ? 24 : 0;
      ctx.setLineDash([10, 10]);
      roundedRect(-itemSize / 2, -itemSize / 2, itemSize, itemSize, 8);
      ctx.stroke();
      ctx.shadowColor = "transparent";
      ctx.setLineDash([]);
      ctx.fillStyle = inCatchZone ? colorWithAlpha(boostColor(), 0.18) : colorWithAlpha(boostColor(), 0.08);
      ctx.fill();
      ctx.fillStyle = boostGlowColor();
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
      const hover = Math.sin(snapshot.timestamp / 150);
      const bob = hover * 2.4;
      const y = config.PLAYER_Y + bob;
      const playerScale = snapshot.tuning.playerScale * 0.94;
      const edge = "#111927";
      const hullDark = "#162033";
      const hullMid = "#26375b";
      const hullLight = "#6ba8ff";
      const glass = "#9fe5ff";
      const accent = "#6ba8ff";
      const flameLength = 28 + stack * 3.5 + boostWind * 46;
      const flamePulse = 1 + Math.sin(snapshot.timestamp / 54) * 0.08;

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(playerScale, playerScale);

      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath();
      ctx.ellipse(0, 57, 44, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.rotate(hover * 0.018 - boostWind * 0.025);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.28 + boostWind * 0.44;
      fillPolygon(
        [[-13, 36], [-25 - boostWind * 12, 56 + flameLength * flamePulse], [-4, 48]],
        "#f1d35b",
      );
      fillPolygon(
        [[13, 36], [25 + boostWind * 12, 56 + flameLength * flamePulse], [4, 48]],
        "#f1d35b",
      );
      ctx.globalAlpha = 0.38 + boostWind * 0.42;
      fillPolygon(
        [[-7, 38], [0, 58 + flameLength * 0.92], [7, 38]],
        boostGlowColor(),
      );
      ctx.globalAlpha = 0.22 + boostWind * 0.18;
      ctx.fillStyle = colorWithAlpha(boostGlowColor(), 0.7);
      ctx.beginPath();
      ctx.ellipse(0, 48 + flameLength * 0.3, 16 + boostWind * 12, flameLength * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      fillPolygon([[-42, 8], [-70, 38], [-33, 31], [-17, 13]], hullMid);
      fillPolygon([[42, 8], [70, 38], [33, 31], [17, 13]], hullMid);
      fillPolygon([[-48, 16], [-72, 35], [-45, 38]], "#f1d35b");
      fillPolygon([[48, 16], [72, 35], [45, 38]], "#f1d35b");
      strokePolygon([[-42, 8], [-70, 38], [-33, 31], [-17, 13]], edge, 1.6);
      strokePolygon([[42, 8], [70, 38], [33, 31], [17, 13]], edge, 1.6);

      fillPolygon([[-21, -37], [0, -68], [21, -37], [34, 21], [18, 47], [-18, 47], [-34, 21]], hullDark);
      fillPolygon([[-14, -34], [0, -60], [0, 42], [-15, 31], [-24, 6]], hullLight);
      fillPolygon([[0, -60], [14, -34], [24, 6], [15, 31], [0, 42]], hullMid);
      strokePolygon([[-21, -37], [0, -68], [21, -37], [34, 21], [18, 47], [-18, 47], [-34, 21]], edge, 2);

      ctx.fillStyle = "#f2f2ea";
      ctx.beginPath();
      ctx.ellipse(0, -17, 20, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      const glassGradient = ctx.createLinearGradient(-12, -34, 15, 0);
      glassGradient.addColorStop(0, "#d7fbff");
      glassGradient.addColorStop(0.46, glass);
      glassGradient.addColorStop(1, "#5f9bd4");
      ctx.fillStyle = glassGradient;
      ctx.beginPath();
      ctx.ellipse(0, -18, 13, 17, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.68;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(-5, -24, 4, 7, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      fillPolygon([[-16, 8], [0, -1], [16, 8], [10, 28], [0, 35], [-10, 28]], "#f2f2ea");
      fillPolygon([[-9, 12], [0, 6], [9, 12], [5, 24], [0, 28], [-5, 24]], accent);
      fillPolygon([[-4, -58], [4, -58], [7, -45], [-7, -45]], "#f1d35b");

      ctx.fillStyle = colorWithAlpha(boostGlowColor(), 0.7);
      ctx.beginPath();
      ctx.ellipse(-22, 34, 7, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(22, 34, 7, 5, 0, 0, Math.PI * 2);
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
      ctx.strokeStyle = colorWithAlpha(boostColor(), 0.28 + level * 0.46);
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = boostGlowColor();
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
      ctx.fillStyle = boostColor();
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
