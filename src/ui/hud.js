(function attachHud(global) {
  const DIGIT_COLORS = [
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

  function hasDigit(value) {
    return value !== undefined && value !== null && value !== "";
  }

  function digitColor(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return DIGIT_COLORS[0];

    return DIGIT_COLORS[
      Math.abs(Math.round(numericValue) - 1) % DIGIT_COLORS.length
    ];
  }

  function paintDigitElement(element, value) {
    if (!hasDigit(value)) {
      element.classList.add("is-empty");
      element.removeAttribute("data-digit");
      element.style.removeProperty("--digit-color");
      return;
    }

    element.classList.remove("is-empty");
    element.dataset.digit = String(value);
    element.style.setProperty("--digit-color", digitColor(value));
  }

  function createDigitElement(documentRef, tagName, value, className) {
    const element = documentRef.createElement(tagName);
    if (className) element.className = className;
    element.textContent = hasDigit(value) ? String(value) : ".";
    paintDigitElement(element, value);
    return element;
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
    if (elements.messageBox) {
      elements.messageBox.textContent = viewState.message;
    }
  }

  function renderDevSecret(container, secret) {
    if (!container) return;
    container.textContent = secret.join("");
  }

  function renderGuessSlots(container, currentGuess) {
    container.innerHTML = "";

    for (let i = 0; i < 3; i += 1) {
      const slot = createDigitElement(
        container.ownerDocument,
        "div",
        currentGuess[i],
        "slot",
      );
      if (!hasDigit(currentGuess[i])) slot.classList.add("empty");
      container.appendChild(slot);
    }
  }

  function renderNextDigits(container, nextWaveDigits) {
    if (!container) return;

    const digits = Array.isArray(nextWaveDigits) ? nextWaveDigits : [];
    container.innerHTML = "";

    for (let index = 0; index < 3; index += 1) {
      const slot = createDigitElement(container.ownerDocument, "span", digits[index]);
      container.appendChild(slot);
    }
  }

  function renderHistory(container, core, history) {
    const documentRef = container.ownerDocument;

    container.innerHTML = "";

    if (history.length === 0) {
      const empty = documentRef.createElement("li");
      const guess = documentRef.createElement("span");
      const score = documentRef.createElement("span");

      guess.className = "history-guess";
      score.className = "history-score";
      score.textContent = "-";

      for (let index = 0; index < 3; index += 1) {
        guess.appendChild(createDigitElement(documentRef, "span"));
      }

      empty.appendChild(guess);
      empty.appendChild(score);
      container.appendChild(empty);
      return;
    }

    core.sortHistoryForDisplay(history).forEach((entry) => {
      const item = documentRef.createElement("li");
      const guess = documentRef.createElement("span");
      const score = documentRef.createElement("span");

      guess.className = "history-guess";
      score.className = "history-score";
      score.textContent = `${entry.strikes}S`;

      entry.guess
        .slice()
        .sort((left, right) => left - right)
        .forEach((digit) => {
          guess.appendChild(createDigitElement(documentRef, "span", digit));
        });

      item.appendChild(guess);
      item.appendChild(score);
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
