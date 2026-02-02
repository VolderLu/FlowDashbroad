/**
 * FlowDashboard - Storage Service
 * localStorage 儲存服務
 */

import { getTodayDate, generateId } from '../utils/time.js';

const STORAGE_KEY = 'flowdashboard_state';
const VERSION = 1;

// ============ 延遲儲存機制 ============
const SAVE_DELAY_MS = 1000;  // 延遲儲存時間（毫秒）
let saveTimeout = null;
let pendingState = null;

/**
 * 建立初始狀態
 * @returns {Object}
 */
function createInitialState() {
  return {
    timer: {
      status: 'IDLE',
      focusDuration: 25,
      breakDuration: 5,
      remainingSeconds: 25 * 60,
      elapsedSeconds: 0,
      currentTaskId: null,
      currentTop3Index: null,      // FOCUS 時當前的三大優先索引
      selectedTaskId: null,        // IDLE 時預選的任務 ID
      selectedTop3Index: null,     // IDLE 時預選的三大優先索引
      focusCount: 0,
      startTime: null
    },
    top3: {
      items: [
        { text: '', completed: false },
        { text: '', completed: false },
        { text: '', completed: false }
      ]
    },
    tasks: [],
    focusRecords: [],
    settings: {
      soundEnabled: true,
      soundVolume: 0.5,
      notificationEnabled: true
    }
  };
}

/**
 * 從 localStorage 載入狀態
 * @returns {Object|null}
 */
function load() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    return parsed.data || null;
  } catch (e) {
    console.error('Failed to load state:', e);
    return null;
  }
}

/**
 * 儲存狀態到 localStorage（同步版本，僅供內部使用）
 * @param {Object} state
 */
function saveSync(state) {
  try {
    const data = {
      version: VERSION,
      date: getTodayDate(),
      data: state
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save state:', e);
  }
}

/**
 * 延遲儲存狀態到 localStorage（非阻塞）
 * 使用 debounce + requestIdleCallback 避免阻塞 UI
 * @param {Object} state
 */
function save(state) {
  // 記錄待儲存的狀態
  pendingState = state;

  // 清除之前的 timeout
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  // 延遲儲存
  saveTimeout = setTimeout(() => {
    if (pendingState) {
      // 優先使用 requestIdleCallback（在瀏覽器閒置時執行）
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => {
          saveSync(pendingState);
          pendingState = null;
        }, { timeout: 2000 }); // 最多等 2 秒
      } else {
        // Fallback: 直接儲存
        saveSync(pendingState);
        pendingState = null;
      }
    }
    saveTimeout = null;
  }, SAVE_DELAY_MS);
}

/**
 * 立即儲存（用於頁面卸載前等關鍵時刻）
 * @param {Object} state
 */
function saveImmediate(state) {
  // 清除待處理的延遲儲存
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  pendingState = null;

  // 同步儲存
  saveSync(state);
}

/**
 * 強制刷新待儲存的狀態（若有）
 */
function flushPendingSave() {
  if (pendingState) {
    saveSync(pendingState);
    pendingState = null;
  }
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
}

/**
 * 清空儲存
 */
function clear() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * 檢查日期並重置（如果是新的一天）
 * @returns {Object}
 */
function checkDateAndReset() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const today = getTodayDate();

    if (!stored) {
      const initialState = createInitialState();
      save(initialState);
      return initialState;
    }

    const parsed = JSON.parse(stored);

    // 如果日期不同，清空資料
    if (parsed.date !== today) {
      console.log('New day detected, resetting data...');
      const initialState = createInitialState();
      // 保留設定
      if (parsed.data?.settings) {
        initialState.settings = parsed.data.settings;
      }
      save(initialState);
      return initialState;
    }

    return parsed.data;
  } catch (e) {
    console.error('Failed to check date:', e);
    const initialState = createInitialState();
    save(initialState);
    return initialState;
  }
}

// 頁面卸載前確保資料已儲存
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushPendingSave);
  // visibilitychange 也要處理（行動裝置切換 app 時）
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      flushPendingSave();
    }
  });
}

export const StorageService = {
  STORAGE_KEY,
  load,
  save,
  saveImmediate,
  flushPendingSave,
  clear,
  checkDateAndReset,
  createInitialState
};
