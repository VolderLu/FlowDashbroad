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

  // 訂閱狀態變化（只響應 top3 相關更新，忽略 timer tick 等高頻更新）
  Store.subscribe(render, {
    tags: [Store.UPDATE_TAGS.TOP3, Store.UPDATE_TAGS.ALL]
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

    // 文字輸入
    input.addEventListener('input', debounce(() => {
      Store.Top3Actions.updateText(index, input.value);
    }, 300));

    // 勾選狀態
    checkbox.addEventListener('change', () => {
      Store.Top3Actions.toggleComplete(index);
    });
  });
}

/**
 * 渲染
 * @param {Object} state
 */
function render(state) {
  const { top3 } = state;

  top3Items.forEach((item, index) => {
    const data = top3.items[index];
    const checkbox = item.querySelector('.top3__checkbox');
    const input = item.querySelector('.top3__input');

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
