/**
 * FlowDashboard - Audio Service
 * 音效服務
 */

// 使用 Web Audio API 生成簡單的音效
let audioContext = null;
let isEnabled = true;
let volume = 0.5;

/**
 * 初始化音效系統
 */
function init() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
}

/**
 * 播放音調
 * @param {number} frequency - 頻率
 * @param {number} duration - 持續時間（秒）
 * @param {string} type - 波形類型
 */
function playTone(frequency, duration, type = 'sine') {
  if (!isEnabled || !audioContext) return;

  // Resume context if suspended (browser autoplay policy)
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.value = frequency;
  oscillator.type = type;

  // Envelope for natural sound
  const now = audioContext.currentTime;
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(volume * 0.3, now + 0.05);
  gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

  oscillator.start(now);
  oscillator.stop(now + duration);
}

/**
 * 播放專注結束音效（柔和鈴聲 - 如風鈴）
 */
function playFocusEnd() {
  if (!isEnabled) return;
  init();

  // 風鈴般的和弦
  const frequencies = [523, 659, 784]; // C5, E5, G5
  frequencies.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 1.5, 'sine'), i * 150);
  });
}

/**
 * 播放緩衝結束音效（輕敲提示 - 如木魚）
 */
function playBreakEnd() {
  if (!isEnabled) return;
  init();

  // 木魚般的敲擊聲
  playTone(220, 0.3, 'triangle');
  setTimeout(() => playTone(220, 0.2, 'triangle'), 200);
}

/**
 * 播放任務完成音效
 */
function playTaskComplete() {
  if (!isEnabled) return;
  init();

  // 簡單的確認音
  playTone(440, 0.15, 'sine');
  setTimeout(() => playTone(554, 0.2, 'sine'), 100);
}

/**
 * 設定音量
 * @param {number} vol - 0 到 1
 */
function setVolume(vol) {
  volume = Math.max(0, Math.min(1, vol));
}

/**
 * 設定啟用狀態
 * @param {boolean} enabled
 */
function setEnabled(enabled) {
  isEnabled = enabled;
}

/**
 * 獲取啟用狀態
 * @returns {boolean}
 */
function getEnabled() {
  return isEnabled;
}

/**
 * 切換啟用狀態
 * @returns {boolean} 新的狀態
 */
function toggle() {
  isEnabled = !isEnabled;
  return isEnabled;
}

export const AudioService = {
  init,
  playFocusEnd,
  playBreakEnd,
  playTaskComplete,
  setVolume,
  setEnabled,
  getEnabled,
  toggle
};
