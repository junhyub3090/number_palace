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
    CATCH_WINDOW: 42,
    ITEM_SIZE: 60,
    FLIP_DURATION: 540,
    FLIP_COOLDOWN: 610,
    MAX_SPEED_STACK: 8,
    BASE_WAVE_SPEED: 235,
    DEFAULT_TUNING: {
      baseWaveSpeed: 235,
      boostGain: 0.11,
      boostMotion: 0.5,
      effectIntensity: 0.55,
      itemSize: 60,
      playerScale: 0.9,
      shakeIntensity: 0.45,
      speedCap: 3.1,
    },
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
