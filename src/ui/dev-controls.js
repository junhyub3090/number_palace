(function attachDevControls(global) {
  function formatSeconds(value) {
    const safeValue = Math.max(0, Number(value) || 0);
    const minutes = Math.floor(safeValue / 60);
    const seconds = Math.round(safeValue % 60);
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function createDevControls(documentRef, defaults, onChange) {
    const controls = [
      {
        id: "qaDifficulty",
        key: "digitMax",
        labelId: "qaDifficultyValue",
        normalize: (value) => Number(value),
        format: (value) => `1-${value}`,
      },
      {
        id: "qaAllowDuplicates",
        key: "allowDuplicates",
        labelId: "qaAllowDuplicatesValue",
        normalize: (value) => Boolean(value),
        format: (value) => (value ? "ON" : "OFF"),
      },
      {
        id: "qaTimeLimit",
        key: "timeLimitSeconds",
        labelId: "qaTimeLimitValue",
        normalize: (value) => Number(value),
        format: formatSeconds,
      },
      {
        id: "qaBaseSpeed",
        key: "baseWaveSpeed",
        labelId: "qaBaseSpeedValue",
        normalize: (value) => Number(value),
        format: (value) => String(Math.round(value)),
      },
      {
        id: "qaBoostGain",
        key: "boostGain",
        labelId: "qaBoostGainValue",
        normalize: (value) => Number(value) / 100,
        format: (value) => value.toFixed(2),
      },
      {
        id: "qaSpeedCap",
        key: "speedCap",
        labelId: "qaSpeedCapValue",
        normalize: (value) => Number(value) / 100,
        format: (value) => value.toFixed(2),
      },
      {
        id: "qaItemSize",
        key: "itemSize",
        labelId: "qaItemSizeValue",
        normalize: (value) => Number(value),
        format: (value) => String(Math.round(value)),
      },
      {
        id: "qaPlayerScale",
        key: "playerScale",
        labelId: "qaPlayerScaleValue",
        normalize: (value) => Number(value) / 100,
        format: (value) => value.toFixed(2),
      },
      {
        id: "qaScoreGraceGuesses",
        key: "scoreGraceGuesses",
        labelId: "qaScoreGraceGuessesValue",
        normalize: (value) => Number(value),
        format: (value) => String(Math.round(value)),
      },
      {
        id: "qaEffectIntensity",
        key: "effectIntensity",
        labelId: "qaEffectIntensityValue",
        normalize: (value) => Number(value) / 100,
        format: (value) => value.toFixed(2),
      },
      {
        id: "qaShakeIntensity",
        key: "shakeIntensity",
        labelId: "qaShakeIntensityValue",
        normalize: (value) => Number(value) / 100,
        format: (value) => value.toFixed(2),
      },
      {
        id: "qaBoostMotion",
        key: "boostMotion",
        labelId: "qaBoostMotionValue",
        normalize: (value) => Number(value) / 100,
        format: (value) => value.toFixed(2),
      },
    ];

    const values = { ...defaults };

    controls.forEach((control) => {
      const input = documentRef.getElementById(control.id);
      const label = documentRef.getElementById(control.labelId);

      if (!input || !label) return;

      function commit() {
        const rawValue = input.type === "checkbox" ? input.checked : input.value;
        values[control.key] = control.normalize(rawValue);
        label.textContent = control.format(values[control.key]);
        onChange({ ...values });
      }

      input.addEventListener(input.type === "checkbox" ? "change" : "input", commit);
      commit();
    });

    return {
      values,
    };
  }

  global.RunningBaseballDevControls = {
    createDevControls,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
