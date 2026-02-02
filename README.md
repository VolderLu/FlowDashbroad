# 心流儀表板 FlowDashboard

> 一個採用 Wabi-Sabi（侘寂）美學設計的番茄鐘心流輔助工具

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)

## 概述

FlowDashboard 是一個靜態網頁應用，旨在協助使用者進入並維持心流狀態。不同於傳統的待辦工具追求「完成率」，FlowDashboard 專注於**降低進入專注的摩擦成本**。

### 設計哲學

採用日本 **Wabi-Sabi（侘寂）** 美學：

- **簡樸優於華麗** — 極簡介面，無多餘裝飾
- **自然優於人工** — 大地色調、有機形狀、柔和光線
- **寧靜優於刺激** — 低對比、慢動畫、無閃爍
- **空間優於填滿** — 足夠的留白讓視覺呼吸

### 產品原則

- 系統不評價使用者
- 系統不強迫回顧
- 系統不製造焦慮
- 系統的存在，是為了讓「專注本身變安靜」

## 功能特色

### 番茄鐘

- 可調整專注時長（5-60 分鐘）
- 5 種狀態切換：靜待、沉浸、小憩、呼吸、駐足
- 每 3 次專注自動進入 15 分鐘長休息
- 有效專注門檻：>= 5 分鐘才記錄
- **Web Worker 計時**：解決瀏覽器標籤頁節流問題，確保計時精準

### 三大優先

- 今日方向提醒
- 純視覺提示，不與其他功能連動

### 任務流程表

- 無上限任務數量
- 每個任務可拆解為 1-3 個步驟
- 專注中可指定當前任務
- 完成後自動淡化並移至底部

### 專注選擇功能

- IDLE 時可預選三大優先和/或任務
- 開始專注後，非選中項目自動隱藏
- 減少視覺干擾，專注於當前任務
- 暫停/停止/完成時恢復顯示全部

### 今日摘要

- 浮動按鈕顯示統計
- 專注次數、總時間、完成任務數
- 不顯示評價、比較或趨勢

### 主題切換

- **深色主題**（預設）：墨色背景、焦茶主色
- **暖色主題**：Morandi 色調、和紙暖白背景
- 右上角按鈕一鍵切換
- 設定自動儲存

### 通知與音效

- 桌面通知（專注/休息結束時）
- 標題閃爍 fallback（拒絕通知時）
- 自然音效：風鈴（專注結束）、木魚（休息結束）
- 可開關音效

### 資料儲存

- 使用 localStorage
- 跨日自動清空所有資料
- 不保留歷史紀錄

## 快速開始

### 方法一：直接開啟

1. 下載或 clone 此專案
2. 用瀏覽器開啟 `index.html`

```bash
git clone https://github.com/VolderLu/FlowDashbroad.git
cd FlowDashbroad
# 用瀏覽器開啟 index.html
```

### 方法二：本地伺服器

```bash
# 使用 Python
python -m http.server 8080

# 或使用 Node.js
npx serve
```

然後訪問 `http://localhost:8080`

## 系統需求

- 桌面瀏覽器（Chrome、Firefox、Edge、Safari）
- 螢幕寬度 >= 1024px
- 不支援行動裝置

## 專案結構

```
FlowDashboard/
├── index.html              # 主頁面
├── styles/
│   ├── variables.css       # 設計變數（含深色/暖色主題）
│   ├── base.css            # 基礎樣式
│   ├── layout.css          # 版面佈局
│   ├── index.css           # 樣式入口
│   └── components/         # 元件樣式
├── scripts/
│   ├── app.js              # 應用程式入口
│   ├── state/store.js      # 狀態管理
│   ├── modules/            # UI 模組
│   │   └── timer.js        # 番茄鐘（Web Worker 計時）
│   ├── services/           # 服務層
│   │   └── theme.js        # 主題切換服務
│   ├── workers/            # Web Workers
│   │   └── timer-worker.js # 計時器 Worker
│   └── utils/              # 工具函數
└── assets/
    └── icons/favicon.svg   # 網站圖示
```

## 設計規格

### 深色主題（預設）

| 項目 | 規格 |
|------|------|
| 主色（專注） | `#8B7355` 焦茶色 |
| 副色（休息） | `#7D8471` 苔蘚綠 |
| 背景色 | `#1C1917` 墨色 |
| 文字色 | `#F5F0E8` 生成色（和紙白） |

### 暖色主題（Morandi + Wabi-Sabi）

| 項目 | 規格 |
|------|------|
| 主色（專注） | `#B5846B` 陶土赭石 |
| 副色（休息） | `#8A9A82` 霧灰苔蘚 |
| 背景色 | `#F5F0E8` 和紙暖白 |
| 文字色 | `#3D3632` 深褐色 |

### 字型與動畫

| 項目 | 規格 |
|------|------|
| 標題字型 | LXGW WenKai TC（霞鶩文楷） |
| 內文字型 | Zen Kaku Gothic New |
| 數字字型 | JetBrains Mono |
| 動畫時長 | 250-500ms |
| 緩動函數 | cubic-bezier(0.25, 0.1, 0.25, 1) |

## 瀏覽器支援

| 瀏覽器 | 版本 |
|--------|------|
| Chrome | 90+ |
| Firefox | 88+ |
| Edge | 90+ |
| Safari | 14+ |

## 授權

MIT License

## 致謝

- 設計靈感來自日本 Wabi-Sabi 美學
- 字型：[Google Fonts](https://fonts.google.com/)
