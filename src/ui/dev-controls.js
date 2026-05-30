(function attachDevControls(global) {
  function createDevControls(documentRef, defaults, onChange) {
    const controls = [
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
        id: "qaTimeLimit",
        key: "timeLimitSeconds",
        labelId: "qaTimeLimitValue",
        normalize: (value) => Number(value),
        format: (value) => `${Math.round(value)}s`,
      },
    ];

    const values = { ...defaults };

    controls.forEach((control) => {
      const input = documentRef.getElementById(control.id);
      const label = documentRef.getElementById(control.labelId);

      if (!input || !label) return;

      function commit() {
        values[control.key] = control.normalize(input.value);
        label.textContent = control.format(values[control.key]);
        onChange({ ...values });
      }

      input.addEventListener("input", commit);
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
