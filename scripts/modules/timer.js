/**
 * FlowDashboard - Timer Module
 * 番茄鐘模組（使用 Web Worker 計時，徹底解決標籤頁節流問題）
 */

import { Store } from '../state/store.js';
import { formatTime } from '../utils/time.js';
import { NotificationService } from '../services/notification.js';
import { AudioService } from '../services/audio.js';

// ============ 常數 ============
const TICK_STALE_THRESHOLD_MS = 1000;  // tick 訊息過期閾值（毫秒）
const FALLBACK_TICK_INTERVAL_MS = 1000; // Fallback 計時器間隔

// DOM 元素
let timerEl;
let timerContainerEl;
let statusEl;
let timeEl;
let durationControlEl;
let durationValueEl;
let primaryBtn;
let secondaryBtn;
let recordToggle;
let recordPanel;
let recordList;

// Web Worker 實例
let timerWorker = null;

// Fallback 計時器（當 Worker 不可用時使用）
let fallbackInterval = null;
let fallbackStartTime = null;
let fallbackPausedElapsed = 0;

// 本地計時狀態
let timerState = {
  isRunning: false,
  isPaused: false,
  totalSeconds: 0,
  elapsed: 0,
  remaining: 0
};

// 是否正在使用 fallback 模式
let usingFallback = false;

// 狀態標籤文案對照
const STATUS_LABELS = {
  IDLE: '靜待',
  FOCUS_RUNNING: '沉浸',
  FOCUS_PAUSED: '小憩',
  BREAK_RUNNING: '呼吸',
  BREAK_PAUSED: '駐足'
};

// 按鈕文案對照
const BUTTON_CONFIG = {
  IDLE: { primary: '開始', secondary: null },
  FOCUS_RUNNING: { primary: '暫歇', secondary: '結束' },
  FOCUS_PAUSED: { primary: '續行', secondary: '結束' },
  BREAK_RUNNING: { primary: '回歸', secondary: null },
  BREAK_PAUSED: { primary: '續行', secondary: null }
};

/**
 * 初始化 Timer 模組
 */
export function initTimer() {
  // 獲取 DOM 元素
  timerEl = document.getElementById('timer');
  timerContainerEl = document.getElementById('timer-container');
  statusEl = document.getElementById('timer-status');
  timeEl = document.getElementById('timer-time');
  durationControlEl = document.getElementById('duration-control');
  durationValueEl = document.getElementById('duration-value');
  primaryBtn = document.getElementById('timer-primary-btn');
  secondaryBtn = document.getElementById('timer-secondary-btn');
  recordToggle = document.getElementById('record-toggle');
  recordPanel = document.getElementById('record-panel');
  recordList = document.getElementById('record-list');

  // 初始化 Web Worker
  initWorker();

  // 綁定事件
  bindEvents();

  // 監聽頁面可見性變化
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // 監聽 Page Lifecycle API（Chrome 的 freeze/resume）
  if ('onfreeze' in document) {
    document.addEventListener('freeze', handlePageFreeze);
    document.addEventListener('resume', handlePageResume);
  }

  // 訂閱狀態變化（響應計時器相關更新）
  Store.subscribe(render, {
    tags: [Store.UPDATE_TAGS.TIMER, Store.UPDATE_TAGS.RECORD, Store.UPDATE_TAGS.ALL]
  });

  // 初始渲染
  render(Store.getState());

  // 檢查是否需要從 localStorage 恢復計時器狀態
  restoreTimerFromStore();
}

/**
 * 初始化 Web Worker
 */
function initWorker() {
  try {
    const workerUrl = new URL('../workers/timer-worker.js', import.meta.url);
    timerWorker = new Worker(workerUrl, { type: 'module' });

    timerWorker.onmessage = handleWorkerMessage;

    timerWorker.onerror = (error) => {
      console.error('Timer Worker error:', error);
      enableFallbackMode();
    };

    console.log('Timer Web Worker initialized');
  } catch (error) {
    console.error('Failed to initialize Timer Worker:', error);
    enableFallbackMode();
  }
}

/**
 * 啟用 Fallback 模式（當 Worker 不可用時）
 */
function enableFallbackMode() {
  if (usingFallback) return;

  console.warn('Enabling fallback timer mode');
  usingFallback = true;

  // 如果有正在運行的計時，用 setInterval 接管
  if (timerState.isRunning) {
    startFallbackTimer();
  }
}

/**
 * 開始 Fallback 計時器
 */
function startFallbackTimer() {
  stopFallbackTimer();
  fallbackStartTime = Date.now() - (timerState.elapsed * 1000);

  fallbackInterval = setInterval(() => {
    if (!timerState.isRunning) return;

    const elapsed = Math.floor((Date.now() - fallbackStartTime) / 1000);
    const remaining = Math.max(0, timerState.totalSeconds - elapsed);

    handleTick(remaining, elapsed);

    if (remaining <= 0) {
      stopFallbackTimer();
      handleTimerComplete(elapsed);
    }
  }, FALLBACK_TICK_INTERVAL_MS);
}

/**
 * 停止 Fallback 計時器
 */
function stopFallbackTimer() {
  if (fallbackInterval) {
    clearInterval(fallbackInterval);
    fallbackInterval = null;
  }
}

/**
 * 從 Store 恢復計時器狀態（頁面重載時）
 */
function restoreTimerFromStore() {
  const state = Store.getState();
  const { timer } = state;

  // 只有在計時中或暫停中才需要恢復
  if (timer.status === 'FOCUS_RUNNING' || timer.status === 'FOCUS_PAUSED' ||
      timer.status === 'BREAK_RUNNING' || timer.status === 'BREAK_PAUSED') {

    const isPaused = timer.status === 'FOCUS_PAUSED' || timer.status === 'BREAK_PAUSED';
    const isBreak = timer.status === 'BREAK_RUNNING' || timer.status === 'BREAK_PAUSED';
    const totalSeconds = isBreak
      ? timer.breakDuration * 60
      : timer.focusDuration * 60;

    timerState = {
      isRunning: !isPaused,
      isPaused,
      totalSeconds,
      elapsed: timer.elapsedSeconds || 0,
      remaining: timer.remainingSeconds || totalSeconds
    };

    // 通知 Worker 恢復狀態
    if (timerWorker && !usingFallback) {
      timerWorker.postMessage({
        type: 'restore',
        payload: {
          totalSeconds,
          elapsedSeconds: timer.elapsedSeconds || 0,
          isPaused
        }
      });
    } else if (usingFallback && !isPaused) {
      startFallbackTimer();
    }

    console.log('Timer restored from store:', timer.status);
  }
}

/**
 * 處理 Worker 訊息
 */
function handleWorkerMessage(e) {
  const { type, remaining, elapsed, state, timestamp, isOvertime, pausedAt } = e.data;

  switch (type) {
    case 'tick':
      // 過濾過期的 tick 訊息
      if (timestamp && (Date.now() - timestamp) > TICK_STALE_THRESHOLD_MS) {
        // 訊息過期，請求同步最新狀態
        timerWorker.postMessage({ type: 'getState' });
        return;
      }
      handleTick(remaining, elapsed);
      break;

    case 'complete':
      handleTimerComplete(elapsed, isOvertime);
      break;

    case 'paused':
      timerState.isRunning = false;
      timerState.isPaused = true;
      timerState.elapsed = pausedAt;
      timerState.remaining = e.data.remaining;
      break;

    case 'resumed':
      timerState.isRunning = true;
      timerState.isPaused = false;
      timerState.elapsed = elapsed;
      timerState.remaining = e.data.remaining;
      break;

    case 'state':
    case 'restored':
      // 從 Worker 同步狀態
      if (state) {
        timerState.isRunning = state.isRunning;
        timerState.isPaused = state.pausedAt !== null;
        timerState.elapsed = state.elapsed;
        timerState.remaining = state.remaining;

        // 更新 UI
        timeEl.textContent = formatTime(state.remaining);

        // 同步到 Store
        Store.setState(s => ({
          timer: {
            ...s.timer,
            remainingSeconds: state.remaining,
            elapsedSeconds: state.elapsed
          }
        }));
      }
      break;
  }
}

/**
 * 綁定事件
 */
function bindEvents() {
  // 時長調整
  document.getElementById('duration-decrease').addEventListener('click', () => {
    const state = Store.getState();
    const newDuration = Math.max(5, state.timer.focusDuration - 5);
    Store.TimerActions.setFocusDuration(newDuration);
  });

  document.getElementById('duration-increase').addEventListener('click', () => {
    const state = Store.getState();
    const newDuration = Math.min(60, state.timer.focusDuration + 5);
    Store.TimerActions.setFocusDuration(newDuration);
  });

  // 主要按鈕
  primaryBtn.addEventListener('click', handlePrimaryAction);

  // 次要按鈕
  secondaryBtn.addEventListener('click', handleSecondaryAction);

  // 紀錄展開/收合
  recordToggle.addEventListener('click', toggleRecordPanel);
}

/**
 * 處理頁面可見性變化
 */
function handleVisibilityChange() {
  if (!document.hidden) {
    // 標籤頁變為可見時，同步 Worker 狀態
    syncWorkerState();
  }
}

/**
 * 處理頁面凍結（Chrome Page Lifecycle）
 */
function handlePageFreeze() {
  console.log('Page frozen');
  // 頁面凍結時，Worker 也會被凍結，不需要特別處理
}

/**
 * 處理頁面恢復（Chrome Page Lifecycle）
 */
function handlePageResume() {
  console.log('Page resumed from freeze');
  // 從凍結恢復時，同步 Worker 狀態
  syncWorkerState();
}

/**
 * 同步 Worker 狀態到 UI
 */
function syncWorkerState() {
  if (timerWorker && !usingFallback) {
    timerWorker.postMessage({ type: 'sync' });
  } else if (usingFallback && timerState.isRunning) {
    // Fallback 模式下，重新計算當前時間
    const elapsed = Math.floor((Date.now() - fallbackStartTime) / 1000);
    const remaining = Math.max(0, timerState.totalSeconds - elapsed);
    handleTick(remaining, elapsed);
  }
}

/**
 * 處理 tick 更新
 * 優化：只更新 UI，不觸發完整的 Store 更新流程
 */
function handleTick(remaining, elapsed) {
  timerState.remaining = remaining;
  timerState.elapsed = elapsed;

  // 直接更新 DOM（不觸發 Store）
  timeEl.textContent = formatTime(remaining);

  // 靜默更新 Store 狀態（不儲存、不通知其他訂閱者）
  // 這樣在需要時（如計時完成）可以獲取正確的 elapsed 值
  Store.setStateQuiet(s => ({
    timer: {
      ...s.timer,
      remainingSeconds: remaining,
      elapsedSeconds: elapsed
    }
  }));
}

/**
 * 處理計時完成
 */
function handleTimerComplete(elapsed, isOvertime = false) {
  const state = Store.getState();
  const status = state.timer.status;

  timerState.isRunning = false;
  timerState.isPaused = false;

  if (isOvertime) {
    console.warn('Timer completed with overtime (possibly from sleep/wake)');
  }

  // 更新 Store
  Store.setState(s => ({
    timer: {
      ...s.timer,
      elapsedSeconds: elapsed,
      remainingSeconds: 0
    }
  }));

  if (status === 'FOCUS_RUNNING') {
    Store.TimerActions.completeFocus();
    if (state.settings.soundEnabled) {
      AudioService.playFocusEnd();
    }
    NotificationService.notifyFocusEnd();
    // 開始休息計時
    const newState = Store.getState();
    startTimer(newState.timer.breakDuration * 60);
  } else if (status === 'BREAK_RUNNING') {
    Store.TimerActions.completeBreak();
    if (state.settings.soundEnabled) {
      AudioService.playBreakEnd();
    }
    NotificationService.notifyBreakEnd();
  }
}

/**
 * 處理主要按鈕點擊
 */
function handlePrimaryAction() {
  const state = Store.getState();
  const status = state.timer.status;

  switch (status) {
    case 'IDLE':
      startFocus();
      break;
    case 'FOCUS_RUNNING':
      pauseTimer();
      Store.TimerActions.pauseFocus();
      break;
    case 'FOCUS_PAUSED':
      resumeTimer();
      Store.TimerActions.resumeFocus();
      break;
    case 'BREAK_RUNNING':
      stopTimer();
      Store.TimerActions.skipBreak();
      break;
    case 'BREAK_PAUSED':
      resumeTimer();
      Store.TimerActions.resumeBreak();
      break;
  }
}

/**
 * 處理次要按鈕點擊
 */
function handleSecondaryAction() {
  const state = Store.getState();
  const status = state.timer.status;

  if (status === 'FOCUS_RUNNING' || status === 'FOCUS_PAUSED') {
    const elapsedSeconds = timerState.elapsed;
    stopTimer();

    // 更新 Store
    Store.setState(s => ({
      timer: {
        ...s.timer,
        elapsedSeconds
      }
    }));

    const isValid = Store.TimerActions.stopFocus();
    if (isValid) {
      if (state.settings.soundEnabled) {
        AudioService.playFocusEnd();
      }
      NotificationService.notifyFocusEnd();
      // 開始休息計時
      const breakState = Store.getState();
      startTimer(breakState.timer.breakDuration * 60);
    }
  }
}

/**
 * 開始專注
 */
function startFocus() {
  const state = Store.getState();
  Store.TimerActions.startFocus();
  startTimer(state.timer.focusDuration * 60);
}

/**
 * 開始計時
 */
function startTimer(totalSeconds, pausedAt = null) {
  timerState = {
    isRunning: true,
    isPaused: false,
    totalSeconds,
    elapsed: pausedAt || 0,
    remaining: totalSeconds - (pausedAt || 0)
  };

  if (timerWorker && !usingFallback) {
    timerWorker.postMessage({
      type: 'start',
      payload: { totalSeconds, pausedAt }
    });
  } else {
    fallbackPausedElapsed = pausedAt || 0;
    startFallbackTimer();
  }
}

/**
 * 暫停計時
 */
function pauseTimer() {
  timerState.isRunning = false;
  timerState.isPaused = true;

  if (timerWorker && !usingFallback) {
    timerWorker.postMessage({ type: 'pause' });
  } else {
    stopFallbackTimer();
    fallbackPausedElapsed = timerState.elapsed;
  }
}

/**
 * 繼續計時
 */
function resumeTimer() {
  timerState.isRunning = true;
  timerState.isPaused = false;

  if (timerWorker && !usingFallback) {
    timerWorker.postMessage({
      type: 'resume',
      payload: { fromElapsed: timerState.elapsed }
    });
  } else {
    fallbackStartTime = Date.now() - (fallbackPausedElapsed * 1000);
    startFallbackTimer();
  }
}

/**
 * 停止計時
 */
function stopTimer() {
  timerState = {
    isRunning: false,
    isPaused: false,
    totalSeconds: 0,
    elapsed: 0,
    remaining: 0
  };

  if (timerWorker && !usingFallback) {
    timerWorker.postMessage({ type: 'stop' });
  } else {
    stopFallbackTimer();
  }
}

/**
 * 切換紀錄面板
 */
function toggleRecordPanel() {
  const isExpanded = recordPanel.dataset.expanded === 'true';
  recordPanel.dataset.expanded = !isExpanded;
  recordToggle.setAttribute('aria-expanded', !isExpanded);
  recordToggle.querySelector('span').textContent = isExpanded ? '展開紀錄' : '收合紀錄';
}

/**
 * 渲染
 */
function render(state) {
  const { timer, focusRecords } = state;

  // 更新狀態屬性
  timerEl.dataset.state = timer.status;
  timerContainerEl.dataset.state = timer.status;

  // 更新狀態標籤
  statusEl.textContent = STATUS_LABELS[timer.status];

  // 更新時間顯示（如果不在運行中，使用 Store 的值）
  if (!timerState.isRunning) {
    timeEl.textContent = formatTime(timer.remainingSeconds);
  }

  // 更新時長控制
  durationValueEl.textContent = `${timer.focusDuration} 分鐘`;

  // 更新按鈕
  const config = BUTTON_CONFIG[timer.status];
  primaryBtn.textContent = config.primary;

  if (config.secondary) {
    secondaryBtn.textContent = config.secondary;
    secondaryBtn.hidden = false;
  } else {
    secondaryBtn.hidden = true;
  }

  // 更新按鈕樣式
  if (timer.status === 'BREAK_RUNNING' || timer.status === 'BREAK_PAUSED') {
    primaryBtn.classList.remove('btn--primary');
    primaryBtn.classList.add('btn--secondary');
  } else {
    primaryBtn.classList.remove('btn--secondary');
    primaryBtn.classList.add('btn--primary');
  }

  // 渲染紀錄列表
  renderRecords(focusRecords);
}

/**
 * 渲染紀錄列表
 */
function renderRecords(records) {
  if (records.length === 0) {
    recordList.innerHTML = '<p class="record-empty">尚無專注紀錄</p>';
    return;
  }

  // 最新的在上面
  const sortedRecords = [...records].reverse();

  recordList.innerHTML = sortedRecords.map(record => `
    <div class="record-item" data-record-id="${record.id}">
      <span class="record-item__index">#${record.index}</span>
      <input
        type="text"
        class="record-item__duration"
        value="${record.duration} 分鐘"
        data-field="duration"
      >
      <input
        type="text"
        class="record-item__task"
        value="${record.taskName}"
        data-field="taskName"
      >
    </div>
  `).join('');

  // 綁定紀錄編輯事件
  recordList.querySelectorAll('.record-item input').forEach(input => {
    input.addEventListener('change', handleRecordEdit);
  });
}

/**
 * 處理紀錄編輯
 */
function handleRecordEdit(e) {
  const recordItem = e.target.closest('.record-item');
  const recordId = recordItem.dataset.recordId;
  const field = e.target.dataset.field;
  let value = e.target.value;

  if (field === 'duration') {
    const match = value.match(/\d+/);
    value = match ? parseInt(match[0], 10) : 0;
    e.target.value = `${value} 分鐘`;
  }

  Store.RecordActions.updateRecord(recordId, { [field]: value });
}
