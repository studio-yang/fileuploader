# FileUploader Codex Agents

此目錄保留給 Codex agents，格式為 `.toml`。

目前檢查結果：專案根目錄沒有 `.claude/agents/*.md`，因此沒有可轉換成 `.codex/agents/*.toml` 的 Claude agent。

若日後新增 Claude agent，請轉成以下概念：

```toml
name = "example-agent"
description = "說明此 agent 的單一職責"
developer_instructions = """
以繁體中文回覆。
只處理明確指定的職責範圍。
需要專案知識時，先讀 AGENTS.md 與 CLAUDE.md。
不要輸出或保存任何密鑰。
"""
```

轉換原則：

1. Claude agent 的主要指令放入 `developer_instructions`。
2. 每個 agent 維持單一職責，不混合開發、資安、文件與部署。
3. 不把 `.env.local`、token、API key、OAuth credentials 寫入 agent。
4. 指令要保留 FileUploader 的技術棧與資安要求，但不要硬編碼一次性任務。
