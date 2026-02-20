"use client";

import { useState, useEffect, useMemo } from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { Category, Transaction, INITIAL_EXPENSE_CATEGORIES, INITIAL_INCOME_CATEGORIES } from "./types";

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  const [amount, setAmount] = useState("0");
  const [activeType, setActiveType] = useState<'income' | 'expense'>('expense');
  const [selectedCatId, setSelectedCatId] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [showStats, setShowStats] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [statsPeriod, setStatsPeriod] = useState<'month' | 'year'>('month');

  // 自定義對話框狀態
  const [confirmModal, setConfirmModal] = useState<{ show: boolean, title: string, onConfirm: () => void } | null>(null);
  const [catForm, setCatForm] = useState<{ show: boolean, type: 'income' | 'expense', label: string, icon: string, id?: string } | null>(null);

  // 初始化
  useEffect(() => {
    setIsMounted(true);
    const savedTransactions = localStorage.getItem("qm_transactions");
    const savedCategories = localStorage.getItem("qm_categories");

    if (savedTransactions) setTransactions(JSON.parse(savedTransactions));

    if (savedCategories) {
      setCategories(JSON.parse(savedCategories));
    } else {
      const initialCats = [...INITIAL_EXPENSE_CATEGORIES, ...INITIAL_INCOME_CATEGORIES];
      setCategories(initialCats);
      localStorage.setItem("qm_categories", JSON.stringify(initialCats));
    }
  }, []);

  // 當類別載入後，預設選擇該類型的第一項
  useEffect(() => {
    const typeCats = categories.filter(c => c.type === activeType);
    if (typeCats.length > 0 && (!selectedCatId || !typeCats.find(c => c.id === selectedCatId))) {
      setSelectedCatId(typeCats[0].id);
    }
  }, [activeType, categories, selectedCatId]);

  // 持久化儲存
  useEffect(() => {
    if (!isMounted) return;
    localStorage.setItem("qm_transactions", JSON.stringify(transactions));
    localStorage.setItem("qm_categories", JSON.stringify(categories));
  }, [transactions, categories, isMounted]);

  const currentTypeCategories = useMemo(() =>
    categories.filter(c => c.type === activeType),
    [categories, activeType]);

  const todayTransactions = useMemo(() => {
    const today = new Date().toLocaleDateString();
    return transactions.filter(t => new Date(t.id).toLocaleDateString() === today);
  }, [transactions]);

  const totalTodayExpense = useMemo(() =>
    todayTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0),
    [todayTransactions]);

  const totalTodayIncome = useMemo(() =>
    todayTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
    [todayTransactions]);

  // 計算圖表數據 (Doughnut - 類別分佈)
  const doughnutData = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const filteredTx = transactions.filter(t => {
      if (t.type !== activeType) return false;
      const d = new Date(t.id);
      if (statsPeriod === 'month') return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      return d.getFullYear() === currentYear;
    });

    const dataMap: Record<string, number> = {};
    filteredTx.forEach(t => {
      dataMap[t.categoryId] = (dataMap[t.categoryId] || 0) + t.amount;
    });

    return {
      labels: currentTypeCategories.map(c => c.label),
      datasets: [{
        data: currentTypeCategories.map(c => dataMap[c.id] || 0),
        backgroundColor: currentTypeCategories.map(c => c.color),
        borderWidth: 0,
      }]
    };
  }, [transactions, currentTypeCategories, activeType, statsPeriod]);

  // 計算柱狀圖數據 (月度趨勢)
  const barData = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const monthlyIncome = new Array(12).fill(0);
    const monthlyExpense = new Array(12).fill(0);

    transactions.forEach(t => {
      const d = new Date(t.id);
      if (d.getFullYear() === currentYear) {
        if (t.type === 'income') monthlyIncome[d.getMonth()] += t.amount;
        else monthlyExpense[d.getMonth()] += t.amount;
      }
    });

    return {
      labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map(m => m + '月'),
      datasets: [
        { label: '收入', data: monthlyIncome, backgroundColor: '#32D74B' },
        { label: '支出', data: monthlyExpense, backgroundColor: '#FF453A' }
      ]
    };
  }, [transactions]);

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
    if (numAmount === 0 || !selectedCatId) return;

    const now = new Date();
    const newTx: Transaction = {
      id: now.getTime(),
      amount: numAmount,
      type: activeType,
      categoryId: selectedCatId,
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setTransactions(prev => [newTx, ...prev]);
    setAmount("0");
    if (window.navigator.vibrate) window.navigator.vibrate([10]);
  };

  const requestDeleteTx = (id: number) => {
    setConfirmModal({
      show: true,
      title: "確認刪除此筆紀錄？",
      onConfirm: () => {
        setTransactions(prev => prev.filter(t => t.id !== id));
        setConfirmModal(null);
      }
    });
  };

  const handleSaveCategory = () => {
    if (!catForm || !catForm.label) return;

    if (catForm.id) {
      // 編輯
      setCategories(prev => prev.map(c => c.id === catForm.id ? { ...c, label: catForm.label, icon: catForm.icon } : c));
    } else {
      // 新增
      const newCat: Category = {
        id: Date.now().toString(),
        label: catForm.label,
        icon: catForm.icon || "✨",
        color: "#" + Math.floor(Math.random() * 16777215).toString(16),
        type: catForm.type
      };
      setCategories(prev => [...prev, newCat]);
    }
    setCatForm(null);
  };

  const requestDeleteCat = (id: string) => {
    setConfirmModal({
      show: true,
      title: "確認刪除分類？",
      onConfirm: () => {
        setCategories(prev => prev.filter(c => c.id !== id));
        setConfirmModal(null);
      }
    });
  };

  if (!isMounted) return <div style={{ background: "#0a0a0c", height: "100vh" }}></div>;

  return (
    <main className="app-container">
      <button className="settings-fab" onClick={() => setShowSettings(true)}>⚙️</button>

      {/* 頂部概覽 */}
      <div className="header">
        <div className="summary-card" onClick={() => setShowStats(true)} style={{ cursor: "pointer" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p className="summary-label">收支概覽 (今日)</p>
            <span>📊</span>
          </div>
          <div style={{ display: "flex", gap: "20px", marginTop: "10px" }}>
            <div>
              <p style={{ fontSize: "0.8rem", color: "var(--income)" }}>收入</p>
              <p style={{ fontSize: "1.5rem", fontWeight: "700" }}>+${totalTodayIncome.toLocaleString()}</p>
            </div>
            <div>
              <p style={{ fontSize: "0.8rem", color: "var(--expense)" }}>支出</p>
              <p style={{ fontSize: "1.5rem", fontWeight: "700" }}>-${totalTodayExpense.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 歷史明細區域 */}
      <div className="history-section">
        <div className="history-header">
          <h2 className="history-title">今日明細</h2>
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{todayTransactions.length} 筆</span>
        </div>

        {todayTransactions.length === 0 ? (
          <div className="history-empty">尚未有紀錄</div>
        ) : (
          todayTransactions.map((tx) => {
            const cat = categories.find(c => c.id === tx.categoryId);
            return (
              <div key={tx.id} className="history-item" onContextMenu={(e) => { e.preventDefault(); requestDeleteTx(tx.id); }}>
                <div className="history-item-icon">{cat?.icon || "❓"}</div>
                <div className="history-item-info">
                  <div className="history-item-label">{cat?.label || "已刪除分類"}</div>
                  <div className="history-item-time">{tx.time}</div>
                </div>
                <div className={`history-item-amount ${tx.type}`}>
                  {tx.type === 'income' ? '+' : '-'}${tx.amount.toLocaleString()}
                </div>
                <button onClick={() => requestDeleteTx(tx.id)} style={{ background: 'transparent', border: 'none', marginLeft: '10px', fontSize: '0.8rem', color: '#ff453a' }}>❌</button>
              </div>
            );
          })
        )}
      </div>

      {/* 輸入區與切換 */}
      <div className="input-feedback-area">
        <div className="type-selector">
          <button className={`type-tab ${activeType === 'expense' ? 'active expense' : ''}`} onClick={() => setActiveType('expense')}>支出</button>
          <button className={`type-tab ${activeType === 'income' ? 'active income' : ''}`} onClick={() => setActiveType('income')}>收入</button>
        </div>

        <div className="input-display" style={{ marginBottom: '1rem' }}>
          <span className="currency-symbol">$</span>
          <span className="amount-preview" style={{ color: activeType === 'income' ? 'var(--income)' : 'var(--expense)' }}>{parseInt(amount).toLocaleString()}</span>
        </div>

        <div className="category-mini-grid">
          {currentTypeCategories.map((cat) => (
            <button
              key={cat.id}
              className={`category-item ${selectedCatId === cat.id ? "selected" : ""}`}
              onClick={() => setSelectedCatId(cat.id)}
            >
              <span className="category-icon">{cat.icon}</span>
              <span className="category-label">{cat.label}</span>
            </button>
          ))}
          <button className="category-item" onClick={() => setCatForm({ show: true, type: activeType, label: '', icon: '✨' })} style={{ border: '1px dashed #444', background: 'transparent' }}>
            <span className="category-icon">➕</span>
            <span className="category-label">新增</span>
          </button>
        </div>
      </div>

      {/* 鍵盤 */}
      <div className="keyboard">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"].map((k) => (
          <button key={k} className="key" onClick={() => handleKey(k === "⌫" ? "delete" : k)}>{k}</button>
        ))}
        <button className={`key confirm ${activeType}`} onClick={handleSave} style={{ background: activeType === 'income' ? 'var(--income)' : 'var(--expense)' }}>
          保存{activeType === 'income' ? '收入' : '支出'}
        </button>
      </div>

      {/* 統計彈出視窗 */}
      {showStats && (
        <div className="modal-overlay" onClick={() => setShowStats(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <button className="modal-close" onClick={() => setShowStats(false)}>×</button>
            <h2 style={{ textAlign: "center", marginBottom: "1rem" }}>數據統計分析</h2>

            <div className="type-selector" style={{ marginBottom: '1rem' }}>
              <button className={`type-tab ${statsPeriod === 'month' ? 'active income' : ''}`} onClick={() => setStatsPeriod('month')}>本月分類</button>
              <button className={`type-tab ${statsPeriod === 'year' ? 'active income' : ''}`} onClick={() => setStatsPeriod('year')}>年度趨勢</button>
            </div>

            <div className="chart-container" style={{ height: statsPeriod === 'year' ? '250px' : '200px' }}>
              {statsPeriod === 'month' ? (
                <Doughnut data={doughnutData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
              ) : (
                <Bar data={barData} options={{
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' } } }
                }} />
              )}
            </div>

            {statsPeriod === 'month' && (
              <div className="chart-legend" style={{ maxHeight: '180px', overflowY: 'auto', marginTop: '1rem' }}>
                {categories.filter(c => c.type === activeType).map(c => {
                  const items = transactions.filter(t => t.categoryId === c.id);
                  const now = new Date();
                  const monthTx = items.filter(t => {
                    const d = new Date(t.id);
                    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                  });
                  const sum = monthTx.reduce((s, t) => s + t.amount, 0);
                  if (sum === 0) return null;
                  return (
                    <div key={c.id} className="legend-item">
                      <div className="legend-dot-label"><div className="legend-dot" style={{ background: c.color }}></div><span>{c.label}</span></div>
                      <span>${sum.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {statsPeriod === 'year' && (
              <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                顯示本年度每月收支對比圖
              </div>
            )}
          </div>
        </div>
      )}

      {/* 設定彈出視窗 (管理分類) */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowSettings(false)}>×</button>
            <h2 style={{ marginBottom: "1.5rem" }}>分類管理</h2>
            <div style={{ overflowY: 'auto', maxHeight: '60vh' }}>
              <div className="history-title" style={{ marginTop: '1rem' }}>支出分類</div>
              {categories.filter(c => c.type === 'expense').map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #333' }}>
                  <span onClick={() => setCatForm({ show: true, type: 'expense', label: c.label, icon: c.icon, id: c.id })} style={{ cursor: 'pointer' }}>{c.icon} {c.label}</span>
                  <button onClick={() => requestDeleteCat(c.id)} style={{ background: 'transparent', border: 'none', color: '#ff453a' }}>刪除</button>
                </div>
              ))}
              <div className="history-title" style={{ marginTop: '1rem' }}>收入分類</div>
              {categories.filter(c => c.type === 'income').map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #333' }}>
                  <span onClick={() => setCatForm({ show: true, type: 'income', label: c.label, icon: c.icon, id: c.id })} style={{ cursor: 'pointer' }}>{c.icon} {c.label}</span>
                  <button onClick={() => requestDeleteCat(c.id)} style={{ background: 'transparent', border: 'none', color: '#ff453a' }}>刪除</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 確認對話框 */}
      {confirmModal?.show && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="modal-content" style={{ maxWidth: '300px', textAlign: 'center' }}>
            <p style={{ margin: '1rem 0', fontSize: '1.1rem' }}>{confirmModal.title}</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
              <button className="type-tab" onClick={() => setConfirmModal(null)} style={{ background: '#333' }}>取消</button>
              <button className="type-tab active expense" onClick={confirmModal.onConfirm}>確認</button>
            </div>
          </div>
        </div>
      )}

      {/* 類別編輯/新增 Modal */}
      {catForm?.show && (
        <div className="modal-overlay" style={{ zIndex: 2100 }}>
          <div className="modal-content" style={{ maxWidth: '350px' }}>
            <h2>{catForm.id ? '編輯分類' : '新增分類'}</h2>
            <div style={{ margin: '1.5rem 0' }}>
              <p className="summary-label">名稱</p>
              <input
                type="text"
                value={catForm.label}
                onChange={(e) => setCatForm({ ...catForm, label: e.target.value })}
                style={{ width: '100%', padding: '12px', background: '#2c2c2e', border: 'none', borderRadius: '12px', color: 'white' }}
                placeholder="例如：餐飲"
                autoFocus
              />
              <p className="summary-label" style={{ marginTop: '1rem' }}>圖示 (Emoji)</p>
              <input
                type="text"
                value={catForm.icon}
                onChange={(e) => setCatForm({ ...catForm, icon: e.target.value })}
                style={{ width: '100%', padding: '12px', background: '#2c2c2e', border: 'none', borderRadius: '12px', color: 'white', fontSize: '1.5rem' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="type-tab" onClick={() => setCatForm(null)} style={{ background: '#333' }}>取消</button>
              <button className="type-tab active income" onClick={handleSaveCategory}>儲存</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
