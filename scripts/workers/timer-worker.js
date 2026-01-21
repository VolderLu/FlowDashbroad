/**
 * FlowDashboard - Timer Web Worker
 * 在獨立線程中運行計時器，避免瀏覽器標籤節流
 */

let timerState = {
  startTimestamp: null,
  pausedAt: null,
  totalSeconds: 0,
  isRunning: false
};

let tickInterval = null;

/**
 * 獲取已經過的秒數
 */
function getElapsedSeconds() {
  if (timerState.pausedAt !== null) {
    return timerState.pausedAt;
  }
  if (!timerState.startTimestamp) {
    return 0;
  }
  return Math.floor((Date.now() - timerState.startTimestamp) / 1000);
}

/**
 * 獲取剩餘秒數
 */
function getRemainingSeconds() {
  const elapsed = getElapsedSeconds();
  return Math.max(0, timerState.totalSeconds - elapsed);
}

/**
 * tick 函數
 */
function tick() {
  if (!timerState.isRunning) return;

  const remaining = getRemainingSeconds();
  const elapsed = getElapsedSeconds();

  // 發送更新給主線程
  self.postMessage({
    type: 'tick',
    remaining,
    elapsed
  });

  // 時間到
  if (remaining <= 0) {
    stopTimer();
    self.postMessage({
      type: 'complete',
      elapsed
    });
  }
}

/**
 * 開始計時
 */
function startTimer(totalSeconds, pausedAt = null) {
  timerState = {
    startTimestamp: pausedAt !== null
      ? Date.now() - (pausedAt * 1000)
      : Date.now(),
    pausedAt: null,
    totalSeconds,
    isRunning: true
  };

  startInterval();
}

/**
 * 暫停計時
 */
function pauseTimer() {
  if (timerState.isRunning) {
    timerState.pausedAt = getElapsedSeconds();
    timerState.isRunning = false;
    stopInterval();

    self.postMessage({
      type: 'paused',
      pausedAt: timerState.pausedAt
    });
  }
}

/**
 * 繼續計時
 */
function resumeTimer() {
  if (!timerState.isRunning && timerState.pausedAt !== null) {
    timerState.startTimestamp = Date.now() - (timerState.pausedAt * 1000);
    timerState.pausedAt = null;
    timerState.isRunning = true;
    startInterval();
  }
}

/**
 * 停止計時
 */
function stopTimer() {
  timerState = {
    startTimestamp: null,
    pausedAt: null,
    totalSeconds: 0,
    isRunning: false
  };
  stopInterval();
}

/**
 * 開始 interval
 */
function startInterval() {
  stopInterval();
  // 使用 250ms 間隔，Web Worker 不會被節流
  tickInterval = setInterval(tick, 250);
  // 立即執行一次
  tick();
}

/**
 * 停止 interval
 */
function stopInterval() {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}

/**
 * 獲取當前狀態
 */
function getState() {
  return {
    ...timerState,
    remaining: getRemainingSeconds(),
    elapsed: getElapsedSeconds()
  };
}

// 監聽主線程訊息
self.onmessage = function(e) {
  const { type, payload } = e.data;

  switch (type) {
    case 'start':
      startTimer(payload.totalSeconds, payload.pausedAt);
      break;
    case 'pause':
      pauseTimer();
      break;
    case 'resume':
      resumeTimer();
      break;
    case 'stop':
      stopTimer();
      break;
    case 'getState':
      self.postMessage({
        type: 'state',
        state: getState()
      });
      break;
    case 'sync':
      // 強制同步一次（用於頁面變為可見時）
      if (timerState.isRunning) {
        tick();
      }
      break;
  }
};
