/**
 * FlowDashboard - Main Application
 * 主程式入口
 */

import { Store } from './state/store.js';
import { initTimer } from './modules/timer.js';
import { initTasks } from './modules/tasks.js';
import { initTop3 } from './modules/top3.js';
import { initSummary } from './modules/summary.js';
import { NotificationService } from './services/notification.js';
import { AudioService } from './services/audio.js';
import { ThemeService } from './services/theme.js';

/**
 * 初始化應用程式
 */
async function init() {
  console.log('FlowDashboard initializing...');

  // 初始化 Store
  Store.init();

  // 初始化音效服務
  AudioService.init();

  // 根據儲存的設定初始化音效狀態
  const state = Store.getState();
  AudioService.setEnabled(state.settings.soundEnabled);
  AudioService.setVolume(state.settings.soundVolume);

  // 請求通知權限
  await NotificationService.requestPermission();

  // 初始化主題服務（優先載入，避免閃爍）
  ThemeService.init();

  // 初始化各模組
  initTimer();
  initTasks();
  initTop3();
  initSummary();

  // 初始化音效切換按鈕
  initSoundToggle();

  console.log('FlowDashboard ready.');
}

/**
 * 初始化音效切換按鈕
 */
function initSoundToggle() {
  const soundToggle = document.getElementById('sound-toggle');

  // 更新圖示
  function updateIcon() {
    const state = Store.getState();
    const isEnabled = state.settings.soundEnabled;

    soundToggle.innerHTML = isEnabled
      ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
        </svg>`
      : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <line x1="23" y1="9" x2="17" y2="15"></line>
          <line x1="17" y1="9" x2="23" y2="15"></line>
        </svg>`;

    soundToggle.setAttribute('aria-label', isEnabled ? '關閉音效' : '開啟音效');
  }

  // 點擊切換
  soundToggle.addEventListener('click', () => {
    Store.SettingsActions.toggleSound();
    const state = Store.getState();
    AudioService.setEnabled(state.settings.soundEnabled);
    updateIcon();
  });

  // 初始更新
  updateIcon();

  // 訂閱狀態變化
  Store.subscribe(() => updateIcon());
}

// 頁面載入後初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
