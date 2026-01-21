/**
 * FlowDashboard - Timer Module
 * 番茄鐘模組（使用 Web Worker 計時，徹底解決標籤頁節流問題）
 */

import { Store } from '../state/store.js';
import { formatTime } from '../utils/time.js';
import { NotificationService } from '../services/notification.js';
import { AudioService } from '../services/audio.js';

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

// 本地計時狀態（用於 fallback 和狀態追蹤）
let timerState = {
  isRunning: false,
  totalSeconds: 0,
  elapsed: 0,
  remaining: 0
};

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

  // 監聯頁面可見性變化（標籤頁切換回來時請求同步）
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // 訂閱狀態變化
  Store.subscribe(render);

  // 初始渲染
  render(Store.getState());
}

/**
 * 初始化 Web Worker
 */
function initWorker() {
  try {
    // 取得當前腳本的路徑，推導 Worker 路徑
    const workerUrl = new URL('../workers/timer-worker.js', import.meta.url);
    timerWorker = new Worker(workerUrl, { type: 'module' });

    // 監聽 Worker 訊息
    timerWorker.onmessage = handleWorkerMessage;

    timerWorker.onerror = (error) => {
      console.error('Timer Worker error:', error);
      // Worker 失敗時可以考慮 fallback 到原本的 setInterval 方式
    };

    console.log('Timer Web Worker initialized');
  } catch (error) {
    console.error('Failed to initialize Timer Worker:', error);
  }
}

/**
 * 處理 Worker 訊息
 */
function handleWorkerMessage(e) {
  const { type, remaining, elapsed, state } = e.data;

  switch (type) {
    case 'tick':
      handleTick(remaining, elapsed);
      break;
    case 'complete':
      handleTimerComplete(elapsed);
      break;
    case 'paused':
      timerState.isRunning = false;
      timerState.elapsed = e.data.pausedAt;
      break;
    case 'state':
      timerState = { ...timerState, ...state };
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
  if (!document.hidden && timerState.isRunning && timerWorker) {
    // 標籤頁變為可見時，請求 Worker 同步一次
    timerWorker.postMessage({ type: 'sync' });
  }
}

/**
 * 處理 Worker tick 訊息
 */
function handleTick(remaining, elapsed) {
  timerState.remaining = remaining;
  timerState.elapsed = elapsed;

  // 更新顯示
  timeEl.textContent = formatTime(remaining);

  // 更新 store 中的時間（用於記錄）
  Store.setState(s => ({
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
function handleTimerComplete(elapsed) {
  const state = Store.getState();
  const status = state.timer.status;

  timerState.isRunning = false;

  // 更新 store 中的 elapsedSeconds
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
    const elapsedSeconds = getElapsedSeconds();
    stopTimer();

    // 更新 store 中的 elapsedSeconds
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
 * 開始計時（透過 Web Worker）
 * @param {number} totalSeconds - 總秒數
 * @param {number} [pausedAt] - 如果是從暫停恢復，傳入已經過的秒數
 */
function startTimer(totalSeconds, pausedAt = null) {
  timerState = {
    isRunning: true,
    totalSeconds,
    elapsed: pausedAt || 0,
    remaining: totalSeconds - (pausedAt || 0)
  };

  if (timerWorker) {
    timerWorker.postMessage({
      type: 'start',
      payload: { totalSeconds, pausedAt }
    });
  }
}

/**
 * 暫停計時
 */
function pauseTimer() {
  if (timerState.isRunning && timerWorker) {
    timerWorker.postMessage({ type: 'pause' });
    timerState.isRunning = false;
  }
}

/**
 * 繼續計時
 */
function resumeTimer() {
  if (!timerState.isRunning && timerWorker) {
    timerWorker.postMessage({ type: 'resume' });
    timerState.isRunning = true;
  }
}

/**
 * 停止計時
 */
function stopTimer() {
  if (timerWorker) {
    timerWorker.postMessage({ type: 'stop' });
  }
  timerState = {
    isRunning: false,
    totalSeconds: 0,
    elapsed: 0,
    remaining: 0
  };
}

/**
 * 獲取已經過的秒數
 * @returns {number}
 */
function getElapsedSeconds() {
  return timerState.elapsed;
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
 * @param {Object} state
 */
function render(state) {
  const { timer, focusRecords } = state;

  // 更新狀態屬性
  timerEl.dataset.state = timer.status;
  timerContainerEl.dataset.state = timer.status;

  // 更新狀態標籤
  statusEl.textContent = STATUS_LABELS[timer.status];

  // 更新時間顯示（如果不在運行中，使用 store 的值）
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
 * @param {Array} records
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
 * @param {Event} e
 */
function handleRecordEdit(e) {
  const recordItem = e.target.closest('.record-item');
  const recordId = recordItem.dataset.recordId;
  const field = e.target.dataset.field;
  let value = e.target.value;

  if (field === 'duration') {
    // 解析分鐘數
    const match = value.match(/\d+/);
    value = match ? parseInt(match[0], 10) : 0;
    e.target.value = `${value} 分鐘`;
  }

  Store.RecordActions.updateRecord(recordId, { [field]: value });
}
