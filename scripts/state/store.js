/**
 * FlowDashboard - State Store
 * 簡易狀態管理
 */

import { StorageService } from '../services/storage.js';

// 訂閱者列表
const subscribers = new Set();

// 當前狀態
let state = null;

/**
 * 初始化 Store
 */
function init() {
  state = StorageService.checkDateAndReset();
  notifySubscribers();
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
 */
function setState(updater) {
  const newState = updater(state);
  state = { ...state, ...newState };
  StorageService.save(state);
  notifySubscribers();
}

/**
 * 訂閱狀態變化
 * @param {Function} callback
 * @returns {Function} 取消訂閱的函數
 */
function subscribe(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

/**
 * 通知所有訂閱者
 */
function notifySubscribers() {
  subscribers.forEach(callback => callback(state));
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
    }));
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
    }));
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
    }));
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
    }));
  },

  /**
   * 停止專注
   * @returns {boolean} 是否為有效專注
   */
  stopFocus() {
    const currentState = getState();
    const elapsed = currentState.timer.elapsedSeconds;
    const isValid = elapsed >= 5 * 60; // >= 5 分鐘

    if (isValid) {
      // 記錄有效專注
      const newRecord = {
        id: Date.now().toString(36),
        index: currentState.focusRecords.length + 1,
        duration: Math.floor(elapsed / 60),
        taskName: getTaskName(currentState.timer.currentTaskId, currentState.tasks),
        startTime: currentState.timer.startTime,
        endTime: Date.now()
      };

      const newFocusCount = currentState.timer.focusCount + 1;
      const breakDuration = newFocusCount % 3 === 0 ? 15 : 5;

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
      }));
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
      }));
    }

    return isValid;
  },

  /**
   * 完成專注（時間到）
   */
  completeFocus() {
    const currentState = getState();
    const newRecord = {
      id: Date.now().toString(36),
      index: currentState.focusRecords.length + 1,
      duration: currentState.timer.focusDuration,
      taskName: getTaskName(currentState.timer.currentTaskId, currentState.tasks),
      startTime: currentState.timer.startTime,
      endTime: Date.now()
    };

    const newFocusCount = currentState.timer.focusCount + 1;
    const breakDuration = newFocusCount % 3 === 0 ? 15 : 5;

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
    }));
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
    }));
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
    }));
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
    }));
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
    }));
  },

  /**
   * 更新計時器（每秒調用）
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
    });
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
    }));
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
    });
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
    });
  }
};

// Task Actions
const TaskActions = {
  /**
   * 新增任務
   * @returns {string} 新任務 ID
   */
  addTask() {
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    const newTask = {
      id,
      name: '',
      description: '',
      steps: [
        { id: id + '-1', text: '', completed: false },
        { id: id + '-2', text: '', completed: false },
        { id: id + '-3', text: '', completed: false }
      ],
      completed: false,
      createdAt: Date.now(),
      completedAt: null
    };

    setState(s => ({
      tasks: [...s.tasks, newTask]
    }));

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
    }));
  },

  /**
   * 刪除任務
   * @param {string} taskId
   */
  deleteTask(taskId) {
    setState(s => ({
      tasks: s.tasks.filter(t => t.id !== taskId)
    }));
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
    }));
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
    }));
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
    }));
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
    }));
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
    }));
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
    }));
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
  subscribe,
  TimerActions,
  Top3Actions,
  TaskActions,
  RecordActions,
  SettingsActions
};
