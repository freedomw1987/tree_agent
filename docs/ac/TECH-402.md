# AC — TECH-402

- US: TECH-402
- 類型: TECH ｜ 階段: 技術債 ｜ 優先級: P2 ｜ Story Point: 5
- 驗收方式: 跑 `REGRESSION_MODULE=M00 ./run_pipeline.sh TECH-402`

## Given-When-Then

- **AC-1**: Given Pi SDK session 由 file-backed SessionManager 持久化 When sidecar 重啟 Then session 可續（唔由零開始）
- **AC-2**: Given Pi SDK 版本升級 When 跑回歸 Then session 格式相容，唔會讀唔到舊 session

## Definition of Done（技術視角）

- [ ] 探針 `TECH-402-session-persist-restore` 必通過
- [ ] 探針 `TECH-402-sdk-version-pin` 必通過（版本 pin 喺 lockfile）

## 實測結論

session 持久化已做：Pi SDK `SessionManager.create(cwd)`（file-backed，存喺 Mac 本地）＋ `SessionManager.list()`（session 切換 UI）＋ `SessionManager.open(path)`（fork／續接）。transcript 對齊用 DynamoDB（cursor 必須包 role：ts#requestId#role —— 同一毫秒內 user+agent 會撞 key，實測踩過）。Pi SDK 版本釘死 1.4.0。**未做**：Pi SDK 大版本升級嘅相容性測試（等有新版本先做）

## 業務規則

session 存 Mac 本地；跨端只看 transcript；Pi SDK 版本升級必須過回歸先可以升

## 依賴

M00-US-103

> 對應 Backlog: `docs/backlog.md` ｜ 需求錨點: `docs/req/TECH-402-requirement.md`
> 本檔由 dav-planner Step 4 生成（2026-11-01）；之後以本檔為準，唔好重跑生成器覆蓋。
