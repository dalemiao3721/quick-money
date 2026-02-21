"use client";

import { useState, useEffect, useCallback } from "react";

type PinMode = 'unlock' | 'force_change_new' | 'force_change_confirm' | 'change_old' | 'change_new' | 'change_confirm';

interface PinLockProps {
    onUnlock: () => void;
    mode?: 'unlock' | 'change'; // 外部指定模式（change = 從設定進入改密碼）
    onChangeDone?: () => void;  // 改完密碼後的回掉（從設定進入時用）
}

const PIN_KEY = "qm_pin";
const PIN_CHANGED_KEY = "qm_pin_changed";
const DEFAULT_PIN_HASH = btoa("0000");

export function getPinHash(): string {
    if (typeof window === "undefined") return DEFAULT_PIN_HASH;
    return localStorage.getItem(PIN_KEY) || DEFAULT_PIN_HASH;
}

export function isDefaultPin(): boolean {
    return getPinHash() === DEFAULT_PIN_HASH;
}

export default function PinLock({ onUnlock, mode = 'unlock', onChangeDone }: PinLockProps) {
    const [pinInput, setPinInput] = useState("");
    const [pinMode, setPinMode] = useState<PinMode>(() => {
        if (mode === 'change') return 'change_old';
        return 'unlock';
    });
    const [newPinTemp, setNewPinTemp] = useState("");
    const [error, setError] = useState("");
    const [shake, setShake] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");

    const isFirstTime = typeof window !== "undefined" && !localStorage.getItem(PIN_CHANGED_KEY);

    const triggerShake = useCallback(() => {
        setShake(true);
        setTimeout(() => setShake(false), 500);
    }, []);

    const handleKey = useCallback((key: string) => {
        if (key === "⌫") {
            setPinInput(p => p.slice(0, -1));
            setError("");
            return;
        }
        setPinInput(p => p.length < 4 ? p + key : p);
    }, []);

    // 自動驗證（達4位時觸發）
    useEffect(() => {
        if (pinInput.length < 4) return;

        const timer = setTimeout(() => {
            if (pinMode === 'unlock') {
                if (btoa(pinInput) === getPinHash()) {
                    if (isFirstTime) {
                        // 首次使用，強制要求修改密碼
                        setPinInput("");
                        setPinMode('force_change_new');
                    } else {
                        onUnlock();
                    }
                } else {
                    setError("密碼錯誤，請重新輸入");
                    triggerShake();
                    setPinInput("");
                }
            } else if (pinMode === 'force_change_new' || pinMode === 'change_new') {
                if (pinInput === "0000" && pinMode === 'force_change_new') {
                    setError("不可使用預設密碼 0000");
                    triggerShake();
                    setPinInput("");
                    return;
                }
                setNewPinTemp(pinInput);
                setPinInput("");
                setPinMode(pinMode === 'force_change_new' ? 'force_change_confirm' : 'change_confirm');
            } else if (pinMode === 'force_change_confirm' || pinMode === 'change_confirm') {
                if (pinInput === newPinTemp) {
                    // 儲存新密碼
                    localStorage.setItem(PIN_KEY, btoa(pinInput));
                    localStorage.setItem(PIN_CHANGED_KEY, "true");
                    setSuccessMsg("密碼已更新 ✓");
                    setPinInput("");
                    setTimeout(() => {
                        setSuccessMsg("");
                        if (pinMode === 'change_confirm') {
                            onChangeDone?.();
                        } else {
                            onUnlock();
                        }
                    }, 1000);
                } else {
                    setError("兩次輸入不一致，請重新設定");
                    triggerShake();
                    setPinInput("");
                    setNewPinTemp("");
                    setPinMode(pinMode === 'force_change_confirm' ? 'force_change_new' : 'change_new');
                }
            } else if (pinMode === 'change_old') {
                if (btoa(pinInput) === getPinHash()) {
                    setPinInput("");
                    setPinMode('change_new');
                } else {
                    setError("目前密碼錯誤");
                    triggerShake();
                    setPinInput("");
                }
            }
        }, 150);

        return () => clearTimeout(timer);
    }, [pinInput, pinMode, newPinTemp, isFirstTime, onUnlock, onChangeDone, triggerShake]);

    const titles: Record<PinMode, string> = {
        unlock: isFirstTime ? "首次使用，請輸入預設密碼" : "輸入密碼解鎖",
        force_change_new: "請設定新密碼（4位數）",
        force_change_confirm: "再次確認新密碼",
        change_old: "輸入目前密碼",
        change_new: "輸入新密碼（4位數）",
        change_confirm: "再次確認新密碼",
    };

    return (
        <div style={{
            position: "fixed", inset: 0,
            background: "linear-gradient(160deg, #1c1c1e 0%, #2c2c2e 50%, #1c1c1e 100%)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            zIndex: 9999,
            fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
        }}>
            {/* App Icon */}
            <div style={{
                width: "70px", height: "70px",
                background: "linear-gradient(135deg, #ff9500, #ff2d55)",
                borderRadius: "20px",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "2rem", marginBottom: "1.5rem",
                boxShadow: "0 10px 30px rgba(255,45,85,0.4)",
            }}>💰</div>

            {/* 首次使用提示 */}
            {pinMode === 'unlock' && isFirstTime && (
                <div style={{
                    background: "rgba(255,149,0,0.2)",
                    border: "1px solid rgba(255,149,0,0.4)",
                    borderRadius: "12px",
                    padding: "8px 16px",
                    marginBottom: "1rem",
                    fontSize: "0.8rem",
                    color: "#ff9500",
                }}>
                    🔑 首次使用，預設密碼為 0000
                </div>
            )}

            <h2 style={{ color: "white", fontSize: "1.1rem", fontWeight: "600", marginBottom: "0.4rem" }}>
                {titles[pinMode]}
            </h2>

            {/* 錯誤 / 成功訊息 */}
            <p style={{
                minHeight: "1.4rem",
                fontSize: "0.85rem",
                marginBottom: "1.5rem",
                color: successMsg ? "#32d74b" : "#ff453a",
                transition: "opacity 0.3s",
                opacity: error || successMsg ? 1 : 0,
            }}>
                {successMsg || error || " "}
            </p>

            {/* PIN 圓點 */}
            <div style={{
                display: "flex", gap: "20px", marginBottom: "3rem",
                animation: shake ? "shake 0.4s ease" : "none",
            }}>
                {[0, 1, 2, 3].map(i => (
                    <div key={i} style={{
                        width: "16px", height: "16px",
                        borderRadius: "50%",
                        border: "2px solid rgba(255,255,255,0.5)",
                        background: i < pinInput.length ? "white" : "transparent",
                        transition: "background 0.12s, transform 0.12s",
                        transform: i < pinInput.length ? "scale(1.15)" : "scale(1)",
                    }} />
                ))}
            </div>

            {/* 數字鍵盤 */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "14px",
                width: "270px",
            }}>
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((key, idx) => (
                    <button key={idx} onClick={() => key && handleKey(key)}
                        style={{
                            height: "66px", borderRadius: "50%",
                            border: "none",
                            background: key ? "rgba(255,255,255,0.1)" : "transparent",
                            color: "white",
                            fontSize: key === "⌫" ? "1.4rem" : "1.7rem",
                            fontWeight: "500",
                            cursor: key ? "pointer" : "default",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "background 0.1s",
                            WebkitTapHighlightColor: "transparent",
                        }}
                        onMouseDown={e => key && (e.currentTarget.style.background = "rgba(255,255,255,0.25)")}
                        onMouseUp={e => key && (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
                    >
                        {key}
                    </button>
                ))}
            </div>

            {/* 如果是從設定進入的改密碼，提供取消 */}
            {mode === 'change' && (
                <button onClick={onChangeDone} style={{
                    marginTop: "1.5rem", background: "none", border: "none",
                    color: "rgba(255,255,255,0.4)", fontSize: "0.85rem", cursor: "pointer",
                }}>
                    取消
                </button>
            )}

            <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
        </div>
    );
}
