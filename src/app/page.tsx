"use client";

import { useState, useEffect, useMemo } from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { Category, Transaction, Account, INITIAL_EXPENSE_CATEGORIES, INITIAL_INCOME_CATEGORIES, INITIAL_ACCOUNTS } from "./types";

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

type AppScreen = 'main' | 'accounts' | 'tx_detail';

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('main');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Core Data State
  const [amount, setAmount] = useState("0");
  const [activeType, setActiveType] = useState<'income' | 'expense' | 'transfer'>('expense');
  const [selectedCatId, setSelectedCatId] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("acc_1");

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>(INITIAL_ACCOUNTS);

  // UI States
  const [showStats, setShowStats] = useState(false);
  const [showMaintenance, setShowMaintenance] = useState(false);
  const [statsPeriod, setStatsPeriod] = useState<'month' | 'year'>('month');
  const [confirmModal, setConfirmModal] = useState<{ show: boolean, title: string, onConfirm: () => void } | null>(null);

  // Forms for Maintenance
  const [catForm, setCatForm] = useState<{ show: boolean, type: 'income' | 'expense', label: string, icon: string, id?: string } | null>(null);
  const [accForm, setAccForm] = useState<{ show: boolean, name: string, type: string, number: string, balance: number, id?: string } | null>(null);

  useEffect(() => {
    setIsMounted(true);
    const savedTransactions = localStorage.getItem("qm_transactions_v3");
    const savedCategories = localStorage.getItem("qm_categories");
    const savedAccounts = localStorage.getItem("qm_accounts");

    if (savedTransactions) setTransactions(JSON.parse(savedTransactions));
    if (savedCategories) setCategories(JSON.parse(savedCategories));
    else {
      const initialCats = [...INITIAL_EXPENSE_CATEGORIES, ...INITIAL_INCOME_CATEGORIES];
      setCategories(initialCats);
    }
    if (savedAccounts) setAccounts(JSON.parse(savedAccounts));
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    localStorage.setItem("qm_transactions_v3", JSON.stringify(transactions));
    localStorage.setItem("qm_categories", JSON.stringify(categories));
    localStorage.setItem("qm_accounts", JSON.stringify(accounts));
  }, [transactions, categories, accounts, isMounted]);

  useEffect(() => {
    const typeCats = categories.filter(c => c.type === (activeType === 'transfer' ? 'expense' : activeType));
    if (typeCats.length > 0 && (!selectedCatId || !typeCats.find(c => c.id === selectedCatId))) {
      setSelectedCatId(typeCats[0].id);
    }
  }, [activeType, categories, selectedCatId]);

  const currentTypeCategories = useMemo(() =>
    categories.filter(c => c.type === (activeType === 'transfer' ? 'expense' : activeType)),
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

  const selectedAccount = useMemo(() =>
    accounts.find(a => a.id === selectedAccountId) || accounts[0],
    [accounts, selectedAccountId]);

  // 圖表數據 (Doughnut - 類別分佈)
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

  // 柱狀圖數據 (月度趨勢)
  const barData = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const monthlyIncome = new Array(12).fill(0);
    const monthlyExpense = new Array(12).fill(0);

    transactions.forEach(t => {
      const d = new Date(t.id);
      if (d.getFullYear() === currentYear) {
        if (t.type === 'income') monthlyIncome[d.getMonth()] += t.amount;
        else if (t.type === 'expense') monthlyExpense[d.getMonth()] += t.amount;
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

  const handleSave = () => {
    const numAmount = parseInt(amount);
    if (numAmount === 0 || !selectedCatId) return;

    const now = new Date();
    const newTx: Transaction = {
      id: now.getTime(),
      amount: numAmount,
      type: activeType as any,
      categoryId: selectedCatId,
      accountId: selectedAccountId,
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: '已完成'
    };

    setTransactions(prev => [newTx, ...prev]);

    setAccounts(prev => prev.map(a => {
      if (a.id === selectedAccountId) {
        return { ...a, balance: activeType === 'income' ? a.balance + numAmount : a.balance - numAmount };
      }
      return a;
    }));

    setAmount("0");
    if (window.navigator.vibrate) window.navigator.vibrate([10]);
  };

  const requestDeleteTx = (id: number) => {
    setConfirmModal({
      show: true,
      title: "確認刪除此筆紀錄？帳戶餘額不會自動充正，請手動調整。",
      onConfirm: () => {
        setTransactions(prev => prev.filter(t => t.id !== id));
        setConfirmModal(null);
        if (currentScreen === 'tx_detail') setCurrentScreen('main');
      }
    });
  };

  const handleSaveCategory = () => {
    if (!catForm || !catForm.label) return;
    if (catForm.id) {
      setCategories(prev => prev.map(c => c.id === catForm.id ? { ...c, label: catForm.label, icon: catForm.icon } : c));
    } else {
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

  const handleSaveAccount = () => {
    if (!accForm || !accForm.name) return;
    if (accForm.id) {
      setAccounts(prev => prev.map(a => a.id === accForm.id ? { ...a, name: accForm.name, type: accForm.type, number: accForm.number, balance: accForm.balance } : a));
    } else {
      const newAcc: Account = {
        id: "acc_" + Date.now(),
        name: accForm.name,
        type: accForm.type,
        number: accForm.number,
        balance: accForm.balance
      };
      setAccounts(prev => [...prev, newAcc]);
    }
    setAccForm(null);
  };

  const openTxDetail = (tx: Transaction) => {
    setSelectedTx(tx);
    setCurrentScreen('tx_detail');
  };

  if (!isMounted) return <div style={{ background: "#f2f2f7", height: "100vh" }}></div>;

  // --- RENDERING SCREENS ---

  if (currentScreen === 'accounts') {
    return (
      <div className="bank-view-container">
        <header className="bank-header">
          <button className="back-btn" onClick={() => setCurrentScreen('main')}>❮</button>
          <h1>戶口資料</h1>
        </header>

        <div className="bank-card">
          <div className="account-header-row" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ width: '40px', height: '40px', background: '#fdf2f2', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#ff453a', fontSize: '1.2rem' }}>❌</div>
            <div>
              <div style={{ fontWeight: '600' }}>{selectedAccount.name}</div>
              <div style={{ color: '#8e8e93', fontSize: '0.8rem' }}>{selectedAccount.number}</div>
            </div>
          </div>

          <div style={{ marginTop: '2rem' }}>
            <div className="info-label">可用餘額</div>
            <div style={{ fontSize: '2rem', fontWeight: '700', marginTop: '4px' }}>TWD {selectedAccount.balance.toLocaleString()}</div>
          </div>
        </div>

        <div className="bank-action-grid" style={{ background: 'white', borderRadius: '20px', margin: '0 1.2rem' }}>
          {[
            { label: '開立定期存款', icon: '🏦' },
            { label: '繳款及轉帳', icon: '🔄' },
            { label: '外匯', icon: '💱' },
            { label: '電子結單', icon: '📄' }
          ].map((action, i) => (
            <div key={i} className="bank-action-item">
              <div className="bank-icon-circle">{action.icon}</div>
              <div className="bank-icon-label">{action.label}</div>
            </div>
          ))}
        </div>

        <div className="bank-tab-group" style={{ marginTop: '1rem' }}>
          <div className="bank-tab">概要</div>
          <div className="bank-tab active">管理</div>
        </div>

        <div className="bank-card">
          <div className="info-row">
            <span className="info-label">戶口持有人</span>
            <span className="info-value">{selectedAccount.holderName || "MIAO MENG TA"}</span>
          </div>
          <div className="info-row">
            <span className="info-label">帳戶類型</span>
            <span className="info-value">{selectedAccount.type}</span>
          </div>
          <div className="info-row">
            <span className="info-label">幣別</span>
            <span className="info-value">TWD</span>
          </div>
        </div>
      </div>
    );
  }

  if (currentScreen === 'tx_detail' && selectedTx) {
    const cat = categories.find(c => c.id === selectedTx.categoryId);
    return (
      <div className="bank-view-container">
        <header className="bank-header">
          <button className="back-btn" onClick={() => setCurrentScreen('main')}>❮</button>
          <h1>交易所資訊</h1>
        </header>

        <div className="bank-tab-group">
          <div className="bank-tab">內容</div>
          <div className="bank-tab active">詳細內容</div>
        </div>

        <div className="bank-card" style={{ borderRadius: '12px' }}>
          <div className="info-row">
            <span className="info-label">交易代號</span>
            <span className="info-value highlight" style={{ color: '#e64a19' }}>{selectedTx.id.toString().slice(-8)}</span>
          </div>
          <div className="info-row">
            <span className="info-label">交易狀態 / 方式</span>
            <span className="info-value">{selectedTx.status} / {selectedAccount.name}</span>
          </div>
          <div className="info-row">
            <span className="info-label">交易日期</span>
            <span className="info-value">{selectedTx.date} {selectedTx.time}</span>
          </div>
          <div className="info-row">
            <span className="info-label">類別 / 項目</span>
            <span className="info-value">{cat?.label} / {selectedTx.type === 'expense' ? '支出' : '收入'}</span>
          </div>
          <div style={{ height: '1px', background: '#f2f2f7', margin: '15px 0' }}></div>
          <div className="info-row" style={{ border: 'none' }}>
            <span className="info-label" style={{ fontWeight: '700', color: '#1c1c1e' }}>總金額</span>
            <span className="info-value" style={{ fontSize: '1.2rem' }}>TWD {selectedTx.amount.toLocaleString()}</span>
          </div>
        </div>

        <div style={{ padding: '0 1.2rem', marginTop: '1rem' }}>
          <button className="bank-button-primary" style={{ margin: '0 0 10px 0', width: '100%' }}>下載電子交易證明</button>
          <button className="bank-button-primary" onClick={() => requestDeleteTx(selectedTx.id)} style={{ margin: 0, width: '100%', background: '#333' }}>刪除此筆交易紀錄</button>
        </div>
      </div>
    );
  }

  return (
    <main className="app-container" style={{ background: '#0a0a0c' }}>
      <button className="settings-fab" onClick={() => setShowMaintenance(true)} style={{ right: 'auto', left: '1.5rem' }}>⚙️</button>
      <button className="settings-fab" onClick={() => setCurrentScreen('accounts')}>🏦</button>

      {/* 頂部概覽 */}
      <div className="header">
        <div className="summary-card" onClick={() => setShowStats(true)} style={{ border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p className="summary-label">{selectedAccount.name} 餘額</p>
            <span style={{ fontSize: '0.8rem', color: '#8e8e93' }}>TWD</span>
          </div>
          <p className="summary-amount">${selectedAccount.balance.toLocaleString()}</p>
          <div style={{ display: "flex", gap: "20px", marginTop: "12px" }}>
            <span style={{ color: "var(--income)", fontSize: '0.8rem' }}>今日 +{totalTodayIncome}</span>
            <span style={{ color: "var(--expense)", fontSize: '0.8rem' }}>今日 -{totalTodayExpense}</span>
          </div>
        </div>
      </div>

      {/* 帳戶切換器 (快速切換) */}
      <div className="category-mini-grid" style={{ padding: '0 1.5rem', marginBottom: '1rem', border: 'none' }}>
        {accounts.map(acc => (
          <button
            key={acc.id}
            onClick={() => setSelectedAccountId(acc.id)}
            style={{
              flex: '0 0 auto', padding: '8px 15px', borderRadius: '12px',
              background: selectedAccountId === acc.id ? 'var(--primary)' : '#1c1c1e',
              border: 'none', color: 'white', fontSize: '0.8rem', cursor: 'pointer'
            }}
          >
            {acc.name}
          </button>
        ))}
      </div>

      {/* 歷史明細區域 */}
      <div className="history-section">
        <div className="history-header">
          <h2 className="history-title">最近交易</h2>
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{transactions.length} 筆紀錄</span>
        </div>

        {transactions.length === 0 ? (
          <div className="history-empty">尚未有紀錄</div>
        ) : (
          <div style={{ paddingBottom: '20px' }}>
            {transactions.slice(0, 10).map((tx) => {
              const cat = categories.find(c => c.id === tx.categoryId);
              return (
                <div key={tx.id} className="history-item" onClick={() => openTxDetail(tx)} style={{ cursor: 'pointer' }}>
                  <div className="history-item-icon" style={{ background: '#1c1c1e' }}>{cat?.icon || "❓"}</div>
                  <div className="history-item-info">
                    <div className="history-item-label" style={{ fontSize: '0.95rem' }}>{cat?.label}</div>
                    <div className="history-item-time">{tx.date} · {tx.time}</div>
                  </div>
                  <div className={`history-item-amount ${tx.type}`} style={{ fontWeight: '600' }}>
                    {tx.type === 'income' ? '+' : '-'}${tx.amount.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 輸入區 */}
      <div className="input-feedback-area" style={{ background: '#1c1c1e', borderTop: 'none', padding: '1.2rem' }}>
        <div className="type-selector" style={{ background: '#000', marginBottom: '1rem' }}>
          <button className={`type-tab ${activeType === 'expense' ? 'active expense' : ''}`} onClick={() => setActiveType('expense')}>支出</button>
          <button className={`type-tab ${activeType === 'income' ? 'active income' : ''}`} onClick={() => setActiveType('income')}>收入</button>
        </div>

        <div className="input-display">
          <span className="currency-symbol">$</span>
          <span className="amount-preview" style={{ color: activeType === 'income' ? 'var(--income)' : 'var(--expense)', fontSize: '3rem' }}>{parseInt(amount).toLocaleString()}</span>
        </div>

        <div className="category-mini-grid" style={{ marginTop: '1rem' }}>
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
          <button className="category-item" onClick={() => setCatForm({ show: true, type: activeType as any, label: '', icon: '✨' })} style={{ border: '1px dashed #444', background: 'transparent' }}>
            <span className="category-icon">➕</span>
            <span className="category-label">新增</span>
          </button>
        </div>
      </div>

      <div className="keyboard">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"].map((k) => (
          <button key={k} className="key" onClick={() => (k === "⌫" ? setAmount(p => p.length > 1 ? p.slice(0, -1) : "0") : (k === "C" ? setAmount("0") : setAmount(p => p === "0" ? k : p + k)))}>{k}</button>
        ))}
        <button className="key confirm" onClick={handleSave} style={{ background: activeType === 'income' ? 'var(--income)' : 'var(--expense)' }}>
          確認保存
        </button>
      </div>

      {/* 統計彈出視窗 */}
      {showStats && (
        <div className="modal-overlay" onClick={() => setShowStats(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ background: '#fff', color: '#1c1c1e', maxWidth: '450px' }}>
            <button className="modal-close" onClick={() => setShowStats(false)} style={{ background: '#f2f2f7' }}>×</button>
            <h2 style={{ textAlign: "center", marginBottom: "1rem" }}>數據統計分析</h2>

            <div className="type-selector" style={{ marginBottom: '1rem', background: '#f2f2f7' }}>
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
                  scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } } }
                }} />
              )}
            </div>

            {statsPeriod === 'month' && (
              <div className="chart-legend" style={{ maxHeight: '180px', overflowY: 'auto', marginTop: '1rem' }}>
                {categories.filter(c => c.type === (activeType === 'transfer' ? 'expense' : activeType)).map(c => {
                  const items = transactions.filter(t => t.categoryId === c.id);
                  const now = new Date();
                  const monthTx = items.filter(t => {
                    const d = new Date(t.id);
                    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                  });
                  const sum = monthTx.reduce((s, t) => s + t.amount, 0);
                  if (sum === 0) return null;
                  return (
                    <div key={c.id} className="legend-item" style={{ borderBottom: '1px solid #f2f2f7', padding: '8px 0' }}>
                      <div className="legend-dot-label"><div className="legend-dot" style={{ background: c.color }}></div><span>{c.label}</span></div>
                      <span style={{ fontWeight: '600' }}>${sum.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      {/* 維護彈出視窗 */}
      {showMaintenance && (
        <div className="modal-overlay" onClick={() => setShowMaintenance(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ background: '#fff', color: '#1c1c1e', maxHeight: '85vh', overflowY: 'auto' }}>
            <button className="modal-close" onClick={() => setShowMaintenance(false)} style={{ background: '#f2f2f7' }}>×</button>
            <h2 style={{ marginBottom: "1.5rem" }}>維護管理</h2>

            <div className="history-title" style={{ color: '#1c1c1e', display: 'flex', justifyContent: 'space-between' }}>
              帳戶管理
              <button onClick={() => setAccForm({ show: true, name: '', type: 'CASH', number: '', balance: 0 })} style={{ color: 'var(--primary)', border: 'none', background: 'none', fontSize: '0.9rem', cursor: 'pointer' }}>+ 新增</button>
            </div>
            {accounts.map(acc => (
              <div key={acc.id} className="info-row">
                <span onClick={() => setAccForm({ ...acc, show: true })} style={{ cursor: 'pointer' }}>🏦 {acc.name} (${acc.balance.toLocaleString()})</span>
                <button onClick={() => {
                  setConfirmModal({ show: true, title: "確定刪除此帳戶？相關交易紀錄將會遺失參考。", onConfirm: () => { setAccounts(p => p.filter(a => a.id !== acc.id)); setConfirmModal(null); } });
                }} style={{ background: 'transparent', border: 'none', color: '#ff453a', cursor: 'pointer' }}>刪除</button>
              </div>
            ))}

            <div className="history-title" style={{ color: '#1c1c1e', marginTop: '2rem', display: 'flex', justifyContent: 'space-between' }}>
              支出分類
              <button onClick={() => setCatForm({ show: true, type: 'expense', label: '', icon: '✨' })} style={{ color: 'var(--primary)', border: 'none', background: 'none', fontSize: '0.9rem', cursor: 'pointer' }}>+ 新增</button>
            </div>
            {categories.filter(c => c.type === 'expense').map(c => (
              <div key={c.id} className="info-row">
                <span onClick={() => setCatForm({ ...c, show: true })} style={{ cursor: 'pointer' }}>{c.icon} {c.label}</span>
                <button onClick={() => {
                  setConfirmModal({ show: true, title: "確定刪除此分類？", onConfirm: () => { setCategories(p => p.filter(cat => cat.id !== c.id)); setConfirmModal(null); } });
                }} style={{ background: 'transparent', border: 'none', color: '#ff453a', cursor: 'pointer' }}>刪除</button>
              </div>
            ))}

            <div className="history-title" style={{ color: '#1c1c1e', marginTop: '2rem', display: 'flex', justifyContent: 'space-between' }}>
              收入分類
              <button onClick={() => setCatForm({ show: true, type: 'income', label: '', icon: '💰' })} style={{ color: 'var(--primary)', border: 'none', background: 'none', fontSize: '0.9rem', cursor: 'pointer' }}>+ 新增</button>
            </div>
            {categories.filter(c => c.type === 'income').map(c => (
              <div key={c.id} className="info-row">
                <span onClick={() => setCatForm({ ...c, show: true })} style={{ cursor: 'pointer' }}>{c.icon} {c.label}</span>
                <button onClick={() => {
                  setConfirmModal({ show: true, title: "確定刪除此分類？", onConfirm: () => { setCategories(p => p.filter(cat => cat.id !== c.id)); setConfirmModal(null); } });
                }} style={{ background: 'transparent', border: 'none', color: '#ff453a', cursor: 'pointer' }}>刪除</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 表單與確認對話框 */}
      {catForm?.show && (
        <div className="modal-overlay" style={{ zIndex: 2100 }}>
          <div className="modal-content" style={{ maxWidth: '350px', background: '#fff', color: '#1c1c1e' }}>
            <h2>{catForm.id ? '編輯分類' : '新增分類'}</h2>
            <div style={{ margin: '1.5rem 0' }}>
              <p className="info-label">名稱</p>
              <input type="text" value={catForm.label} onChange={(e) => setCatForm({ ...catForm, label: e.target.value })} style={{ width: '100%', padding: '12px', background: '#f2f2f7', border: 'none', borderRadius: '12px', color: '#1c1c1e' }} autoFocus />
              <p className="info-label" style={{ marginTop: '1rem' }}>圖示 (Emoji)</p>
              <input type="text" value={catForm.icon} onChange={(e) => setCatForm({ ...catForm, icon: e.target.value })} style={{ width: '100%', padding: '12px', background: '#f2f2f7', border: 'none', borderRadius: '12px', color: '#1c1c1e', fontSize: '1.5rem' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="bank-button-primary" onClick={() => setCatForm(null)} style={{ background: '#eee', color: '#333' }}>取消</button>
              <button className="bank-button-primary" onClick={handleSaveCategory}>儲存</button>
            </div>
          </div>
        </div>
      )}

      {accForm?.show && (
        <div className="modal-overlay" style={{ zIndex: 2100 }}>
          <div className="modal-content" style={{ maxWidth: '350px', background: '#fff', color: '#1c1c1e' }}>
            <h2>{accForm.id ? '編輯帳戶' : '新增帳戶'}</h2>
            <div style={{ margin: '1rem 0' }}>
              <p className="info-label">帳戶名稱</p>
              <input type="text" value={accForm.name} onChange={(e) => setAccForm({ ...accForm, name: e.target.value })} style={{ width: '100%', padding: '10px', background: '#f2f2f7', border: 'none', borderRadius: '10px', marginBottom: '10px' }} />
              <p className="info-label">類型 (如: CASH, SAVINGS)</p>
              <input type="text" value={accForm.type} onChange={(e) => setAccForm({ ...accForm, type: e.target.value })} style={{ width: '100%', padding: '10px', background: '#f2f2f7', border: 'none', borderRadius: '10px', marginBottom: '10px' }} />
              <p className="info-label">帳號/卡號</p>
              <input type="text" value={accForm.number} onChange={(e) => setAccForm({ ...accForm, number: e.target.value })} style={{ width: '100%', padding: '10px', background: '#f2f2f7', border: 'none', borderRadius: '10px', marginBottom: '10px' }} />
              <p className="info-label">初始餘額</p>
              <input type="number" value={accForm.balance} onChange={(e) => setAccForm({ ...accForm, balance: parseInt(e.target.value) || 0 })} style={{ width: '100%', padding: '10px', background: '#f2f2f7', border: 'none', borderRadius: '10px' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="bank-button-primary" onClick={() => setAccForm(null)} style={{ background: '#eee', color: '#333' }}>取消</button>
              <button className="bank-button-primary" onClick={handleSaveAccount}>儲存</button>
            </div>
          </div>
        </div>
      )}

      {confirmModal?.show && (
        <div className="modal-overlay" style={{ zIndex: 3000 }}>
          <div className="modal-content" style={{ maxWidth: '320px', textAlign: 'center', background: '#fff', color: '#1c1c1e' }}>
            <p style={{ margin: '1rem 0', fontSize: '1.1rem', fontWeight: '500' }}>{confirmModal.title}</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
              <button className="bank-button-primary" onClick={() => setConfirmModal(null)} style={{ background: '#eee', color: '#333', margin: 0, flex: 1 }}>取消</button>
              <button className="bank-button-primary" onClick={confirmModal.onConfirm} style={{ margin: 0, flex: 1 }}>確定</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
