(function attachHud(global) {
  function getHudElements(documentRef) {
    return {
      guessSlots: documentRef.getElementById("guessSlots"),
      historyList: documentRef.getElementById("historyList"),
      messageBox: documentRef.getElementById("messageBox"),
      timeValue: documentRef.getElementById("timeValue"),
      boostValue: documentRef.getElementById("boostValue"),
      finalTimeValue: documentRef.getElementById("finalTimeValue"),
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
    elements.boostValue.textContent = String(stats.speedStack);
    elements.finalTimeValue.textContent =
      stats.finalTimeMs === null ? "-" : formatTime(stats.finalTimeMs);
  }

  function renderHud(elements, core, viewState) {
    renderLiveStats(elements, viewState);
    renderGuessSlots(elements.guessSlots, viewState.gameState.currentGuess);
    renderHistory(elements.historyList, core, viewState.gameState.history);
    elements.messageBox.textContent = viewState.message;
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
      const guess = entry.guess.map((digit) => `<span>${digit}</span>`).join("");
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
