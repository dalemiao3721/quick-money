# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # 啟動開發伺服器 (localhost:3000)，PWA 在 dev 模式下停用
npm run build    # 生產建置
npm run lint     # ESLint 檢查
npx tsc --noEmit # TypeScript 型別檢查（無測試框架，用此驗證正確性）
```

部署走 Vercel + GitHub 自動整合：push to `main` 即觸發正式環境部署。

## Architecture

這是一個**單頁 PWA 個人記帳 App**，所有 UI 邏輯集中在一個大型元件 `src/app/page.tsx`（約 2600 行）。刻意不拆分元件——所有 state 共用，避免 prop drilling。

### 資料流

所有資料存在 **localStorage**，無後端 API（除了 Auth）。

- Key 格式：`qm_${userId}_${dataType}`（多使用者命名空間）
- `transactions_v3`：交易紀錄陣列
- `categories`：收支類別
- `accounts`：帳戶（含 `initialBalance` 欄位）
- `recurring`：定期收支範本

**帳戶餘額**不直接儲存當前餘額，而是由 `computedBalances` useMemo 從 `initialBalance + 所有交易` 動態計算，避免狀態不一致。

### 定期收支運作機制

`RecurringTemplate` 存放範本（金額、頻率、執行日）。`useEffect([isMounted, recurringTemplates])` 在 App 開啟時自動計算從 `lastGenerated + 1` 到今天的漏掉日期，批次生成 `[定期] <label>` 交易。生成後更新 `lastGenerated = 今天`，防止重複。

**重要**：編輯範本金額時，必須同步更新今日已生成的交易（因 `lastGenerated` 已是今天，自動生成不會再跑）。

### 認證流程（AppShell）

`src/app/components/AppShell.tsx` 包裹整個 App，控制三段式登入流程：

1. **Email 登入**（EmailLogin.tsx）— 輸入 email，產生 userId（email hash）
2. **PIN 鎖定**（PinLock.tsx）— 4 位數 PIN，存在 localStorage `qm_pin_${userId}`
3. **主畫面**

Session 存在 `sessionStorage`（`qm_session`），閒置 5 分鐘自動重鎖回 PIN 畫面。
`getCurrentUserId()` 是從 AppShell export 的同步函式，page.tsx 用 `require()` 動態引入（避免 SSR 問題）。

Auth.js（next-auth v5 beta）只用於 OAuth 框架，實際未整合第三方 OAuth provider。

### 備份/還原

`src/app/hooks/useBackup.ts` 封裝 File System Access API：
- Chrome/Edge：使用 `showDirectoryPicker` 選擇資料夾，句柄存 IndexedDB（跨 session 保留）
- Safari：fallback 為下載 JSON 檔

備份格式：`quick-money-backup-YYYYMMDD-HHmm.json`（version 3 schema）

### 型別定義

`src/app/types.ts` 定義所有核心型別：`Transaction`、`Category`、`Account`、`RecurringTemplate`，以及初始預設資料（`INITIAL_ACCOUNTS`、`INITIAL_EXPENSE_CATEGORIES`、`INITIAL_INCOME_CATEGORIES`）。

### PWA 設定

`next-pwa` 在 production build 自動產生 Service Worker。`next.config` 使用 `output: 'standalone'` + Turbopack。

## 關鍵設計決策

- **Chart.js options 定義在元件外** — 確保 reference 穩定，防止 chart 每次 render 重繪
- **`computedBalances`** 用 `useMemo` 計算，不直接 mutate account.balance
- **定期收支防重複**：靠 `${note}__${date}` 組合 key 去重，而非 transaction id
- **`|| 0` 陷阱**：amount input 的 `parseInt(e.target.value) || 0` 在中間狀態可能產生 0，驗證用 `(amount ?? 0) > 0` 而非 `!amount`
