/**
 * FlowDashboard - Storage Service
 * localStorage 儲存服務
 */

import { getTodayDate, generateId } from '../utils/time.js';

const STORAGE_KEY = 'flowdashboard_state';
const VERSION = 1;

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
 * 儲存狀態到 localStorage
 * @param {Object} state
 */
function save(state) {
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

export const StorageService = {
  STORAGE_KEY,
  load,
  save,
  clear,
  checkDateAndReset,
  createInitialState
};
