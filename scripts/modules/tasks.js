/**
 * FlowDashboard - Tasks Module
 * 任務管理模組
 */

import { Store } from '../state/store.js';
import { AudioService } from '../services/audio.js';

// DOM 元素
let taskListEl;
let addTaskBtn;

// 追蹤是否正在輸入（避免 render 中斷輸入）
let isTyping = false;
let typingTimeout = null;

// 追蹤是否正在 hover（避免 render 導致閃爍）
let isHovering = false;

// 延遲儲存用的 debounce timers
const saveTimers = new Map();

/**
 * 初始化 Tasks 模組
 */
export function initTasks() {
  taskListEl = document.getElementById('task-list');
  addTaskBtn = document.getElementById('add-task-btn');

  // 綁定新增任務按鈕
  addTaskBtn.addEventListener('click', handleAddTask);

  // 訂閱狀態變化
  Store.subscribe(handleStateChange);

  // 初始渲染
  render(Store.getState());
}

/**
 * 處理狀態變化
 * @param {Object} state
 */
function handleStateChange(state) {
  // 如果正在輸入或 hover，不重新渲染（避免中斷輸入或閃爍）
  if (isTyping || isHovering) {
    return;
  }
  render(state);
}

/**
 * 設定輸入狀態
 * @param {boolean} typing
 */
function setTyping(typing) {
  isTyping = typing;

  if (typing) {
    // 清除之前的 timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    // 停止輸入後 10 秒才允許 render
    typingTimeout = setTimeout(() => {
      isTyping = false;
      // 輸入結束後，用最新狀態重新渲染
      render(Store.getState());
    }, 10000);
  }
}

/**
 * 處理新增任務
 */
function handleAddTask() {
  const taskId = Store.TaskActions.addTask();

  // 立即渲染（新增任務時需要立即顯示）
  isTyping = false;
  render(Store.getState());

  // 等待渲染完成後，聚焦到新任務的名稱輸入框
  requestAnimationFrame(() => {
    const newCard = taskListEl.querySelector(`[data-task-id="${taskId}"]`);
    if (newCard) {
      const nameInput = newCard.querySelector('.task-card__name');
      nameInput.focus();
    }
  });
}

/**
 * 渲染任務列表
 * @param {Object} state
 */
function render(state) {
  const { tasks, timer } = state;

  // 排序：未完成在前，已完成在後
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.completed && !b.completed) return 1;
    if (!a.completed && b.completed) return -1;
    return 0;
  });

  // 如果沒有任務，顯示空狀態
  if (sortedTasks.length === 0) {
    taskListEl.innerHTML = '';
    return;
  }

  // 渲染任務卡片
  taskListEl.innerHTML = sortedTasks.map(task => createTaskCardHTML(task, timer)).join('');

  // 綁定事件
  bindTaskEvents();
}

/**
 * 創建任務卡片 HTML
 * @param {Object} task
 * @param {Object} timer
 * @returns {string}
 */
function createTaskCardHTML(task, timer) {
  const isActive = timer.currentTaskId === task.id;
  const isFocusing = timer.status === 'FOCUS_RUNNING' || timer.status === 'FOCUS_PAUSED';

  const activeClass = isActive ? 'task-card--active' : '';
  const completedClass = task.completed ? 'task-card--completed' : '';

  const stepsHTML = task.steps.map((step, index) => `
    <li class="task-card__step ${step.completed ? 'task-card__step--completed' : ''}">
      <input
        type="checkbox"
        class="task-card__step-check"
        data-step-index="${index}"
        ${step.completed ? 'checked' : ''}
      >
      <input
        type="text"
        class="task-card__step-text"
        value="${escapeHtml(step.text)}"
        placeholder="步驟 ${index + 1}${index === 0 ? '（必填）' : '（選填）'}"
        data-step-index="${index}"
      >
    </li>
  `).join('');

  return `
    <article
      class="task-card ${activeClass} ${completedClass}"
      data-task-id="${task.id}"
      data-clickable="${isFocusing}"
    >
      <header class="task-card__header">
        <input
          type="checkbox"
          class="task-card__checkbox"
          ${task.completed ? 'checked' : ''}
        >
        <input
          type="text"
          class="task-card__name"
          value="${escapeHtml(task.name)}"
          placeholder="任務名稱..."
        >
        <button class="task-card__delete" aria-label="刪除任務">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </header>
      <div class="task-card__body">
        <input
          type="text"
          class="task-card__description"
          value="${escapeHtml(task.description)}"
          placeholder="一句話說明這個任務..."
        >
        <ul class="task-card__steps">
          ${stepsHTML}
        </ul>
      </div>
    </article>
  `;
}

/**
 * 綁定任務卡片事件
 */
function bindTaskEvents() {
  // 卡片點擊（選擇當前任務）與 hover 事件
  taskListEl.querySelectorAll('.task-card').forEach(card => {
    card.addEventListener('click', handleCardClick);
    card.addEventListener('mouseenter', handleCardMouseEnter);
    card.addEventListener('mouseleave', handleCardMouseLeave);
  });

  // 任務完成 checkbox
  taskListEl.querySelectorAll('.task-card__checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', handleTaskComplete);
    checkbox.addEventListener('click', e => e.stopPropagation());
  });

  // 任務名稱
  taskListEl.querySelectorAll('.task-card__name').forEach(input => {
    input.addEventListener('input', handleTaskNameInput);
    input.addEventListener('focus', () => setTyping(true));
    input.addEventListener('blur', handleTaskNameBlur);
    input.addEventListener('click', e => e.stopPropagation());
  });

  // 任務描述
  taskListEl.querySelectorAll('.task-card__description').forEach(input => {
    input.addEventListener('input', handleTaskDescriptionInput);
    input.addEventListener('focus', () => setTyping(true));
    input.addEventListener('blur', handleTaskDescriptionBlur);
    input.addEventListener('click', e => e.stopPropagation());
  });

  // 刪除按鈕
  taskListEl.querySelectorAll('.task-card__delete').forEach(btn => {
    btn.addEventListener('click', handleTaskDelete);
  });

  // 步驟 checkbox
  taskListEl.querySelectorAll('.task-card__step-check').forEach(checkbox => {
    checkbox.addEventListener('change', handleStepComplete);
    checkbox.addEventListener('click', e => e.stopPropagation());
  });

  // 步驟文字
  taskListEl.querySelectorAll('.task-card__step-text').forEach(input => {
    input.addEventListener('input', handleStepTextInput);
    input.addEventListener('focus', () => setTyping(true));
    input.addEventListener('blur', handleStepTextBlur);
    input.addEventListener('click', e => e.stopPropagation());
  });
}

/**
 * 處理卡片點擊
 * @param {Event} e
 */
function handleCardClick(e) {
  const card = e.currentTarget;
  const state = Store.getState();

  // 只有專注中才能選擇任務
  if (state.timer.status !== 'FOCUS_RUNNING' && state.timer.status !== 'FOCUS_PAUSED') {
    return;
  }

  const taskId = card.dataset.taskId;
  const currentTaskId = state.timer.currentTaskId;

  // 切換選擇
  if (currentTaskId === taskId) {
    Store.TimerActions.setCurrentTask(null);
  } else {
    Store.TimerActions.setCurrentTask(taskId);
  }
}

/**
 * 處理卡片滑鼠進入（暫停 render 避免閃爍）
 */
function handleCardMouseEnter() {
  isHovering = true;
}

/**
 * 處理卡片滑鼠離開（恢復 render）
 */
function handleCardMouseLeave() {
  isHovering = false;
  // 離開後用最新狀態重新渲染
  render(Store.getState());
}

/**
 * 處理任務完成
 * @param {Event} e
 */
function handleTaskComplete(e) {
  const card = e.target.closest('.task-card');
  const taskId = card.dataset.taskId;
  const state = Store.getState();

  if (e.target.checked) {
    Store.TaskActions.completeTask(taskId);
    if (state.settings.soundEnabled) {
      AudioService.playTaskComplete();
    }
  } else {
    Store.TaskActions.updateTask(taskId, { completed: false, completedAt: null });
  }
}

/**
 * 處理任務名稱輸入（只標記正在輸入，不儲存）
 * @param {Event} e
 */
function handleTaskNameInput(e) {
  setTyping(true);

  // 延遲儲存
  const card = e.target.closest('.task-card');
  const taskId = card.dataset.taskId;
  const value = e.target.value;

  debouncedSave(`name-${taskId}`, () => {
    Store.TaskActions.updateTask(taskId, { name: value });
  });
}

/**
 * 處理任務名稱失焦（立即儲存）
 * @param {Event} e
 */
function handleTaskNameBlur(e) {
  const card = e.target.closest('.task-card');
  const taskId = card.dataset.taskId;

  // 清除延遲儲存
  clearSaveTimer(`name-${taskId}`);

  // 立即儲存
  Store.TaskActions.updateTask(taskId, { name: e.target.value });
}

/**
 * 處理任務描述輸入
 * @param {Event} e
 */
function handleTaskDescriptionInput(e) {
  setTyping(true);

  const card = e.target.closest('.task-card');
  const taskId = card.dataset.taskId;
  const value = e.target.value;

  debouncedSave(`desc-${taskId}`, () => {
    Store.TaskActions.updateTask(taskId, { description: value });
  });
}

/**
 * 處理任務描述失焦
 * @param {Event} e
 */
function handleTaskDescriptionBlur(e) {
  const card = e.target.closest('.task-card');
  const taskId = card.dataset.taskId;

  clearSaveTimer(`desc-${taskId}`);
  Store.TaskActions.updateTask(taskId, { description: e.target.value });
}

/**
 * 處理任務刪除
 * @param {Event} e
 */
function handleTaskDelete(e) {
  e.stopPropagation();
  const card = e.target.closest('.task-card');
  const taskId = card.dataset.taskId;

  // 刪除時立即渲染
  isTyping = false;
  Store.TaskActions.deleteTask(taskId);
}

/**
 * 處理步驟完成
 * @param {Event} e
 */
function handleStepComplete(e) {
  const card = e.target.closest('.task-card');
  const taskId = card.dataset.taskId;
  const stepIndex = parseInt(e.target.dataset.stepIndex, 10);
  Store.TaskActions.toggleStep(taskId, stepIndex);
}

/**
 * 處理步驟文字輸入
 * @param {Event} e
 */
function handleStepTextInput(e) {
  setTyping(true);

  const card = e.target.closest('.task-card');
  const taskId = card.dataset.taskId;
  const stepIndex = parseInt(e.target.dataset.stepIndex, 10);
  const value = e.target.value;

  debouncedSave(`step-${taskId}-${stepIndex}`, () => {
    Store.TaskActions.updateStep(taskId, stepIndex, value);
  });
}

/**
 * 處理步驟文字失焦
 * @param {Event} e
 */
function handleStepTextBlur(e) {
  const card = e.target.closest('.task-card');
  const taskId = card.dataset.taskId;
  const stepIndex = parseInt(e.target.dataset.stepIndex, 10);

  clearSaveTimer(`step-${taskId}-${stepIndex}`);
  Store.TaskActions.updateStep(taskId, stepIndex, e.target.value);
}

/**
 * 延遲儲存（使用 Map 管理多個 timer）
 * @param {string} key
 * @param {Function} saveFn
 */
function debouncedSave(key, saveFn) {
  // 清除之前的 timer
  if (saveTimers.has(key)) {
    clearTimeout(saveTimers.get(key));
  }

  // 設定新的 timer（500ms 後儲存）
  const timer = setTimeout(() => {
    saveFn();
    saveTimers.delete(key);
  }, 500);

  saveTimers.set(key, timer);
}

/**
 * 清除儲存 timer
 * @param {string} key
 */
function clearSaveTimer(key) {
  if (saveTimers.has(key)) {
    clearTimeout(saveTimers.get(key));
    saveTimers.delete(key);
  }
}

/**
 * HTML 轉義
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
