"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import PinLock from "./PinLock";

interface AppShellProps {
    children: React.ReactNode;
}

// 背景不活躍超過此毫秒數後重新鎖定 (3分鐘)
const LOCK_TIMEOUT_MS = 3 * 60 * 1000;

export default function AppShell({ children }: AppShellProps) {
    const { data: session, status } = useSession();
    const [isLocked, setIsLocked] = useState(true);
    const [lastActivity, setLastActivity] = useState(Date.now());

    // 初次載入解鎖邏輯
    useEffect(() => {
        if (status === "authenticated") {
            const unlocked = sessionStorage.getItem("qm_session_unlocked");
            if (unlocked === "true") {
                setIsLocked(false);
            }
        } else if (status === "unauthenticated") {
            // 未登入時不鎖定，直接顯示主內容
            setIsLocked(false);
        }
    }, [status]);

    // 活動監聽：重設計時器
    useEffect(() => {
        if (isLocked || status !== "authenticated") return;

        const resetTimer = () => setLastActivity(Date.now());
        window.addEventListener("touchstart", resetTimer);
        window.addEventListener("click", resetTimer);
        window.addEventListener("keydown", resetTimer);

        const interval = setInterval(() => {
            if (Date.now() - lastActivity > LOCK_TIMEOUT_MS) {
                setIsLocked(true);
                sessionStorage.removeItem("qm_session_unlocked");
            }
        }, 30000);

        return () => {
            window.removeEventListener("touchstart", resetTimer);
            window.removeEventListener("click", resetTimer);
            window.removeEventListener("keydown", resetTimer);
            clearInterval(interval);
        };
    }, [isLocked, lastActivity, status]);

    const handleUnlock = () => {
        setIsLocked(false);
        sessionStorage.setItem("qm_session_unlocked", "true");
    };

    // 載入中（短暫顯示 spinner）
    if (status === "loading") {
        return (
            <div style={{
                minHeight: "100vh",
                background: "#f2f2f7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}>
                <div style={{
                    width: "32px", height: "32px",
                    border: "3px solid #e5e5ea",
                    borderTopColor: "#007aff",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    return (
        <>
            {/* PIN 鎖定畫面：僅在已登入且被鎖定時顯示 */}
            {status === "authenticated" && isLocked && (
                <PinLock
                    onUnlock={handleUnlock}
                    userImage={session?.user?.image ?? undefined}
                    userName={session?.user?.name ?? undefined}
                />
            )}

            <div style={{ visibility: (status === "authenticated" && isLocked) ? "hidden" : "visible" }}>
                {/* 右上角使用者選單（僅已登入時出現） */}
                {status === "authenticated" && (
                    <div style={{
                        position: "fixed",
                        top: "12px",
                        right: "12px",
                        zIndex: 1000,
                    }}>
                        <details style={{ position: "relative" }}>
                            <summary style={{
                                listStyle: "none",
                                cursor: "pointer",
                                width: "36px",
                                height: "36px",
                                borderRadius: "50%",
                                overflow: "hidden",
                                border: "2px solid rgba(0,0,0,0.1)",
                            }}>
                                {session?.user?.image ? (
                                    <img src={session.user.image} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                ) : (
                                    <div style={{ width: "100%", height: "100%", background: "#007aff", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "1rem" }}>
                                        {session?.user?.name?.[0] ?? "U"}
                                    </div>
                                )}
                            </summary>
                            <div style={{
                                position: "absolute",
                                top: "44px",
                                right: 0,
                                background: "white",
                                borderRadius: "16px",
                                padding: "8px",
                                minWidth: "160px",
                                boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
                                border: "1px solid #f2f2f7",
                            }}>
                                <p style={{ padding: "8px 12px", fontSize: "0.85rem", color: "#8e8e93", borderBottom: "1px solid #f2f2f7", marginBottom: "4px" }}>
                                    {session?.user?.name}
                                </p>
                                <button
                                    onClick={() => { setIsLocked(true); sessionStorage.removeItem("qm_session_unlocked"); }}
                                    style={{ width: "100%", textAlign: "left", padding: "8px 12px", border: "none", background: "none", fontSize: "0.9rem", cursor: "pointer", borderRadius: "10px", color: "#1c1c1e" }}
                                >
                                    🔒 鎖定螢幕
                                </button>
                                <button
                                    onClick={() => signOut({ callbackUrl: "/" })}
                                    style={{ width: "100%", textAlign: "left", padding: "8px 12px", border: "none", background: "none", fontSize: "0.9rem", cursor: "pointer", borderRadius: "10px", color: "#ff453a" }}
                                >
                                    🚪 登出
                                </button>
                            </div>
                        </details>
                    </div>
                )}
                {children}
            </div>
        </>
    );
}
