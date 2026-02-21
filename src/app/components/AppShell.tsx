"use client";

import { useState, useEffect } from "react";
import PinLock from "./PinLock";

interface AppShellProps {
    children: React.ReactNode;
}

// 閒置超過此毫秒後重新鎖定（5分鐘）
const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

// 對外暴露「觸發改密碼」的 setter（供 page.tsx 設定頁呼叫）
let _triggerChangePinFn: (() => void) | null = null;
export function triggerChangePin() {
    _triggerChangePinFn?.();
}

export default function AppShell({ children }: AppShellProps) {
    const [isLocked, setIsLocked] = useState(true);
    const [showChangePinMode, setShowChangePinMode] = useState(false);
    const [lastActivity, setLastActivity] = useState(Date.now());

    // 掛載後解鎖回調
    _triggerChangePinFn = () => setShowChangePinMode(true);

    useEffect(() => {
        // 同一分頁內若已解鎖過，直接顯示（避免切頁重鎖）
        const unlocked = sessionStorage.getItem("qm_unlocked");
        if (unlocked === "1") setIsLocked(false);
    }, []);

    // 閒置重鎖計時器
    useEffect(() => {
        if (isLocked) return;
        const resetTimer = () => setLastActivity(Date.now());
        window.addEventListener("touchstart", resetTimer);
        window.addEventListener("click", resetTimer);
        window.addEventListener("keydown", resetTimer);

        const interval = setInterval(() => {
            if (Date.now() - lastActivity > LOCK_TIMEOUT_MS) {
                setIsLocked(true);
                sessionStorage.removeItem("qm_unlocked");
            }
        }, 30_000);

        return () => {
            window.removeEventListener("touchstart", resetTimer);
            window.removeEventListener("click", resetTimer);
            window.removeEventListener("keydown", resetTimer);
            clearInterval(interval);
        };
    }, [isLocked, lastActivity]);

    const handleUnlock = () => {
        setIsLocked(false);
        sessionStorage.setItem("qm_unlocked", "1");
    };

    const handleChangeDone = () => {
        setShowChangePinMode(false);
    };

    return (
        <>
            {/* 解鎖鎖定畫面 */}
            {isLocked && (
                <PinLock onUnlock={handleUnlock} mode="unlock" />
            )}

            {/* 修改密碼畫面（疊加在主內容上） */}
            {!isLocked && showChangePinMode && (
                <PinLock mode="change" onChangeDone={handleChangeDone} onUnlock={handleUnlock} />
            )}

            {/* 主內容 */}
            <div style={{ visibility: isLocked ? "hidden" : "visible" }}>
                {children}
            </div>
        </>
    );
}
