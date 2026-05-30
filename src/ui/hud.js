(function attachHud(global) {
  function getHudElements(documentRef) {
    return {
      guessSlots: documentRef.getElementById("guessSlots"),
      historyList: documentRef.getElementById("historyList"),
      messageBox: documentRef.getElementById("messageBox"),
      nextDigitsValue: documentRef.getElementById("nextDigitsValue"),
      timeValue: documentRef.getElementById("timeValue"),
      remainingTimeValue: documentRef.getElementById("remainingTimeValue"),
      scoreValue: documentRef.getElementById("scoreValue"),
      clearedSetsValue: documentRef.getElementById("clearedSetsValue"),
      boostValue: documentRef.getElementById("boostValue"),
      speedValue: documentRef.getElementById("speedValue"),
      hintProgressValue: documentRef.getElementById("hintProgressValue"),
      excludedDigitsValue: documentRef.getElementById("excludedDigitsValue"),
      devSecretValue: documentRef.getElementById("devSecretValue"),
    };
  }

  function formatTime(ms) {
    const safeMs = Math.max(0, ms || 0);
    const minutes = Math.floor(safeMs / 60000);
    const seconds = Math.floor((safeMs % 60000) / 1000);
    const tenths = Math.floor((safeMs % 1000) / 100);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
  }

  function renderLiveStats(elements, stats) {
    elements.timeValue.textContent = formatTime(stats.elapsedMs);
    elements.remainingTimeValue.textContent = formatTime(stats.remainingMs);
    elements.scoreValue.textContent = String(stats.score);
    elements.clearedSetsValue.textContent = String(stats.clearedSets);
    elements.boostValue.textContent = String(stats.speedStack);
    elements.speedValue.textContent = `x${stats.speedMultiplierValue.toFixed(2)}`;
    elements.hintProgressValue.textContent = `${stats.hintProgress}/3`;
    elements.excludedDigitsValue.textContent =
      stats.excludedHintDigits.length === 0 ? "-" : stats.excludedHintDigits.join(", ");
    renderNextDigits(elements.nextDigitsValue, stats.nextWaveDigits);
  }

  function renderHud(elements, core, viewState) {
    renderLiveStats(elements, viewState);
    renderGuessSlots(elements.guessSlots, viewState.gameState.currentGuess);
    renderHistory(elements.historyList, core, viewState.gameState.history);
    renderDevSecret(elements.devSecretValue, viewState.gameState.secret);
    elements.messageBox.textContent = viewState.message;
  }

  function renderDevSecret(container, secret) {
    if (!container) return;
    container.textContent = secret.join("");
  }

  function renderGuessSlots(container, currentGuess) {
    container.innerHTML = "";

    for (let i = 0; i < 3; i += 1) {
      const slot = document.createElement("div");
      slot.className = `slot${currentGuess[i] ? "" : " empty"}`;
      slot.textContent = currentGuess[i] || ".";
      container.appendChild(slot);
    }
  }

  function renderNextDigits(container, nextWaveDigits) {
    if (!container) return;

    const digits = Array.isArray(nextWaveDigits) ? nextWaveDigits : [];
    container.innerHTML = "";

    for (let index = 0; index < 3; index += 1) {
      const slot = document.createElement("span");
      slot.textContent = digits[index] || ".";
      container.appendChild(slot);
    }
  }

  function renderHistory(container, core, history) {
    container.innerHTML = "";

    if (history.length === 0) {
      const empty = document.createElement("li");
      empty.innerHTML =
        '<span class="history-guess"><span>.</span><span>.</span><span>.</span></span><span class="history-score">-</span>';
      container.appendChild(empty);
      return;
    }

    core.sortHistoryForDisplay(history).forEach((entry) => {
      const item = document.createElement("li");
      const guess = entry.guess
        .slice()
        .sort((left, right) => left - right)
        .map((digit) => `<span>${digit}</span>`)
        .join("");
      item.innerHTML = `<span class="history-guess">${guess}</span><span class="history-score">${entry.strikes}S</span>`;
      container.appendChild(item);
    });
  }

  global.RunningBaseballHud = {
    formatTime,
    getHudElements,
    renderHud,
    renderLiveStats,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
