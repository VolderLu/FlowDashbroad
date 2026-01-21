/**
 * FlowDashboard - Notification Service
 * 通知服務
 */

let titleFlashInterval = null;
const originalTitle = document.title;

/**
 * 請求通知權限
 * @returns {Promise<boolean>}
 */
async function requestPermission() {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

/**
 * 檢查是否有通知權限
 * @returns {boolean}
 */
function hasPermission() {
  return 'Notification' in window && Notification.permission === 'granted';
}

/**
 * 發送通知
 * @param {string} title
 * @param {string} body
 */
function notify(title, body) {
  if (hasPermission()) {
    new Notification(title, {
      body,
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">◉</text></svg>',
      silent: true // We handle sound separately
    });
  } else {
    // Fallback to title flash
    startTitleFlash(body);
  }
}

/**
 * 開始標題閃爍
 * @param {string} message
 */
function startTitleFlash(message) {
  if (titleFlashInterval) {
    clearInterval(titleFlashInterval);
  }

  let isOriginal = true;
  titleFlashInterval = setInterval(() => {
    document.title = isOriginal ? `⏰ ${message}` : originalTitle;
    isOriginal = !isOriginal;
  }, 1000);

  // 當使用者回到頁面時停止
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      stopTitleFlash();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

/**
 * 停止標題閃爍
 */
function stopTitleFlash() {
  if (titleFlashInterval) {
    clearInterval(titleFlashInterval);
    titleFlashInterval = null;
    document.title = originalTitle;
  }
}

/**
 * 專注結束通知
 */
function notifyFocusEnd() {
  notify('心流', '專注結束，進入呼吸時間');
}

/**
 * 緩衝結束通知
 */
function notifyBreakEnd() {
  notify('心流', '呼吸結束，可開始下一輪');
}

export const NotificationService = {
  requestPermission,
  hasPermission,
  notify,
  startTitleFlash,
  stopTitleFlash,
  notifyFocusEnd,
  notifyBreakEnd
};
