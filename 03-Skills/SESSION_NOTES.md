# Session Notes

---

## 2026-04-24
**專案：** 03-Skills（個人 Claude Code Skills 庫建置）

### ✅ 本次完成
- 建立完整 skills 庫架構（`000-global-skills` 到 `011-session-save`）
- 合併 `003-infra-memory` 進 `001-deploy-docs`（伺服器基礎設施參考區塊）
- 移除 `infra-memory` symlink，保留 `source.md` 原始資料
- 所有 README 統一格式（是什麼 + 怎麼用）
- 建立三個新自製 skill：`008-new-project`、`009-debug-log`、`010-pr-review`
- 建立 `011-session-save`（本 skill）
- 從 skills.sh 安裝 7 個外部 skill：`skill-creator`、`frontend-design`、`webapp-testing`、`mcp-builder`、`react-best-practices`、`web-design-guidelines`、`composition-patterns`
- 建立 `000-global-skills/README.md`，含每個 skill 的說明、怎麼用、下載網址
- 加入換電腦一鍵重裝腳本

### 🔄 未完成 / 進行中
- 無明確未完成項目

### 💡 重要決策 / 發現
- Skills 架構：`03-Skills/00N-xxx/` 為 source，`~/.claude/skills/` 用 symlink 安裝（自製）；外部 skill 直接裝在 `~/.claude/skills/` 不用 symlink
- `npx skillsadd` 已失效，改用 `curl` 從 raw GitHub URL 手動安裝
- `003-infra-memory` 不再是獨立 skill，SKILL.md 改名為 `.archived`
- gstack 生態系 skill 是內建的，不需要安裝

### 🚀 下次起點
Skills 庫已完整。可用 `/skill-creator` 測試現有 skill 的觸發準確度，或繼續在實際專案中使用這些 skills。
若要新增 skill，在 `03-Skills/` 建立下一個編號資料夾（`012-xxx`），建 `SKILL.md` + `README.md` 後 symlink 到 `~/.claude/skills/`。

### 📁 相關檔案
- `03-Skills/000-global-skills/README.md` — 所有外部 skill 說明 + 下載網址 + 換電腦腳本
- `03-Skills/001-deploy-docs/SKILL.md` — 含伺服器基礎設施參考（合併自 infra-memory）
- `03-Skills/003-infra-memory/SKILL.md.archived` — 已合併，保留備查
- `03-Skills/008-new-project/` — 新專案初始化 SOP
- `03-Skills/009-debug-log/` — 伺服器錯誤排查
- `03-Skills/010-pr-review/` — Commit 前 code review
- `03-Skills/011-session-save/` — 本 skill
- `~/.claude/skills/` — 所有已安裝的 skill symlink / 資料夾
