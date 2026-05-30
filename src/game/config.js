(function attachConfig(global) {
  const WIDTH = 640;
  const HEIGHT = 780;
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
    DASH_COOLDOWN: 360,
    MAX_SPEED_STACK: 3,
    BASE_WAVE_SPEED: 255,
    DEFAULT_TUNING: {
      baseWaveSpeed: 255,
      boostGain: 0.48,
      boostMotion: 0.5,
      digitMax: 7,
      effectIntensity: 0.55,
      allowDuplicates: false,
      itemSize: 60,
      playerScale: 0.9,
      shakeIntensity: 0.45,
      speedCap: 2.65,
      timeLimitSeconds: 300,
    },
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
