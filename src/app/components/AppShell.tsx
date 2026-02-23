"use client";

import { useState, useEffect } from "react";
import EmailLogin, { UserProfile, getUserColor } from "./EmailLogin";
import PinLock from "./PinLock";

interface AppShellProps {
    children: React.ReactNode;
}

const LOCK_TIMEOUT_MS = 5 * 60 * 1000;
const SESSION_KEY = "qm_session"; // sessionStorage: {userId, name, email}

let _triggerChangePinFn: (() => void) | null = null;
export function triggerChangePin() { _triggerChangePinFn?.(); }

// 讓 page.tsx 能讀取目前使用者 ID（命名空間資料用）
export function getCurrentUserId(): string {
    if (typeof window === "undefined") return "default";
    try {
        const s = sessionStorage.getItem(SESSION_KEY);
        return s ? JSON.parse(s).userId : "default";
    } catch { return "default"; }
}

type AppStage = 'loading' | 'email' | 'pin' | 'app';

export default function AppShell({ children }: AppShellProps) {
    const [stage, setStage] = useState<AppStage>('loading');
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
    const [showChangePinMode, setShowChangePinMode] = useState(false);
    const [lastActivity, setLastActivity] = useState(Date.now());

    _triggerChangePinFn = () => setShowChangePinMode(true);

    // 初始化：從 sessionStorage 恢復會話
    useEffect(() => {
        try {
            const raw = sessionStorage.getItem(SESSION_KEY);
            if (raw) {
                const { user, unlocked } = JSON.parse(raw);
                if (user && unlocked) {
                    setCurrentUser(user);
                    setStage('app');
                    return;
                }
            }
        } catch { }
        // 沒有有效 session → 顯示 email 登入
        setStage('email');
    }, []);

    // 閒置自動重鎖
    useEffect(() => {
        if (stage !== 'app') return;
        const resetTimer = () => setLastActivity(Date.now());
        window.addEventListener("touchstart", resetTimer);
        window.addEventListener("click", resetTimer);
        window.addEventListener("keydown", resetTimer);

        const interval = setInterval(() => {
            if (Date.now() - lastActivity > LOCK_TIMEOUT_MS) {
                // 重鎖：回到 PIN 畫面（不需再輸入 email）
                sessionStorage.setItem(SESSION_KEY, JSON.stringify({ user: currentUser, unlocked: false }));
                setStage('pin');
            }
        }, 30_000);

        return () => {
            window.removeEventListener("touchstart", resetTimer);
            window.removeEventListener("click", resetTimer);
            window.removeEventListener("keydown", resetTimer);
            clearInterval(interval);
        };
    }, [stage, lastActivity, currentUser]);

    // Email 登入成功 → 進入 PIN 畫面
    const handleEmailLogin = (user: UserProfile) => {
        setCurrentUser(user);
        // 記住使用者但尚未解鎖
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ user, unlocked: false }));
        setStage('pin');
    };

    // PIN 解鎖成功
    const handlePinUnlock = () => {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ user: currentUser, unlocked: true }));
        setLastActivity(Date.now());
        setStage('app');
    };

    // 改密碼完成
    const handleChangePinDone = () => setShowChangePinMode(false);

    // 切換帳號
    const handleSwitchAccount = () => {
        sessionStorage.removeItem(SESSION_KEY);
        setCurrentUser(null);
        setStage('email');
        setShowChangePinMode(false);
    };

    // ── Render ──
    if (stage === 'loading') {
        return (
            <div style={{
                position: "fixed", inset: 0,
                background: "#1c1c1e",
                display: "flex", alignItems: "center", justifyContent: "center",
            }}>
                <div style={{
                    width: "72px", height: "72px",
                    background: "linear-gradient(135deg, #ff9500, #ff2d55)",
                    borderRadius: "20px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "2rem",
                    animation: "pulse 1.2s ease infinite",
                }}>💰</div>
                <style>{`@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.7;transform:scale(.93)} }`}</style>
            </div>
        );
    }

    return (
        <>
            {/* Email 登入 */}
            {stage === 'email' && <EmailLogin onLogin={handleEmailLogin} />}

            {/* PIN 鎖定 */}
            {stage === 'pin' && (
                <PinLock
                    onUnlock={handlePinUnlock}
                    mode="unlock"
                    userId={currentUser?.id}
                    userName={currentUser?.name}
                    userColor={currentUser ? getUserColor(currentUser.email) : undefined}
                />
            )}

            {/* 主畫面 */}
            {stage === 'app' && (
                <>
                    {/* 改密碼覆蓋層 */}
                    {showChangePinMode && (
                        <PinLock
                            mode="change"
                            onUnlock={handlePinUnlock}
                            onChangeDone={handleChangePinDone}
                            userId={currentUser?.id}
                            userName={currentUser?.name}
                            userColor={currentUser ? getUserColor(currentUser.email) : undefined}
                        />
                    )}

                    {/* 右上角使用者選單 */}
                    {currentUser && (
                        <div style={{ position: "fixed", top: "10px", right: "12px", zIndex: 1000 }}>
                            <details>
                                <summary style={{
                                    listStyle: "none", cursor: "pointer",
                                    width: "34px", height: "34px", borderRadius: "50%",
                                    background: getUserColor(currentUser.email),
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontWeight: "800", fontSize: "0.95rem", color: "white",
                                    boxShadow: `0 2px 8px ${getUserColor(currentUser.email)}88`,
                                }}>
                                    {currentUser.name[0].toUpperCase()}
                                </summary>
                                <div style={{
                                    position: "absolute", top: "40px", right: 0,
                                    background: "white", borderRadius: "16px", padding: "8px",
                                    minWidth: "170px",
                                    boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
                                    border: "1px solid #f2f2f7",
                                }}>
                                    <div style={{ padding: "8px 12px", borderBottom: "1px solid #f2f2f7", marginBottom: "4px" }}>
                                        <p style={{ fontWeight: "700", fontSize: "0.9rem" }}>{currentUser.name}</p>
                                        <p style={{ color: "#8e8e93", fontSize: "0.75rem" }}>{currentUser.email}</p>
                                    </div>
                                    <button onClick={() => setShowChangePinMode(true)} style={{
                                        width: "100%", textAlign: "left", padding: "8px 12px",
                                        border: "none", background: "none", fontSize: "0.9rem",
                                        cursor: "pointer", borderRadius: "10px", color: "#1c1c1e",
                                    }}>🔒 修改密碼</button>
                                    <button onClick={handleSwitchAccount} style={{
                                        width: "100%", textAlign: "left", padding: "8px 12px",
                                        border: "none", background: "none", fontSize: "0.9rem",
                                        cursor: "pointer", borderRadius: "10px", color: "#ff453a",
                                    }}>🔀 切換帳號</button>
                                </div>
                            </details>
                        </div>
                    )}

                    <div>{children}</div>
                </>
            )}
        </>
    );
}
