/**
 * FlowDashboard - Top 3 Module
 * 三大優先模組
 */

import { Store } from '../state/store.js';

// DOM 元素
let top3Items;

/**
 * 初始化 Top3 模組
 */
export function initTop3() {
  top3Items = document.querySelectorAll('.top3__item');

  // 綁定事件
  bindEvents();

  // 訂閱狀態變化（響應 top3 和 timer 狀態變化，忽略 timer tick 等高頻更新）
  Store.subscribe(render, {
    tags: [Store.UPDATE_TAGS.TOP3, Store.UPDATE_TAGS.TIMER, Store.UPDATE_TAGS.ALL]
  });

  // 初始渲染
  render(Store.getState());
}

/**
 * 綁定事件
 */
function bindEvents() {
  top3Items.forEach((item, index) => {
    const checkbox = item.querySelector('.top3__checkbox');
    const input = item.querySelector('.top3__input');

    // 整個 item 可點擊（IDLE 時預選）
    item.addEventListener('click', (e) => handleItemClick(e, index));

    // 文字輸入
    input.addEventListener('input', debounce(() => {
      Store.Top3Actions.updateText(index, input.value);
    }, 300));
    input.addEventListener('click', (e) => e.stopPropagation());

    // 勾選狀態
    checkbox.addEventListener('change', () => {
      Store.Top3Actions.toggleComplete(index);
    });
    checkbox.addEventListener('click', (e) => e.stopPropagation());
  });
}

/**
 * 處理項目點擊（IDLE 時預選）
 * @param {Event} e
 * @param {number} index
 */
function handleItemClick(e, index) {
  const state = Store.getState();
  // 只有 IDLE 狀態可以預選
  if (state.timer.status !== 'IDLE') return;

  Store.TimerActions.selectTop3(index);
}

/**
 * 渲染
 * @param {Object} state
 */
function render(state) {
  const { top3, timer } = state;
  const isFocusing = timer.status === 'FOCUS_RUNNING';

  top3Items.forEach((item, index) => {
    const data = top3.items[index];
    const checkbox = item.querySelector('.top3__checkbox');
    const input = item.querySelector('.top3__input');

    // FOCUS 時隱藏未選中的項目
    if (isFocusing && timer.currentTop3Index !== null && timer.currentTop3Index !== index) {
      item.style.display = 'none';
      return;
    }
    item.style.display = '';

    // IDLE 時顯示預選樣式
    const isSelected = timer.status === 'IDLE' && timer.selectedTop3Index === index;
    item.classList.toggle('top3__item--selected', isSelected);

    // 更新 checkbox
    checkbox.checked = data.completed;

    // 更新輸入框（只在值不同時更新，避免干擾用戶輸入）
    if (document.activeElement !== input && input.value !== data.text) {
      input.value = data.text;
    }

    // 更新樣式
    if (data.completed) {
      item.classList.add('top3__item--completed');
    } else {
      item.classList.remove('top3__item--completed');
    }
  });
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
