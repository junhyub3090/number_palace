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
    ITEM_SIZE: 76,
    FLIP_DURATION: 540,
    FLIP_COOLDOWN: 610,
    MAX_SPEED_STACK: 8,
    BASE_WAVE_SPEED: 265,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
