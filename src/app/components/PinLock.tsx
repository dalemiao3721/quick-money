"use client";

import { useState, useEffect } from "react";

interface PinLockProps {
    onUnlock: () => void;
    userImage?: string;
    userName?: string;
}

export default function PinLock({ onUnlock, userImage, userName }: PinLockProps) {
    const [pin, setPin] = useState("");
    const [mode, setMode] = useState<"lock" | "setup" | "confirm">("lock");
    const [setupPin, setSetupPin] = useState("");
    const [error, setError] = useState("");
    const [shake, setShake] = useState(false);

    const STORED_PIN_KEY = "qm_pin_hash";
    const storedPin = typeof window !== "undefined" ? localStorage.getItem(STORED_PIN_KEY) : null;

    useEffect(() => {
        if (!storedPin) {
            setMode("setup");
        }
    }, [storedPin]);

    const triggerShake = () => {
        setShake(true);
        setTimeout(() => setShake(false), 500);
    };

    const handleKeyPress = (key: string) => {
        if (key === "⌫") {
            setPin(p => p.slice(0, -1));
            setError("");
            return;
        }

        const newPin = pin + key;
        setPin(newPin);

        if (newPin.length === 6) {
            if (mode === "setup") {
                setSetupPin(newPin);
                setPin("");
                setMode("confirm");
            } else if (mode === "confirm") {
                if (newPin === setupPin) {
                    localStorage.setItem(STORED_PIN_KEY, btoa(newPin));
                    setPin("");
                    setMode("lock");
                    onUnlock();
                } else {
                    setError("PIN 碼不一致，請重新設定");
                    triggerShake();
                    setPin("");
                    setSetupPin("");
                    setMode("setup");
                }
            } else {
                // Verify
                if (btoa(newPin) === storedPin) {
                    onUnlock();
                } else {
                    setError("PIN 碼錯誤");
                    triggerShake();
                    setPin("");
                }
            }
        }
    };

    const dots = Array(6).fill(0);

    return (
        <div style={{
            position: "fixed",
            inset: 0,
            background: "linear-gradient(145deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
        }}>
            {/* User Avatar */}
            <div style={{ marginBottom: "1.5rem", textAlign: "center" }}>
                <div style={{
                    width: "72px",
                    height: "72px",
                    borderRadius: "50%",
                    overflow: "hidden",
                    margin: "0 auto 0.8rem",
                    border: "3px solid rgba(255,255,255,0.3)",
                    background: "rgba(255,255,255,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "2rem",
                }}>
                    {userImage ? (
                        <img src={userImage} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : "👤"}
                </div>
                <p style={{ color: "white", fontWeight: "700", fontSize: "1rem" }}>{userName || "使用者"}</p>
            </div>

            {/* Title */}
            <h2 style={{
                color: "white",
                fontSize: "1.1rem",
                fontWeight: "600",
                marginBottom: "0.5rem",
            }}>
                {mode === "setup" ? "設定 6 位數 PIN 碼" :
                    mode === "confirm" ? "再次確認 PIN 碼" : "輸入 PIN 碼解鎖"}
            </h2>

            {/* Error */}
            <p style={{
                color: "#ff453a",
                fontSize: "0.85rem",
                marginBottom: "1.5rem",
                minHeight: "1.2rem",
                transition: "opacity 0.3s",
                opacity: error ? 1 : 0,
            }}>{error || " "}</p>

            {/* PIN Dots */}
            <div style={{
                display: "flex",
                gap: "16px",
                marginBottom: "3rem",
                animation: shake ? "shake 0.4s ease" : "none",
            }}>
                {dots.map((_, i) => (
                    <div key={i} style={{
                        width: "14px",
                        height: "14px",
                        borderRadius: "50%",
                        border: "2px solid rgba(255,255,255,0.6)",
                        background: i < pin.length ? "white" : "transparent",
                        transition: "background 0.15s, transform 0.15s",
                        transform: i < pin.length ? "scale(1.1)" : "scale(1)",
                    }} />
                ))}
            </div>

            {/* Keypad */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "12px",
                width: "280px",
            }}>
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((key, idx) => (
                    <button
                        key={idx}
                        onClick={() => key && handleKeyPress(key)}
                        style={{
                            height: "68px",
                            borderRadius: "50%",
                            border: "none",
                            background: key ? "rgba(255,255,255,0.12)" : "transparent",
                            color: "white",
                            fontSize: key === "⌫" ? "1.4rem" : "1.6rem",
                            fontWeight: "600",
                            cursor: key ? "pointer" : "default",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "background 0.15s, transform 0.1s",
                            WebkitTapHighlightColor: "transparent",
                        }}
                        onMouseDown={e => (e.currentTarget.style.background = "rgba(255,255,255,0.25)")}
                        onMouseUp={e => (e.currentTarget.style.background = key ? "rgba(255,255,255,0.12)" : "transparent")}
                    >
                        {key}
                    </button>
                ))}
            </div>

            {/* Skip for setup mode */}
            {mode === "setup" && (
                <button
                    onClick={onUnlock}
                    style={{
                        marginTop: "2rem",
                        background: "none",
                        border: "none",
                        color: "rgba(255,255,255,0.4)",
                        fontSize: "0.85rem",
                        cursor: "pointer",
                        textDecoration: "underline",
                    }}
                >
                    暫時跳過，不設定 PIN
                </button>
            )}

            <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-8px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
        </div>
    );
}
