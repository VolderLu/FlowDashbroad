/**
 * FlowDashboard - Tasks Module
 * 任務管理模組
 */

import { Store } from '../state/store.js';
import { AudioService } from '../services/audio.js';

// DOM 元素
let taskListEl;
let addTaskBtn;
let taskTemplate;

/**
 * 初始化 Tasks 模組
 */
export function initTasks() {
  taskListEl = document.getElementById('task-list');
  addTaskBtn = document.getElementById('add-task-btn');
  taskTemplate = document.getElementById('task-card-template');

  // 綁定新增任務按鈕
  addTaskBtn.addEventListener('click', handleAddTask);

  // 訂閱狀態變化
  Store.subscribe(render);

  // 初始渲染
  render(Store.getState());
}

/**
 * 處理新增任務
 */
function handleAddTask() {
  const taskId = Store.TaskActions.addTask();

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
  // 卡片點擊（選擇當前任務）
  taskListEl.querySelectorAll('.task-card').forEach(card => {
    card.addEventListener('click', handleCardClick);
  });

  // 任務完成 checkbox
  taskListEl.querySelectorAll('.task-card__checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', handleTaskComplete);
    checkbox.addEventListener('click', e => e.stopPropagation());
  });

  // 任務名稱
  taskListEl.querySelectorAll('.task-card__name').forEach(input => {
    input.addEventListener('input', debounce(handleTaskNameChange, 300));
    input.addEventListener('click', e => e.stopPropagation());
  });

  // 任務描述
  taskListEl.querySelectorAll('.task-card__description').forEach(input => {
    input.addEventListener('input', debounce(handleTaskDescriptionChange, 300));
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
    input.addEventListener('input', debounce(handleStepTextChange, 300));
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
 * 處理任務名稱變更
 * @param {Event} e
 */
function handleTaskNameChange(e) {
  const card = e.target.closest('.task-card');
  const taskId = card.dataset.taskId;
  Store.TaskActions.updateTask(taskId, { name: e.target.value });
}

/**
 * 處理任務描述變更
 * @param {Event} e
 */
function handleTaskDescriptionChange(e) {
  const card = e.target.closest('.task-card');
  const taskId = card.dataset.taskId;
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
 * 處理步驟文字變更
 * @param {Event} e
 */
function handleStepTextChange(e) {
  const card = e.target.closest('.task-card');
  const taskId = card.dataset.taskId;
  const stepIndex = parseInt(e.target.dataset.stepIndex, 10);
  Store.TaskActions.updateStep(taskId, stepIndex, e.target.value);
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

/**
 * Debounce 函數
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
function debounce(fn, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}
