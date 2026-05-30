(function attachAudio(global) {
  function createAudioController() {
    let audioContext = null;

    function ensureAudio() {
      const AudioContext = global.AudioContext || global.webkitAudioContext;

      if (audioContext) {
        if (audioContext.state === "suspended") {
          audioContext.resume();
        }
        return;
      }

      if (!AudioContext) return;
      audioContext = new AudioContext();

      if (audioContext.state === "suspended") {
        audioContext.resume();
      }
    }

    function playTone(frequency, duration, type, volume, delay) {
      if (!audioContext) return;

      const start = audioContext.currentTime + (delay || 0);
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = type || "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume || 0.06, start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    }

    function playEffect(kind) {
      if (kind === "boost") {
        playTone(380, 0.08, "sawtooth", 0.035, 0);
        playTone(760, 0.16, "triangle", 0.055, 0.055);
      } else if (kind === "dash") {
        playTone(110, 0.045, "square", 0.04, 0);
        playTone(280, 0.055, "sawtooth", 0.045, 0.018);
        playTone(880, 0.075, "triangle", 0.048, 0.055);
        playTone(1320, 0.09, "sine", 0.04, 0.095);
      } else if (kind === "collect") {
        playTone(180, 0.055, "square", 0.032, 0);
        playTone(560, 0.075, "square", 0.045, 0.025);
        playTone(1040, 0.14, "triangle", 0.058, 0.075);
      } else if (kind === "guess") {
        playTone(420, 0.09, "triangle", 0.045, 0);
        playTone(620, 0.09, "triangle", 0.045, 0.08);
        playTone(860, 0.16, "triangle", 0.055, 0.16);
      } else if (kind === "clear") {
        playTone(520, 0.1, "triangle", 0.05, 0);
        playTone(720, 0.1, "triangle", 0.05, 0.1);
        playTone(920, 0.1, "triangle", 0.052, 0.18);
        playTone(1240, 0.18, "triangle", 0.065, 0.26);
        playTone(1560, 0.24, "sine", 0.052, 0.34);
      }
    }

    return {
      ensureAudio,
      playEffect,
    };
  }

  global.RunningBaseballAudio = {
    createAudioController,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
