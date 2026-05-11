# hdw-proxycli

**指令：** `/hdw-proxycli`

## 是什麼

管理部署在 NAS 上的 AI Proxy CLI 服務（proxy-cli）。
這個服務把 Claude / Gemini / OpenAI / DeepSeek 等多個 AI provider 包成一個 gRPC API，
讓你用單一端點呼叫任何 AI，自動 fallback。

關鍵資訊：
- Dashboard：`clip.twloop.com`
- gRPC：`cli.twloop.com:443`
- NAS IP：`192.168.0.126`（SSH port 33333）
- Fallback chain：claude → openai → deepseek → groq → mistral → gemini

## 怎麼用

在 Claude Code 輸入 `/hdw-proxycli`，說明你要做什麼：

| 情況 | 說法 |
|---|---|
| 確認服務是否正常 | 「proxycli 狀態」 |
| Claude token 過期 | 「重新登入 Claude」 |
| 推送更新到 NAS | 「更新 proxycli」 |
| API 端點查詢 | 「/api/health 怎麼打」 |

> ⚠️ ToS 注意：多 slot 輪替、偽造 OAuth token 已於 2026-04-19 移除，不可重新加回。
