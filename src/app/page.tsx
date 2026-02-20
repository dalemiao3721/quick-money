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
  const [statsPeriod, setStatsPeriod] = useState<'month' | 'year'>('month');
  const [confirmModal, setConfirmModal] = useState<{ show: boolean, title: string, onConfirm: () => void } | null>(null);

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

    // Update balance
    setAccounts(prev => prev.map(a => {
      if (a.id === selectedAccountId) {
        return { ...a, balance: activeType === 'income' ? a.balance + numAmount : a.balance - numAmount };
      }
      return a;
    }));

    setAmount("0");
    if (window.navigator.vibrate) window.navigator.vibrate([10]);
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

        <div className="bank-card" style={{ background: '#f9f9f9', border: '1px solid #eee' }}>
          <div style={{ fontSize: '0.8rem', color: '#8e8e93', marginBottom: '1rem' }}>交易備註</div>
          <div style={{ fontSize: '0.95rem' }}>{selectedTx.note || "無備註"}</div>
        </div>

        <button className="bank-button-primary">下載電子交易證明</button>
      </div>
    );
  }

  return (
    <main className="app-container" style={{ background: '#0a0a0c' }}>
      <button className="settings-fab" onClick={() => setCurrentScreen('accounts')}>🏦</button>

      {/* 頂部概覽 */}
      <div className="header">
        <div className="summary-card" onClick={() => setShowStats(true)} style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
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

      {/* 統計 Modal (省略或簡化以符合新風格) */}
      {showStats && (
        <div className="modal-overlay" onClick={() => setShowStats(false)}>
          <div className="modal-content" style={{ background: '#fff', color: '#1c1c1e' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>統計分析預覽</h2>
            <p style={{ textAlign: 'center', color: '#8e8e93' }}>數據分析介面正在升級為銀行風格...</p>
            <button className="bank-button-primary" onClick={() => setShowStats(false)}>關閉</button>
          </div>
        </div>
      )}
    </main>
  );
}
