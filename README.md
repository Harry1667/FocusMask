# FocusMask

Chrome 瀏覽器專注遮罩擴充程式 — 一鍵啟動黑色遮罩封鎖分心網站，讓你維持深度工作或睡前戒手機。

## 模式
| 模式 | 觸發方式 | 特色 |
|------|----------|------|
| 專注模式 | 手動點擊 | 可選填計時，時間到自動停止 |
| 睡眠模式 | 定時自動啟動 | 需輸入確認密碼才能手動關閉（防偷關）|
| 深度工作模式 | 手動 | 最嚴格，獨立白名單 |
| 番茄計時模式 | 手動 | 配合番茄工作法 |

每個模式有各自獨立的白名單設定。

## 技術棧
- Chrome Extension（Manifest V3）
- Vanilla JavaScript
- Background Service Worker + Content Script

## 安裝
1. 開啟 `chrome://extensions/`
2. 啟用「開發人員模式」
3. 點「載入未封裝項目」→ 選擇 `02-web/` 資料夾

---

## English

A Chrome focus-mask extension. One click drops a black overlay over distracting sites — useful for deep work, or for breaking the phone-before-bed habit.

### Modes
| Mode | Trigger | Notes |
|------|---------|-------|
| Focus | Manual | Optional timer, auto-stops when time's up |
| Sleep | Scheduled, auto-starts | Requires a confirmation password to disable (anti-cheat) |
| Deep work | Manual | Strictest; separate whitelist |
| Pomodoro | Manual | Pairs with the Pomodoro technique |

Each mode has its own independent whitelist.

### Tech stack
- Chrome Extension (Manifest V3)
- Vanilla JavaScript
- Background service worker + content script

### Install
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `02-web/` folder
