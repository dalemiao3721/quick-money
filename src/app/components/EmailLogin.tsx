"use client";

import { useState } from "react";

export interface UserProfile {
    id: string;       // nanoid 或 email-based hash
    email: string;
    name: string;
    createdAt: string;
    avatar?: string;  // 從 email 生成的顏色 Avatar
}

// ── 工具函數 ──────────────────────────────────────────────
export const USERS_KEY = "qm_users";

export function getUsers(): UserProfile[] {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(USERS_KEY) || "[]"); }
    catch { return []; }
}

export function findUser(email: string): UserProfile | null {
    return getUsers().find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
}

export function createUser(email: string, name: string): UserProfile {
    const user: UserProfile = {
        id: `u_${Date.now()}`,
        email: email.toLowerCase(),
        name,
        createdAt: new Date().toISOString(),
    };
    const users = getUsers();
    users.push(user);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    return user;
}

export function getUserColor(email: string): string {
    const colors = ["#007aff", "#ff2d55", "#ff9500", "#32d74b", "#5856d6", "#00c7be", "#ff6961", "#ff9f0a"];
    let hash = 0;
    for (const c of email) hash = (hash * 31 + c.charCodeAt(0)) % colors.length;
    return colors[hash];
}

// ── 元件 ──────────────────────────────────────────────────
interface EmailLoginProps {
    onLogin: (user: UserProfile) => void;
}

type Step = 'email' | 'name' | 'welcome';

export default function EmailLogin({ onLogin }: EmailLoginProps) {
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [step, setStep] = useState<Step>('email');
    const [foundUser, setFoundUser] = useState<UserProfile | null>(null);
    const [error, setError] = useState("");

    const users = getUsers();

    const handleEmailSubmit = () => {
        const trimmed = email.trim().toLowerCase();
        if (!trimmed || !trimmed.includes("@")) {
            setError("請輸入有效的 Email 地址");
            return;
        }
        const existing = findUser(trimmed);
        if (existing) {
            // 舊用戶 → 直接歡迎
            setFoundUser(existing);
            setStep('welcome');
        } else {
            // 新用戶 → 詢問名稱
            setStep('name');
        }
        setError("");
    };

    const handleCreate = () => {
        const trimmedName = name.trim();
        if (!trimmedName) { setError("請輸入您的名稱"); return; }
        const newUser = createUser(email.trim(), trimmedName);
        onLogin(newUser);
    };

    const handleQuickLogin = (user: UserProfile) => {
        setFoundUser(user);
        setStep('welcome');
    };

    return (
        <div style={{
            position: "fixed", inset: 0,
            background: "linear-gradient(160deg, #1c1c1e 0%, #2c2c2e 50%, #1c1c1e 100%)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            zIndex: 9998,
            fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
            padding: "2rem",
        }}>
            {/* App Icon */}
            <div style={{
                width: "72px", height: "72px",
                background: "linear-gradient(135deg, #ff9500, #ff2d55)",
                borderRadius: "20px",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "2rem", marginBottom: "1.2rem",
                boxShadow: "0 10px 30px rgba(255,45,85,0.35)",
            }}>💰</div>

            <h1 style={{ color: "white", fontSize: "1.6rem", fontWeight: "800", marginBottom: "0.4rem" }}>
                極速記帳
            </h1>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.9rem", marginBottom: "2rem" }}>
                輸入 Email 登入或建立帳號
            </p>

            {/* ── Email 輸入步驟 ── */}
            {step === 'email' && (
                <div style={{ width: "100%", maxWidth: "320px" }}>
                    <input
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={e => { setEmail(e.target.value); setError(""); }}
                        onKeyDown={e => e.key === "Enter" && handleEmailSubmit()}
                        autoFocus
                        style={{
                            width: "100%", padding: "14px 16px",
                            borderRadius: "14px",
                            border: `1.5px solid ${error ? '#ff453a' : 'rgba(255,255,255,0.15)'}`,
                            background: "rgba(255,255,255,0.08)",
                            color: "white", fontSize: "1rem",
                            outline: "none", marginBottom: "8px",
                            boxSizing: "border-box",
                        }}
                    />
                    {error && <p style={{ color: "#ff453a", fontSize: "0.8rem", marginBottom: "8px" }}>{error}</p>}
                    <button
                        onClick={handleEmailSubmit}
                        style={{
                            width: "100%", padding: "14px",
                            borderRadius: "14px", border: "none",
                            background: "linear-gradient(135deg, #007aff, #5856d6)",
                            color: "white", fontSize: "1rem", fontWeight: "700",
                            cursor: "pointer", marginBottom: "1.5rem",
                        }}
                    >
                        繼續 →
                    </button>

                    {/* 已登入過的帳號快速切換 */}
                    {users.length > 0 && (
                        <div>
                            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.75rem", textAlign: "center", marginBottom: "1rem" }}>
                                — 或選擇已登入帳號 —
                            </p>
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {users.map(u => (
                                    <button key={u.id} onClick={() => handleQuickLogin(u)} style={{
                                        display: "flex", alignItems: "center", gap: "12px",
                                        padding: "10px 14px", borderRadius: "14px",
                                        background: "rgba(255,255,255,0.07)",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        cursor: "pointer", color: "white", textAlign: "left",
                                    }}>
                                        <div style={{
                                            width: "36px", height: "36px", borderRadius: "50%",
                                            background: getUserColor(u.email),
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            fontWeight: "700", fontSize: "1rem", flexShrink: 0,
                                        }}>
                                            {u.name[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <p style={{ fontWeight: "700", fontSize: "0.9rem", marginBottom: "2px" }}>{u.name}</p>
                                            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.75rem" }}>{u.email}</p>
                                        </div>
                                        <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.3)", fontSize: "1.1rem" }}>›</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── 新用戶輸入名稱 ── */}
            {step === 'name' && (
                <div style={{ width: "100%", maxWidth: "320px" }}>
                    <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem", marginBottom: "1.2rem", textAlign: "center" }}>
                        未找到 <span style={{ color: "white" }}>{email}</span><br />請輸入您的名稱以建立新帳號
                    </p>
                    <input
                        type="text"
                        placeholder="您的名稱"
                        value={name}
                        onChange={e => { setName(e.target.value); setError(""); }}
                        onKeyDown={e => e.key === "Enter" && handleCreate()}
                        autoFocus
                        style={{
                            width: "100%", padding: "14px 16px",
                            borderRadius: "14px",
                            border: `1.5px solid ${error ? '#ff453a' : 'rgba(255,255,255,0.15)'}`,
                            background: "rgba(255,255,255,0.08)",
                            color: "white", fontSize: "1rem",
                            outline: "none", marginBottom: "8px",
                            boxSizing: "border-box",
                        }}
                    />
                    {error && <p style={{ color: "#ff453a", fontSize: "0.8rem", marginBottom: "8px" }}>{error}</p>}
                    <button onClick={handleCreate} style={{
                        width: "100%", padding: "14px", borderRadius: "14px", border: "none",
                        background: "linear-gradient(135deg, #32d74b, #00c7be)",
                        color: "white", fontSize: "1rem", fontWeight: "700", cursor: "pointer", marginBottom: "12px",
                    }}>
                        建立帳號 ✓
                    </button>
                    <button onClick={() => { setStep('email'); setError(""); }} style={{
                        width: "100%", padding: "10px", borderRadius: "14px", border: "none",
                        background: "transparent", color: "rgba(255,255,255,0.4)", fontSize: "0.9rem", cursor: "pointer",
                    }}>
                        ← 返回
                    </button>
                </div>
            )}

            {/* ── 舊用戶歡迎確認 ── */}
            {step === 'welcome' && foundUser && (
                <div style={{ width: "100%", maxWidth: "320px", textAlign: "center" }}>
                    <div style={{
                        width: "70px", height: "70px", borderRadius: "50%",
                        background: getUserColor(foundUser.email),
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: "800", fontSize: "1.8rem", margin: "0 auto 1rem",
                        boxShadow: `0 8px 25px ${getUserColor(foundUser.email)}66`,
                    }}>
                        {foundUser.name[0].toUpperCase()}
                    </div>
                    <p style={{ color: "white", fontSize: "1.2rem", fontWeight: "700", marginBottom: "4px" }}>
                        歡迎回來
                    </p>
                    <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "1rem", marginBottom: "0.5rem" }}>
                        {foundUser.name}
                    </p>
                    <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.8rem", marginBottom: "2rem" }}>
                        {foundUser.email}
                    </p>
                    <button onClick={() => onLogin(foundUser)} style={{
                        width: "100%", padding: "14px", borderRadius: "14px", border: "none",
                        background: "linear-gradient(135deg, #007aff, #5856d6)",
                        color: "white", fontSize: "1rem", fontWeight: "700", cursor: "pointer", marginBottom: "12px",
                    }}>
                        繼續 →
                    </button>
                    <button onClick={() => { setStep('email'); setFoundUser(null); setEmail(""); }} style={{
                        background: "none", border: "none", color: "rgba(255,255,255,0.35)",
                        fontSize: "0.85rem", cursor: "pointer",
                    }}>
                        使用其他帳號
                    </button>
                </div>
            )}
        </div>
    );
}
