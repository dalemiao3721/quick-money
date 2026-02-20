"use client";

import { useState, useEffect, useMemo } from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

const CATEGORIES = [
  { id: "food", label: "餐飲", icon: "🍱", color: "#FF6384" },
  { id: "transport", label: "交通", icon: "🚌", color: "#36A2EB" },
  { id: "shopping", label: "購物", icon: "🛍️", color: "#FFCE56" },
  { id: "entertainment", label: "娛樂", icon: "🎮", color: "#4BC0C0" },
  { id: "daily", label: "日用", icon: "🧻", color: "#9966FF" },
  { id: "medical", label: "醫療", icon: "💊", color: "#FF9F40" },
  { id: "housing", label: "房租", icon: "🏠", color: "#C9CBCF" },
  { id: "other", label: "其他", icon: "✨", color: "#4D5360" },
];

export default function Home() {
  const [amount, setAmount] = useState("0");
  const [selectedCat, setSelectedCat] = useState("food");
  const [totalToday, setTotalToday] = useState(0);
  const [history, setHistory] = useState<{ id: number, amount: number, category: string, time: string }[]>([]);
  const [showStats, setShowStats] = useState(false);

  // 初始化：從 LocalStorage 讀取今日數據
  useEffect(() => {
    const savedData = localStorage.getItem("quick_money_data");
    const savedHistory = localStorage.getItem("quick_money_history");
    const today = new Date().toLocaleDateString();

    if (savedData) {
      const { total, date } = JSON.parse(savedData);
      if (date === today) {
        setTotalToday(total);
      } else {
        localStorage.removeItem("quick_money_history"); // 新的一天，清除歷史
      }
    }

    if (savedHistory) {
      const historyData = JSON.parse(savedHistory);
      // 檢查歷史第一筆是否是今天的，若不是則不載入
      if (historyData.length > 0 && new Date(historyData[0].id).toLocaleDateString() === today) {
        setHistory(historyData);
      }
    }
  }, []);

  // 持久化儲存
  useEffect(() => {
    localStorage.setItem("quick_money_data", JSON.stringify({
      total: totalToday,
      date: new Date().toLocaleDateString()
    }));
    localStorage.setItem("quick_money_history", JSON.stringify(history));
  }, [totalToday, history]);

  // 計算圖表數據
  const chartData = useMemo(() => {
    const dataMap: Record<string, number> = {};
    history.forEach(item => {
      dataMap[item.category] = (dataMap[item.category] || 0) + item.amount;
    });

    const labels = CATEGORIES.map(c => c.label);
    const data = CATEGORIES.map(c => dataMap[c.id] || 0);
    const colors = CATEGORIES.map(c => c.color);

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors,
          borderWidth: 0,
          cutout: '70%',
        },
      ],
    };
  }, [history]);

  const chartOptions = {
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true }
    },
    maintainAspectRatio: false
  };

  // 處理按鈕輸入
  const handleKey = (key: string) => {
    if (key === "delete") {
      setAmount((prev) => (prev.length > 1 ? prev.slice(0, -1) : "0"));
    } else if (key === "C") {
      setAmount("0");
    } else {
      if (amount.length > 9) return;
      setAmount((prev) => (prev === "0" ? key : prev + key));
    }
  };

  const handleSave = () => {
    const numAmount = parseInt(amount);
    if (numAmount === 0) return;

    const now = new Date();
    const newItem = {
      id: now.getTime(),
      amount: numAmount,
      category: selectedCat,
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setTotalToday((prev) => prev + numAmount);
    setHistory((prev) => [newItem, ...prev]);
    setAmount("0");

    if (typeof window !== "undefined" && window.navigator.vibrate) {
      window.navigator.vibrate([10]);
    }
  };

  return (
    <main className="app-container">
      {/* 頂部概覽 - 加入點擊開啟統計 */}
      <div className="header">
        <div className="summary-card" onClick={() => setShowStats(true)} style={{ cursor: "pointer" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p className="summary-label">今日累計支出</p>
            <span style={{ fontSize: "1.2rem" }}>📊</span>
          </div>
          <p className="summary-amount">${totalToday.toLocaleString()}</p>
        </div>
      </div>

      {/* 歷史清單區域 */}
      <div className="history-section">
        <div className="history-header">
          <h2 className="history-title">今日明細</h2>
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
            {history.length} 筆
          </span>
        </div>

        {history.length === 0 ? (
          <div className="history-empty">尚未有記帳紀錄，開始輸入吧！</div>
        ) : (
          history.map((item) => {
            const catInfo = CATEGORIES.find(c => c.id === item.category);
            return (
              <div key={item.id} className="history-item">
                <div className="history-item-icon">{catInfo?.icon}</div>
                <div className="history-item-info">
                  <div className="history-item-label">{catInfo?.label}</div>
                  <div className="history-item-time">{item.time}</div>
                </div>
                <div className="history-item-amount">-${item.amount.toLocaleString()}</div>
              </div>
            );
          })
        )}
      </div>

      {/* 金額顯示區 - 縮小以便騰出空間 */}
      <div className="input-display" style={{ padding: "1rem 2rem", flex: "0 0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline" }}>
          <span className="currency-symbol">$</span>
          <span className="amount-preview" style={{ fontSize: "3rem" }}>{parseInt(amount).toLocaleString()}</span>
        </div>
      </div>

      {/* 分類選擇區 */}
      <div className="category-section" style={{ padding: "0.5rem 1rem" }}>
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

      {/* 數字鍵盤 */}
      <div className="keyboard">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "delete"].map((k) => (
          <button
            key={k}
            className={`key ${k === "delete" ? "delete" : ""}`}
            onClick={() => handleKey(k)}
          >
            {k === "delete" ? "⌫" : k}
          </button>
        ))}
        <button
          className="key confirm"
          style={{ height: "70px", fontSize: "1.1rem", color: "white" }}
          onClick={handleSave}
        >
          確認記帳
        </button>
      </div>
    </main>
  );
}
