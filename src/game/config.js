(function attachConfig(global) {
  const WIDTH = 640;
  const HEIGHT = 720;
  const LANES = 4;

  global.RunningBaseballConfig = {
    WIDTH,
    HEIGHT,
    LANES,
    LANE_WIDTH: WIDTH / LANES,
    PLAYER_Y: HEIGHT - 118,
    CATCH_Y: HEIGHT - 154,
    ITEM_SIZE: 60,
    FLIP_DURATION: 540,
    FLIP_COOLDOWN: 610,
    MAX_SPEED_STACK: 8,
    BASE_WAVE_SPEED: 220,
    DEFAULT_TUNING: {
      baseAcceleration: 0.02,
      baseWaveSpeed: 220,
      boostGain: 0.12,
      effectIntensity: 0.55,
      itemSize: 60,
      playerScale: 0.9,
      shakeIntensity: 0.45,
      speedCap: 2.6,
      timeLimitSeconds: 90,
    },
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
