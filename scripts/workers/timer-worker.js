/**
 * FlowDashboard - Timer Web Worker
 * 在獨立線程中運行計時器，避免瀏覽器標籤節流
 */

// ============ 常數 ============
const TICK_INTERVAL_MS = 250;     // tick 間隔（毫秒）
const MAX_OVERTIME_SECONDS = 300; // 最大允許超時秒數（5分鐘），超過視為異常

let timerState = {
  startTimestamp: null,
  pausedAt: null,
  totalSeconds: 0,
  isRunning: false
};

let tickInterval = null;

/**
 * 獲取已經過的秒數
 * @returns {number}
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
 * 獲取剩餘秒數（可以是負數，表示超時）
 * @returns {number}
 */
function getRemainingSeconds() {
  const elapsed = getElapsedSeconds();
  return timerState.totalSeconds - elapsed;
}

/**
 * 獲取剩餘秒數（用於顯示，最小為 0）
 * @returns {number}
 */
function getRemainingSecondsForDisplay() {
  return Math.max(0, getRemainingSeconds());
}

/**
 * tick 函數
 */
function tick() {
  if (!timerState.isRunning) return;

  const remaining = getRemainingSeconds();
  const elapsed = getElapsedSeconds();

  // 發送更新給主線程（加上 timestamp 讓主線程能判斷訊息是否積壓）
  self.postMessage({
    type: 'tick',
    remaining: Math.max(0, remaining),
    elapsed,
    timestamp: Date.now()
  });

  // 時間到（包含超時情況）
  if (remaining <= 0) {
    const isOvertime = remaining < -MAX_OVERTIME_SECONDS;
    stopTimer();
    self.postMessage({
      type: 'complete',
      elapsed: Math.min(elapsed, timerState.totalSeconds + MAX_OVERTIME_SECONDS),
      isOvertime // 通知主線程是否為異常超時（如休眠喚醒）
    });
  }
}

/**
 * 開始計時
 * @param {number} totalSeconds - 總秒數
 * @param {number|null} pausedAt - 已經過的秒數（用於恢復）
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
      pausedAt: timerState.pausedAt,
      remaining: getRemainingSecondsForDisplay()
    });
  }
}

/**
 * 繼續計時
 * @param {number|null} fromElapsed - 可選，從指定的已過秒數恢復
 */
function resumeTimer(fromElapsed = null) {
  // 如果提供了 fromElapsed，使用它來恢復（用於頁面重載情況）
  const elapsedToUse = fromElapsed !== null ? fromElapsed : timerState.pausedAt;

  if (elapsedToUse !== null) {
    timerState.startTimestamp = Date.now() - (elapsedToUse * 1000);
    timerState.pausedAt = null;
    timerState.isRunning = true;
    startInterval();

    self.postMessage({
      type: 'resumed',
      elapsed: elapsedToUse,
      remaining: getRemainingSecondsForDisplay()
    });
  }
}

/**
 * 停止計時
 */
function stopTimer() {
  const finalElapsed = getElapsedSeconds();
  timerState = {
    startTimestamp: null,
    pausedAt: null,
    totalSeconds: 0,
    isRunning: false
  };
  stopInterval();
  return finalElapsed;
}

/**
 * 開始 interval
 */
function startInterval() {
  stopInterval();
  tickInterval = setInterval(tick, TICK_INTERVAL_MS);
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
 * @returns {Object}
 */
function getState() {
  return {
    ...timerState,
    remaining: getRemainingSecondsForDisplay(),
    elapsed: getElapsedSeconds(),
    isActive: timerState.isRunning || timerState.pausedAt !== null
  };
}

/**
 * 從外部狀態恢復（用於頁面重載）
 * @param {Object} externalState
 */
function restoreFromState(externalState) {
  const { totalSeconds, elapsedSeconds, isPaused } = externalState;

  if (isPaused) {
    // 恢復為暫停狀態
    timerState = {
      startTimestamp: null,
      pausedAt: elapsedSeconds,
      totalSeconds,
      isRunning: false
    };
  } else {
    // 恢復為運行狀態
    timerState = {
      startTimestamp: Date.now() - (elapsedSeconds * 1000),
      pausedAt: null,
      totalSeconds,
      isRunning: true
    };
    startInterval();
  }

  self.postMessage({
    type: 'restored',
    state: getState()
  });
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
      resumeTimer(payload?.fromElapsed);
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
    case 'restore':
      // 從外部狀態恢復（頁面重載時使用）
      restoreFromState(payload);
      break;
    case 'sync':
      // 強制同步一次（用於頁面變為可見時或從 freeze 恢復）
      if (timerState.isRunning) {
        tick();
      } else {
        // 即使暫停中也回報狀態
        self.postMessage({
          type: 'state',
          state: getState()
        });
      }
      break;
  }
};
