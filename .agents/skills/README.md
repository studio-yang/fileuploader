# FileUploader Skills

此目錄保留給 Codex/Agents 使用的專案 skills。

目前檢查結果：專案根目錄沒有 `.claude/skills/`，因此沒有可從 Claude 複製過來的 skill。若日後新增 Claude skill，請將功能無關、可重複使用的 skill 複製或改寫到本目錄。

轉換原則：

1. 不把系統密鑰、個人 token、連線字串寫入 skill。
2. Skill 只描述工作流程與判斷邏輯，不硬編碼一次性需求。
3. 需要專案背景時，從 `AGENTS.md`、`CLAUDE.md`、`docs/` 或相關程式碼動態讀取。
4. 與資安、登入、OTP、Redis、上傳、下載相關的 skill，要明確要求檢查 OWASP Top 10 風險。
