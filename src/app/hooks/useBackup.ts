/**
 * useBackup.ts
 * 使用 File System Access API 實作「指定資料夾備份/還原」
 * - 資料夾句柄存於 IndexedDB（跨 session 保留）
 * - 備份格式：quick-money-backup-YYYYMMDD-HHmm.json
 * - 支援 Chrome/Edge；Safari 目前不支援 showDirectoryPicker，會 fallback 到下載模式
 */

const DB_NAME = "qm_backup_db";
const DB_VERSION = 1;
const STORE_NAME = "handles";
const HANDLE_KEY = "backupDir";

// ── IndexedDB helpers ──────────────────────────────────────────────
function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function saveHandle(handle: FileSystemDirectoryHandle) {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function loadHandle(): Promise<FileSystemDirectoryHandle | null> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
            req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) ?? null);
            req.onerror = () => reject(req.error);
        });
    } catch {
        return null;
    }
}

async function clearHandle() {
    const db = await openDB();
    return new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(HANDLE_KEY);
        tx.oncomplete = () => resolve();
    });
}

// ── 驗證已存的 handle 是否仍有讀寫權限 ──────────────────────────────
async function verifyPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
    try {
        const perm = await (handle as any).requestPermission({ mode: "readwrite" });
        return perm === "granted";
    } catch {
        return false;
    }
}

// ── 是否支援 File System Access API ──────────────────────────────────
export function isFileSystemAccessSupported(): boolean {
    return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

// ── 主要 API ─────────────────────────────────────────────────────────

/** 讓使用者選擇備份資料夾，儲存句柄到 IndexedDB */
export async function pickBackupFolder(): Promise<{ name: string } | null> {
    if (!isFileSystemAccessSupported()) {
        throw new Error("NOT_SUPPORTED");
    }
    const handle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
    await saveHandle(handle);
    return { name: handle.name };
}

/** 讀取已儲存的備份資料夾名稱（不請求權限，只讀 IndexedDB）*/
export async function getSavedFolderName(): Promise<string | null> {
    const handle = await loadHandle();
    return handle ? handle.name : null;
}

/** 清除已儲存的備份資料夾 */
export async function clearBackupFolder(): Promise<void> {
    await clearHandle();
}

/** 將資料備份到指定資料夾；如資料夾已移除則拋出錯誤 */
export async function backupToFolder(data: object): Promise<string> {
    const handle = await loadHandle();
    if (!handle) throw new Error("NO_FOLDER");

    const ok = await verifyPermission(handle);
    if (!ok) throw new Error("PERMISSION_DENIED");

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const filename = `quick-money-backup-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;

    const fileHandle = await handle.getFileHandle(filename, { create: true });
    const writable = await (fileHandle as any).createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();

    return filename;
}

/** 列出資料夾內所有備份檔案（依名稱倒序） */
export async function listBackupFiles(): Promise<string[]> {
    const handle = await loadHandle();
    if (!handle) throw new Error("NO_FOLDER");

    const ok = await verifyPermission(handle);
    if (!ok) throw new Error("PERMISSION_DENIED");

    const files: string[] = [];
    for await (const [name] of (handle as any).entries()) {
        if (name.startsWith("quick-money-backup-") && name.endsWith(".json")) {
            files.push(name);
        }
    }
    return files.sort((a, b) => b.localeCompare(a)); // 最新在前
}

/** 從資料夾讀取指定備份檔案並回傳解析後的物件 */
export async function readBackupFile(filename: string): Promise<any> {
    const handle = await loadHandle();
    if (!handle) throw new Error("NO_FOLDER");

    const ok = await verifyPermission(handle);
    if (!ok) throw new Error("PERMISSION_DENIED");

    const fileHandle = await handle.getFileHandle(filename);
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text);
}

/** Fallback：直接下載 JSON 檔（Safari 等不支援 API 的瀏覽器） */
export function downloadBackupFallback(data: object): void {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const filename = `quick-money-backup-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
