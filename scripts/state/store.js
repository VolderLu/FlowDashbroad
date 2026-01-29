/**
 * FlowDashboard - State Store
 * 簡易狀態管理
 */

import { StorageService } from '../services/storage.js';

// ============ 常數 ============
const MIN_VALID_FOCUS_SECONDS = 5 * 60;  // 有效專注最低門檻（5 分鐘）
const LONG_BREAK_INTERVAL = 3;            // 每幾次專注後進入長休息
const SHORT_BREAK_MINUTES = 5;            // 短休息時長（分鐘）
const LONG_BREAK_MINUTES = 15;            // 長休息時長（分鐘）

/**
 * 生成唯一 ID
 * 優先使用 crypto.randomUUID()，若不支援則使用 fallback
 * @returns {string}
 */
function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: 使用時間戳 + 隨機數
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

// 訂閱者列表（支援標籤過濾）
// 格式: { callback: Function, tags: Set<string> | null }
const subscribers = new Map();

// 當前狀態
let state = null;

// 更新標籤常數
const UPDATE_TAGS = {
  TIMER_TICK: 'timer:tick',     // 計時器 tick（高頻，只更新 UI）
  TIMER: 'timer',               // 計時器狀態變化
  TASK: 'task',                 // 任務相關
  TOP3: 'top3',                 // 三大優先
  SETTINGS: 'settings',         // 設定
  RECORD: 'record',             // 專注紀錄
  ALL: '*'                      // 全部
};

/**
 * 初始化 Store
 */
function init() {
  state = StorageService.checkDateAndReset();
  notifySubscribers(UPDATE_TAGS.ALL);
}

/**
 * 獲取當前狀態
 * @returns {Object}
 */
function getState() {
  return state;
}

/**
 * 更新狀態
 * @param {Function} updater - 接收當前狀態，返回新狀態的函數
 * @param {Object} options - 選項
 * @param {string} options.tag - 更新標籤（用於選擇性通知）
 * @param {boolean} options.skipSave - 是否跳過儲存（用於高頻更新）
 * @param {boolean} options.skipNotify - 是否跳過通知訂閱者
 */
function setState(updater, options = {}) {
  const { tag = UPDATE_TAGS.ALL, skipSave = false, skipNotify = false } = options;

  const newState = updater(state);
  state = { ...state, ...newState };

  if (!skipSave) {
    StorageService.save(state);
  }

  if (!skipNotify) {
    notifySubscribers(tag);
  }
}

/**
 * 僅更新狀態（不儲存、不通知）
 * 用於高頻更新如 timer tick，之後手動觸發 UI 更新
 * @param {Function} updater
 */
function setStateQuiet(updater) {
  const newState = updater(state);
  state = { ...state, ...newState };
}

/**
 * 訂閱狀態變化
 * @param {Function} callback
 * @param {Object} options - 選項
 * @param {string[]} options.tags - 只響應這些標籤的更新（null 表示響應所有）
 * @returns {Function} 取消訂閱的函數
 */
function subscribe(callback, options = {}) {
  const { tags = null } = options;
  const tagSet = tags ? new Set(tags) : null;

  subscribers.set(callback, { callback, tags: tagSet });
  return () => subscribers.delete(callback);
}

/**
 * 通知訂閱者
 * @param {string} tag - 更新標籤
 */
function notifySubscribers(tag = UPDATE_TAGS.ALL) {
  subscribers.forEach(({ callback, tags }) => {
    // 如果訂閱者沒有指定標籤，或標籤匹配，則通知
    if (!tags || tags.has(UPDATE_TAGS.ALL) || tags.has(tag) || tag === UPDATE_TAGS.ALL) {
      callback(state, tag);
    }
  });
}

// Timer Actions
const TimerActions = {
  /**
   * 設定專注時長
   * @param {number} minutes
   */
  setFocusDuration(minutes) {
    setState(s => ({
      timer: {
        ...s.timer,
        focusDuration: minutes,
        remainingSeconds: minutes * 60
      }
    }), { tag: UPDATE_TAGS.TIMER });
  },

  /**
   * 開始專注
   */
  startFocus() {
    setState(s => ({
      timer: {
        ...s.timer,
        status: 'FOCUS_RUNNING',
        remainingSeconds: s.timer.focusDuration * 60,
        elapsedSeconds: 0,
        startTime: Date.now()
      }
    }), { tag: UPDATE_TAGS.TIMER });
  },

  /**
   * 暫停專注
   */
  pauseFocus() {
    setState(s => ({
      timer: {
        ...s.timer,
        status: 'FOCUS_PAUSED'
      }
    }), { tag: UPDATE_TAGS.TIMER });
  },

  /**
   * 繼續專注
   */
  resumeFocus() {
    setState(s => ({
      timer: {
        ...s.timer,
        status: 'FOCUS_RUNNING'
      }
    }), { tag: UPDATE_TAGS.TIMER });
  },

  /**
   * 停止專注
   * @returns {boolean} 是否為有效專注
   */
  stopFocus() {
    const currentState = getState();
    const elapsed = currentState.timer.elapsedSeconds;
    const isValid = elapsed >= MIN_VALID_FOCUS_SECONDS;

    if (isValid) {
      // 記錄有效專注
      const newRecord = {
        id: generateId(),
        index: currentState.focusRecords.length + 1,
        duration: Math.floor(elapsed / 60),
        taskName: getTaskName(currentState.timer.currentTaskId, currentState.tasks),
        startTime: currentState.timer.startTime,
        endTime: Date.now()
      };

      const newFocusCount = currentState.timer.focusCount + 1;
      const breakDuration = newFocusCount % LONG_BREAK_INTERVAL === 0
        ? LONG_BREAK_MINUTES
        : SHORT_BREAK_MINUTES;

      setState(s => ({
        timer: {
          ...s.timer,
          status: 'BREAK_RUNNING',
          focusCount: newFocusCount,
          breakDuration,
          remainingSeconds: breakDuration * 60,
          elapsedSeconds: 0
        },
        focusRecords: [...s.focusRecords, newRecord]
      }), { tag: UPDATE_TAGS.TIMER });
    } else {
      // 無效專注，回到 IDLE
      setState(s => ({
        timer: {
          ...s.timer,
          status: 'IDLE',
          remainingSeconds: s.timer.focusDuration * 60,
          elapsedSeconds: 0,
          startTime: null
        }
      }), { tag: UPDATE_TAGS.TIMER });
    }

    return isValid;
  },

  /**
   * 完成專注（時間到）
   */
  completeFocus() {
    const currentState = getState();
    const newRecord = {
      id: generateId(),
      index: currentState.focusRecords.length + 1,
      duration: currentState.timer.focusDuration,
      taskName: getTaskName(currentState.timer.currentTaskId, currentState.tasks),
      startTime: currentState.timer.startTime,
      endTime: Date.now()
    };

    const newFocusCount = currentState.timer.focusCount + 1;
    const breakDuration = newFocusCount % LONG_BREAK_INTERVAL === 0
      ? LONG_BREAK_MINUTES
      : SHORT_BREAK_MINUTES;

    setState(s => ({
      timer: {
        ...s.timer,
        status: 'BREAK_RUNNING',
        focusCount: newFocusCount,
        breakDuration,
        remainingSeconds: breakDuration * 60,
        elapsedSeconds: 0
      },
      focusRecords: [...s.focusRecords, newRecord]
    }), { tag: UPDATE_TAGS.TIMER });
  },

  /**
   * 跳過緩衝
   */
  skipBreak() {
    setState(s => ({
      timer: {
        ...s.timer,
        status: 'IDLE',
        remainingSeconds: s.timer.focusDuration * 60,
        elapsedSeconds: 0
      }
    }), { tag: UPDATE_TAGS.TIMER });
  },

  /**
   * 暫停緩衝
   */
  pauseBreak() {
    setState(s => ({
      timer: {
        ...s.timer,
        status: 'BREAK_PAUSED'
      }
    }), { tag: UPDATE_TAGS.TIMER });
  },

  /**
   * 繼續緩衝
   */
  resumeBreak() {
    setState(s => ({
      timer: {
        ...s.timer,
        status: 'BREAK_RUNNING'
      }
    }), { tag: UPDATE_TAGS.TIMER });
  },

  /**
   * 完成緩衝（時間到）
   */
  completeBreak() {
    setState(s => ({
      timer: {
        ...s.timer,
        status: 'IDLE',
        remainingSeconds: s.timer.focusDuration * 60,
        elapsedSeconds: 0
      }
    }), { tag: UPDATE_TAGS.TIMER });
  },

  /**
   * 更新計時器（每秒調用）
   * @deprecated 使用 setStateQuiet 直接更新，不再需要此方法
   */
  tick() {
    setState(s => {
      const remaining = s.timer.remainingSeconds - 1;
      const elapsed = s.timer.elapsedSeconds + 1;
      return {
        timer: {
          ...s.timer,
          remainingSeconds: remaining,
          elapsedSeconds: elapsed
        }
      };
    }, { tag: UPDATE_TAGS.TIMER_TICK, skipSave: true });
  },

  /**
   * 設定當前任務
   * @param {string|null} taskId
   */
  setCurrentTask(taskId) {
    setState(s => ({
      timer: {
        ...s.timer,
        currentTaskId: taskId
      }
    }), { tag: UPDATE_TAGS.TIMER });
  }
};

// Top3 Actions
const Top3Actions = {
  /**
   * 更新優先事項文字
   * @param {number} index - 0, 1, 2
   * @param {string} text
   */
  updateText(index, text) {
    setState(s => {
      const items = [...s.top3.items];
      items[index] = { ...items[index], text };
      return { top3: { items } };
    }, { tag: UPDATE_TAGS.TOP3 });
  },

  /**
   * 切換完成狀態
   * @param {number} index
   */
  toggleComplete(index) {
    setState(s => {
      const items = [...s.top3.items];
      items[index] = { ...items[index], completed: !items[index].completed };
      return { top3: { items } };
    }, { tag: UPDATE_TAGS.TOP3 });
  }
};

// Task Actions
const TaskActions = {
  /**
   * 新增任務
   * @returns {string} 新任務 ID
   */
  addTask() {
    const id = generateId();
    const newTask = {
      id,
      name: '',
      description: '',
      steps: [
        { id: `${id}-1`, text: '', completed: false },
        { id: `${id}-2`, text: '', completed: false },
        { id: `${id}-3`, text: '', completed: false }
      ],
      completed: false,
      createdAt: Date.now(),
      completedAt: null
    };

    setState(s => ({
      tasks: [...s.tasks, newTask]
    }), { tag: UPDATE_TAGS.TASK });

    return id;
  },

  /**
   * 更新任務
   * @param {string} taskId
   * @param {Object} updates
   */
  updateTask(taskId, updates) {
    setState(s => ({
      tasks: s.tasks.map(t =>
        t.id === taskId ? { ...t, ...updates } : t
      )
    }), { tag: UPDATE_TAGS.TASK });
  },

  /**
   * 刪除任務
   * @param {string} taskId
   */
  deleteTask(taskId) {
    setState(s => ({
      tasks: s.tasks.filter(t => t.id !== taskId)
    }), { tag: UPDATE_TAGS.TASK });
  },

  /**
   * 完成任務
   * @param {string} taskId
   */
  completeTask(taskId) {
    setState(s => ({
      tasks: s.tasks.map(t =>
        t.id === taskId ? { ...t, completed: true, completedAt: Date.now() } : t
      )
    }), { tag: UPDATE_TAGS.TASK });
  },

  /**
   * 切換步驟完成狀態
   * @param {string} taskId
   * @param {number} stepIndex
   */
  toggleStep(taskId, stepIndex) {
    setState(s => ({
      tasks: s.tasks.map(t => {
        if (t.id !== taskId) return t;
        const steps = [...t.steps];
        steps[stepIndex] = { ...steps[stepIndex], completed: !steps[stepIndex].completed };
        return { ...t, steps };
      })
    }), { tag: UPDATE_TAGS.TASK });
  },

  /**
   * 更新步驟文字
   * @param {string} taskId
   * @param {number} stepIndex
   * @param {string} text
   */
  updateStep(taskId, stepIndex, text) {
    setState(s => ({
      tasks: s.tasks.map(t => {
        if (t.id !== taskId) return t;
        const steps = [...t.steps];
        steps[stepIndex] = { ...steps[stepIndex], text };
        return { ...t, steps };
      })
    }), { tag: UPDATE_TAGS.TASK });
  }
};

// Record Actions
const RecordActions = {
  /**
   * 更新紀錄
   * @param {string} recordId
   * @param {Object} updates
   */
  updateRecord(recordId, updates) {
    setState(s => ({
      focusRecords: s.focusRecords.map(r =>
        r.id === recordId ? { ...r, ...updates } : r
      )
    }), { tag: UPDATE_TAGS.RECORD });
  }
};

// Settings Actions
const SettingsActions = {
  /**
   * 切換音效
   */
  toggleSound() {
    setState(s => ({
      settings: {
        ...s.settings,
        soundEnabled: !s.settings.soundEnabled
      }
    }), { tag: UPDATE_TAGS.SETTINGS });
  },

  /**
   * 設定音量
   * @param {number} volume
   */
  setVolume(volume) {
    setState(s => ({
      settings: {
        ...s.settings,
        soundVolume: volume
      }
    }), { tag: UPDATE_TAGS.SETTINGS });
  }
};

/**
 * 獲取任務名稱
 * @param {string|null} taskId
 * @param {Array} tasks
 * @returns {string}
 */
function getTaskName(taskId, tasks) {
  if (!taskId) return '自由專注';
  const task = tasks.find(t => t.id === taskId);
  return task?.name || '自由專注';
}

export const Store = {
  init,
  getState,
  setState,
  setStateQuiet,
  subscribe,
  UPDATE_TAGS,
  TimerActions,
  Top3Actions,
  TaskActions,
  RecordActions,
  SettingsActions
};
