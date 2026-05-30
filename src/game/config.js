(function attachConfig(global) {
  const WIDTH = 560;
  const HEIGHT = 1040;
  const LANES = 4;
  const BOOST_COLOR = "#f2f2ea";
  const BOOST_GLOW_COLOR = "#cfe4ff";
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

  function digitColor(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return DIGIT_TILE_COLORS[0];

    return DIGIT_TILE_COLORS[
      Math.abs(Math.round(numericValue) - 1) % DIGIT_TILE_COLORS.length
    ];
  }

  global.RunningBaseballConfig = {
    WIDTH,
    HEIGHT,
    LANES,
    BOOST_COLOR,
    BOOST_GLOW_COLOR,
    DIGIT_TILE_COLORS,
    LANE_WIDTH: WIDTH / LANES,
    PLAYER_Y: HEIGHT - 118,
    CATCH_Y: HEIGHT - 154,
    CATCH_WINDOW: 42,
    ITEM_SIZE: 60,
    DASH_COOLDOWN: 360,
    MAX_SPEED_STACK: 5,
    BASE_WAVE_SPEED: 255,
    DEFAULT_TUNING: {
      baseWaveSpeed: 255,
      boostGain: 0.33,
      boostMotion: 0.5,
      digitMax: 7,
      effectIntensity: 0.55,
      allowDuplicates: false,
      itemSize: 60,
      playerScale: 0.9,
      scoreGraceGuesses: 4,
      shakeIntensity: 0.45,
      speedCap: 2.65,
      timeLimitSeconds: 120,
    },
    digitColor,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
