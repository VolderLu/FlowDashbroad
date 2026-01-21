/**
 * FlowDashboard - Theme Service
 * 主題切換服務（深色/暖色主題）
 */

const THEME_KEY = 'flowdashboard-theme';
const THEMES = {
  DARK: 'dark',
  WARM: 'warm'
};

let currentTheme = THEMES.DARK;

/**
 * 初始化主題服務
 */
export function initTheme() {
  // 從 localStorage 讀取儲存的主題
  const savedTheme = localStorage.getItem(THEME_KEY);

  if (savedTheme && Object.values(THEMES).includes(savedTheme)) {
    currentTheme = savedTheme;
    applyTheme(currentTheme);
  }

  // 綁定切換按鈕事件
  const toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleTheme);
  }
}

/**
 * 套用主題
 * @param {string} theme - 主題名稱
 */
function applyTheme(theme) {
  const root = document.documentElement;

  if (theme === THEMES.WARM) {
    root.setAttribute('data-theme', 'warm');
    // 更新 meta theme-color
    updateMetaThemeColor('#F5F0E8');
  } else {
    root.removeAttribute('data-theme');
    updateMetaThemeColor('#1C1917');
  }

  currentTheme = theme;
  localStorage.setItem(THEME_KEY, theme);
}

/**
 * 切換主題
 */
function toggleTheme() {
  const newTheme = currentTheme === THEMES.DARK ? THEMES.WARM : THEMES.DARK;
  applyTheme(newTheme);
}

/**
 * 更新 meta theme-color
 * @param {string} color - 顏色值
 */
function updateMetaThemeColor(color) {
  let meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', color);
  }
}

/**
 * 獲取當前主題
 * @returns {string}
 */
export function getCurrentTheme() {
  return currentTheme;
}

/**
 * 設定主題
 * @param {string} theme - 主題名稱 ('dark' | 'warm')
 */
export function setTheme(theme) {
  if (Object.values(THEMES).includes(theme)) {
    applyTheme(theme);
  }
}

export const ThemeService = {
  init: initTheme,
  getCurrentTheme,
  setTheme,
  THEMES
};
