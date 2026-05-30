(function attachEffects(global) {
  function createEffects(config, laneCenter) {
    let particles = [];
    let floaters = [];
    let laneFlashes = [];
    let stars = [];
    let dashTrails = [];

    function reset() {
      particles = [];
      floaters = [];
      laneFlashes = Array.from({ length: config.LANES }, () => ({
        alpha: 0,
        color: "#ffffff",
      }));
      dashTrails = [];
      stars = Array.from({ length: 72 }, () => ({
        x: Math.random() * config.WIDTH,
        y: Math.random() * config.HEIGHT,
        speed: 75 + Math.random() * 190,
        size: 1 + Math.random() * 2.6,
      }));
    }

    function addDashTrail(trail) {
      const life = trail.life || 0.68;

      dashTrails.push({
        ...trail,
        elapsed: 0,
        life,
        maxLife: life,
      });
    }

    function addFloater(x, y, text, color, life) {
      floaters.push({
        x,
        y,
        text,
        color,
        life: life || 0.9,
        maxLife: life || 0.9,
        vy: -72,
        scale: 1,
      });
    }

    function burst(x, y, color, count, force) {
      for (let i = 0; i < count; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const velocity = (force || 210) * (0.35 + Math.random() * 0.85);

        particles.push({
          x,
          y,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity,
          size: 3 + Math.random() * 5,
          life: 0.42 + Math.random() * 0.5,
          maxLife: 0.92,
          color,
        });
      }
    }

    function flashLane(lane, color, alpha) {
      laneFlashes[lane] = { color, alpha };
    }

    function update(dt) {
      particles = particles
        .map((particle) => ({
          ...particle,
          x: particle.x + particle.vx * dt,
          y: particle.y + particle.vy * dt,
          vy: particle.vy + 520 * dt,
          life: particle.life - dt,
        }))
        .filter((particle) => particle.life > 0);

      floaters = floaters
        .map((floater) => ({
          ...floater,
          y: floater.y + floater.vy * dt,
          life: floater.life - dt,
          scale: 1 + (1 - floater.life / floater.maxLife) * 0.22,
        }))
        .filter((floater) => floater.life > 0);

      laneFlashes.forEach((laneFlash) => {
        laneFlash.alpha = Math.max(0, laneFlash.alpha - dt * 1.8);
      });

      dashTrails = dashTrails
        .map((trail) => ({
          ...trail,
          elapsed: trail.elapsed + dt,
          life: trail.life - dt,
        }))
        .filter((trail) => trail.life > 0);
    }

    function updateStars(dt, speed, speedStack) {
      stars.forEach((star) => {
        star.y += star.speed * speed * dt;

        if (star.y > config.HEIGHT) {
          star.y = -12;
          star.x = Math.random() * config.WIDTH;
        }
      });
    }

    function snapshot() {
      return {
        particles,
        floaters,
        laneFlashes,
        stars,
        dashTrails,
      };
    }

    reset();

    return {
      addFloater,
      addDashTrail,
      burst,
      flashLane,
      reset,
      snapshot,
      update,
      updateStars,
      laneCenter,
    };
  }

  global.RunningBaseballEffects = {
    createEffects,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
