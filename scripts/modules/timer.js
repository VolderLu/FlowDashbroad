/**
 * FlowDashboard - Timer Module
 * 番茄鐘模組
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

// 計時器
let timerInterval = null;

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

  // 綁定事件
  bindEvents();

  // 訂閱狀態變化
  Store.subscribe(render);

  // 初始渲染
  render(Store.getState());
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
      Store.TimerActions.pauseFocus();
      stopInterval();
      break;
    case 'FOCUS_PAUSED':
      Store.TimerActions.resumeFocus();
      startInterval();
      break;
    case 'BREAK_RUNNING':
      Store.TimerActions.skipBreak();
      stopInterval();
      break;
    case 'BREAK_PAUSED':
      Store.TimerActions.resumeBreak();
      startInterval();
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
    stopInterval();
    const isValid = Store.TimerActions.stopFocus();
    if (isValid) {
      // 播放音效並開始休息計時
      if (state.settings.soundEnabled) {
        AudioService.playFocusEnd();
      }
      NotificationService.notifyFocusEnd();
      startInterval();
    }
  }
}

/**
 * 開始專注
 */
function startFocus() {
  Store.TimerActions.startFocus();
  startInterval();
}

/**
 * 開始計時
 */
function startInterval() {
  stopInterval();
  timerInterval = setInterval(tick, 1000);
}

/**
 * 停止計時
 */
function stopInterval() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

/**
 * 計時器 tick
 */
function tick() {
  const state = Store.getState();
  const status = state.timer.status;
  const remaining = state.timer.remainingSeconds;

  if (remaining <= 1) {
    // 時間到
    stopInterval();

    if (status === 'FOCUS_RUNNING') {
      Store.TimerActions.completeFocus();
      if (state.settings.soundEnabled) {
        AudioService.playFocusEnd();
      }
      NotificationService.notifyFocusEnd();
      startInterval(); // 開始休息計時
    } else if (status === 'BREAK_RUNNING') {
      Store.TimerActions.completeBreak();
      if (state.settings.soundEnabled) {
        AudioService.playBreakEnd();
      }
      NotificationService.notifyBreakEnd();
    }
  } else {
    Store.TimerActions.tick();
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
 * @param {Object} state
 */
function render(state) {
  const { timer, focusRecords } = state;

  // 更新狀態屬性
  timerEl.dataset.state = timer.status;
  timerContainerEl.dataset.state = timer.status;

  // 更新狀態標籤
  statusEl.textContent = STATUS_LABELS[timer.status];

  // 更新時間顯示
  timeEl.textContent = formatTime(timer.remainingSeconds);

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
