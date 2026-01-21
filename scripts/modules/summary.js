/**
 * FlowDashboard - Summary Module
 * 今日摘要模組
 */

import { Store } from '../state/store.js';
import { formatDuration } from '../utils/time.js';

// DOM 元素
let fabEl;
let triggerEl;
let panelEl;
let focusCountEl;
let totalTimeEl;
let taskCountEl;

/**
 * 初始化 Summary 模組
 */
export function initSummary() {
  fabEl = document.getElementById('summary-fab');
  triggerEl = document.getElementById('summary-trigger');
  panelEl = document.getElementById('summary-panel');
  focusCountEl = document.getElementById('summary-focus-count');
  totalTimeEl = document.getElementById('summary-total-time');
  taskCountEl = document.getElementById('summary-task-count');

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
  // 點擊觸發按鈕
  triggerEl.addEventListener('click', togglePanel);

  // 點擊外部關閉
  document.addEventListener('click', (e) => {
    if (!fabEl.contains(e.target)) {
      closePanel();
    }
  });

  // ESC 關閉
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePanel();
    }
  });
}

/**
 * 切換面板
 */
function togglePanel() {
  fabEl.classList.toggle('summary-fab--open');
}

/**
 * 關閉面板
 */
function closePanel() {
  fabEl.classList.remove('summary-fab--open');
}

/**
 * 渲染
 * @param {Object} state
 */
function render(state) {
  const { focusRecords, tasks } = state;

  // 專注次數
  const focusCount = focusRecords.length;
  focusCountEl.textContent = focusCount;

  // 總時間
  const totalMinutes = focusRecords.reduce((sum, r) => sum + r.duration, 0);
  totalTimeEl.textContent = totalMinutes > 0 ? formatDuration(totalMinutes) : '0m';

  // 完成任務數
  const completedTasks = tasks.filter(t => t.completed).length;
  taskCountEl.textContent = completedTasks;
}
