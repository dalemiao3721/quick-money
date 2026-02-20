"use client";

import { useState, useEffect } from "react";

const CATEGORIES = [
  { id: "food", label: "餐飲", icon: "🍱" },
  { id: "transport", label: "交通", icon: "🚌" },
  { id: "shopping", label: "購物", icon: "🛍️" },
  { id: "entertainment", label: "娛樂", icon: "🎮" },
  { id: "daily", label: "日用", icon: "🧻" },
  { id: "medical", label: "醫療", icon: "💊" },
  { id: "housing", label: "房租", icon: "🏠" },
  { id: "other", label: "其他", icon: "✨" },
];

export default function Home() {
  const [amount, setAmount] = useState("0");
  const [selectedCat, setSelectedCat] = useState("food");
  const [totalToday, setTotalToday] = useState(0);

  // 初始化：從 LocalStorage 讀取今日數據
  useEffect(() => {
    const savedData = localStorage.getItem("quick_money_data");
    if (savedData) {
      const { total, date } = JSON.parse(savedData);
      const today = new Date().toLocaleDateString();
      // 如果日期是今天，則載入總額，否則重置為 0
      if (date === today) {
        setTotalToday(total);
      }
    }
  }, []);

  // 監聽 totalToday 變化並儲存
  useEffect(() => {
    const data = {
      total: totalToday,
      date: new Date().toLocaleDateString()
    };
    localStorage.setItem("quick_money_data", JSON.stringify(data));
  }, [totalToday]);

  // 處理按鈕輸入
  const handleKey = (key: string) => {
    if (key === "delete") {
      setAmount((prev) => (prev.length > 1 ? prev.slice(0, -1) : "0"));
    } else if (key === "C") {
      setAmount("0");
    } else {
      // 限制金額長度防止溢出
      if (amount.length > 9) return;
      setAmount((prev) => (prev === "0" ? key : prev + key));
    }
  };

  const handleSave = () => {
    const numAmount = parseInt(amount);
    if (numAmount === 0) return;

    // 更新狀態，觸發 useEffect 進行持久化
    setTotalToday((prev) => prev + numAmount);

    // 儲存成功的動畫效果與重置
    setAmount("0");

    // 給予簡單震動回饋
    if (typeof window !== "undefined" && window.navigator.vibrate) {
      window.navigator.vibrate([10]);
    }
  };

  return (
    <main className="app-container">
      {/* 頂部概覽 */}
      <div className="header">
        <div className="summary-card">
          <p className="summary-label">今日累計支出</p>
          <p className="summary-amount">${totalToday.toLocaleString()}</p>
        </div>
      </div>

      {/* 金額顯示區 */}
      <div className="input-display">
        <div style={{ display: "flex", alignItems: "baseline" }}>
          <span className="currency-symbol">$</span>
          <span className="amount-preview">{parseInt(amount).toLocaleString()}</span>
        </div>
      </div>

      {/* 分類選擇區 */}
      <div className="category-section">
        <div className="category-grid">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              className={`category-item ${selectedCat === cat.id ? "selected" : ""}`}
              onClick={() => setSelectedCat(cat.id)}
            >
              <span className="category-icon">{cat.icon}</span>
              <span className="category-label">{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 類 iOS 數字鍵盤 */}
      <div className="keyboard">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "delete"].map((k) => (
          <button
            key={k}
            className={`key ${k === "delete" ? "delete" : ""}`}
            onClick={() => k === "delete" || k === "C" ? handleKey(k) : handleKey(k)}
          >
            {k === "delete" ? "⌫" : k}
          </button>
        ))}
        <button
          className="key confirm"
          style={{ gridColumn: "span 3", height: "80px", fontSize: "1.2rem", color: "white" }}
          onClick={handleSave}
        >
          確認記帳
        </button>
      </div>
    </main>
  );
}
