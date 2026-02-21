"use client";

import { useState, useEffect, useMemo } from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { Category, Transaction, Account, INITIAL_EXPENSE_CATEGORIES, INITIAL_INCOME_CATEGORIES, INITIAL_ACCOUNTS } from "./types";

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

type AppScreen = 'main' | 'accounts' | 'reports' | 'maintenance' | 'tx_detail';

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
  const [statsPeriod, setStatsPeriod] = useState<'month' | 'year'>('month');
  const [reportType, setReportType] = useState<'expense' | 'income'>('expense');
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

  const selectedAccount = useMemo(() =>
    accounts.find(a => a.id === selectedAccountId) || accounts[0],
    [accounts, selectedAccountId]);

  // 圖表數據 (Doughnut - 類別分發)
  const doughnutData = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const filteredTx = transactions.filter(t => {
      if (t.type !== reportType) return false;
      const d = new Date(t.id);
      if (statsPeriod === 'month') return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      return d.getFullYear() === currentYear;
    });

    const dataMap: Record<string, number> = {};
    filteredTx.forEach(t => {
      dataMap[t.categoryId] = (dataMap[t.categoryId] || 0) + t.amount;
    });

    const cats = categories.filter(c => c.type === reportType);

    return {
      labels: cats.map(c => c.label),
      datasets: [{
        data: cats.map(c => dataMap[c.id] || 0),
        backgroundColor: cats.map(c => c.color),
        borderWidth: 0,
      }]
    };
  }, [transactions, categories, reportType, statsPeriod]);

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
        { label: '收入', data: monthlyIncome, backgroundColor: '#32D74B', borderRadius: 4 },
        { label: '支出', data: monthlyExpense, backgroundColor: '#FF453A', borderRadius: 4 }
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

  if (!isMounted) return <div style={{ background: "#f2f2f7", height: "100vh" }}></div>;

  // --- SCREEN RENDERING ---

  const renderScreen = () => {
    switch (currentScreen) {
      case 'main':
        return (
          <>
            <div className="header" style={{ padding: '1.5rem 1.2rem' }}>
              <div className="summary-card" style={{ marginBottom: 0 }}>
                <p className="summary-label">{selectedAccount.name} 餘額</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '1rem', color: '#8e8e93' }}>TWD</span>
                  <p className="summary-amount">${selectedAccount.balance.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="input-feedback-area" style={{ background: 'transparent', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div className="type-selector" style={{ margin: '0 1.2rem 1.5rem' }}>
                <button className={`type-tab ${activeType === 'expense' ? 'active expense' : ''}`} onClick={() => setActiveType('expense')}>支出</button>
                <button className={`type-tab ${activeType === 'income' ? 'active income' : ''}`} onClick={() => setActiveType('income')}>收入</button>
              </div>

              <div className="input-display" style={{ padding: '0 1.5rem' }}>
                <span className="amount-preview" style={{ color: activeType === 'income' ? 'var(--income)' : 'var(--expense)', fontSize: '3.5rem' }}>${parseInt(amount).toLocaleString()}</span>
              </div>

              <div className="category-mini-grid" style={{ padding: '1rem 1.2rem', marginTop: 'auto' }}>
                {currentTypeCategories.map((cat) => (
                  <button key={cat.id} className={`category-item ${selectedCatId === cat.id ? "selected" : ""}`} onClick={() => setSelectedCatId(cat.id)}>
                    <span className="category-icon">{cat.icon}</span>
                    <span className="category-label">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="keyboard" style={{ background: '#fff' }}>
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"].map((k) => (
                <button key={k} className="key" style={{ background: '#fff', border: '1px solid #f2f2f7' }} onClick={() => (k === "⌫" ? setAmount(p => p.length > 1 ? p.slice(0, -1) : "0") : (k === "C" ? setAmount("0") : setAmount(p => p === "0" ? k : p + k)))}>{k}</button>
              ))}
              <button className="key confirm" onClick={handleSave} style={{ background: activeType === 'income' ? 'var(--income)' : 'var(--expense)', borderRadius: 0 }}>
                確認保存
              </button>
            </div>
          </>
        );

      case 'accounts':
        return (
          <div className="bank-view-container">
            <header className="bank-header"><h1>我的帳戶</h1></header>
            <div style={{ padding: '0.8rem 0' }}>
              {accounts.map(acc => (
                <div key={acc.id} className="bank-card" onClick={() => { setSelectedAccountId(acc.id); setCurrentScreen('main'); }} style={{ cursor: 'pointer', border: selectedAccountId === acc.id ? '2px solid #e64a19' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>{acc.name}</h3>
                      <p style={{ fontSize: '0.8rem', color: '#8e8e93' }}>{acc.type} · {acc.number}</p>
                    </div>
                    <p style={{ fontSize: '1.2rem', fontWeight: '700' }}>${acc.balance.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
            <button className="bank-button-primary" onClick={() => setAccForm({ show: true, name: '', type: 'SAVINGS', number: '', balance: 0 })} style={{ background: '#333' }}>+ 新增帳戶</button>
          </div>
        );

      case 'reports':
        return (
          <div className="bank-view-container">
            <header className="bank-header"><h1>收支報表</h1></header>
            <div className="bank-tab-group">
              <button className={`bank-tab ${reportType === 'expense' ? 'active' : ''}`} onClick={() => setReportType('expense')}>支出</button>
              <button className={`bank-tab ${reportType === 'income' ? 'active' : ''}`} onClick={() => setReportType('income')}>收入</button>
              <button className={`bank-tab ${statsPeriod === 'year' ? 'active' : ''}`} onClick={() => setStatsPeriod(statsPeriod === 'month' ? 'year' : 'month')}>{statsPeriod === 'month' ? '年度' : '月度'}</button>
            </div>

            <div className="chart-container">
              {statsPeriod === 'month' ? (
                <Doughnut data={doughnutData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } } } }} />
              ) : (
                <Bar data={barData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
              )}
            </div>

            <div className="bank-card" style={{ flex: 1, marginBottom: '20px' }}>
              <div className="info-title" style={{ fontWeight: 700, marginBottom: '10px' }}>分類明細</div>
              {categories.filter(c => c.type === reportType).map(c => {
                const total = transactions.filter(t => t.categoryId === c.id && (statsPeriod === 'month' ? new Date(t.id).getMonth() === new Date().getMonth() : true)).reduce((sum, t) => sum + t.amount, 0);
                if (total === 0) return null;
                return (
                  <div key={c.id} className="info-row">
                    <span className="info-label">{c.icon} {c.label}</span>
                    <span className="info-value">${total.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 'maintenance':
        return (
          <div className="bank-view-container">
            <header className="bank-header"><h1>維護管理</h1></header>

            <div className="bank-card">
              <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>帳戶維護</h3>
              {accounts.map(acc => (
                <div key={acc.id} className="info-row">
                  <span>{acc.name}</span>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => setAccForm({ ...acc, show: true })} style={{ color: '#007aff', border: 'none', background: 'none' }}>編輯</button>
                    <button onClick={() => setAccounts(p => p.filter(a => a.id !== acc.id))} style={{ color: '#ff453a', border: 'none', background: 'none' }}>刪除</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bank-card">
              <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>分類維護 ({activeType === 'expense' ? '支出' : '收入'})</h3>
              <div className="type-selector" style={{ marginBottom: '1rem' }}>
                <button className={`type-tab ${activeType === 'expense' ? 'active expense' : ''}`} onClick={() => setActiveType('expense')}>支出</button>
                <button className={`type-tab ${activeType === 'income' ? 'active income' : ''}`} onClick={() => setActiveType('income')}>收入</button>
              </div>
              {categories.filter(c => c.type === (activeType === 'transfer' ? 'expense' : activeType)).map(c => (
                <div key={c.id} className="info-row">
                  <span>{c.icon} {c.label}</span>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => setCatForm({ ...c, show: true })} style={{ color: '#007aff', border: 'none', background: 'none' }}>編輯</button>
                    <button onClick={() => setCategories(p => p.filter(cat => cat.id !== c.id))} style={{ color: '#ff453a', border: 'none', background: 'none' }}>刪除</button>
                  </div>
                </div>
              ))}
              <button className="bank-button-primary" onClick={() => setCatForm({ show: true, type: activeType as any, label: '', icon: '✨' })} style={{ marginTop: '1rem', width: '100%', margin: '1rem 0' }}>+ 新增分類</button>
            </div>
          </div>
        );

      case 'tx_detail':
        if (!selectedTx) return null;
        const cat = categories.find(c => c.id === selectedTx.categoryId);
        return (
          <div className="bank-view-container">
            <header className="bank-header">
              <button className="back-btn" onClick={() => setCurrentScreen('main')}>❮</button>
              <h1>交易詳情</h1>
            </header>
            <div className="bank-card" style={{ marginTop: '2rem', borderRadius: '24px' }}>
              <div style={{ textAlign: 'center', margin: '1rem 0 2rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{cat?.icon}</div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>{cat?.label}</h2>
                <p style={{ color: selectedTx.type === 'expense' ? '#ff453a' : '#32d74b', fontSize: '2rem', fontWeight: '800', marginTop: '10px' }}>
                  {selectedTx.type === 'expense' ? '-' : '+'}${selectedTx.amount.toLocaleString()}
                </p>
              </div>
              <div className="info-row">
                <span className="info-label">交易帳戶</span>
                <span className="info-value">{accounts.find(a => a.id === selectedTx.accountId)?.name}</span>
              </div>
              <div className="info-row">
                <span className="info-label">交易時間</span>
                <span className="info-value">{selectedTx.date} {selectedTx.time}</span>
              </div>
              <div className="info-row">
                <span className="info-label">交易狀態</span>
                <span className="info-value highlight">{selectedTx.status}</span>
              </div>
            </div>
            <button className="bank-button-primary" onClick={() => { setTransactions(p => p.filter(t => t.id !== selectedTx.id)); setCurrentScreen('main'); }} style={{ background: '#ff453a', marginTop: '2rem' }}>刪除此筆交易</button>
          </div>
        );
    }
  };

  return (
    <div className="app-container" style={{ background: '#f2f2f7' }}>
      <div style={{ flex: 1, paddingBottom: '65px' }}>
        {renderScreen()}
      </div>

      {/* Bottom Tab Bar */}
      <nav className="tab-bar">
        {[
          { id: 'main', label: '主頁', icon: '🏠' },
          { id: 'accounts', label: '帳戶', icon: '🏦' },
          { id: 'reports', label: '報表', icon: '📊' },
          { id: 'maintenance', label: '維護', icon: '⚙️' }
        ].map(tab => (
          <div key={tab.id} className={`tab-item ${currentScreen === tab.id ? 'active' : ''}`} onClick={() => { setCurrentScreen(tab.id as any); setSelectedTx(null); }}>
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </div>
        ))}
      </nav>

      {/* Modals and Forms */}
      {catForm?.show && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ background: '#fff' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{catForm.id ? '編輯分類' : '新增分類'}</h2>
            <input type="text" placeholder="名稱" value={catForm.label} onChange={e => setCatForm({ ...catForm, label: e.target.value })} style={{ width: '100%', padding: '12px', border: '1px solid #e5e5ea', borderRadius: '12px', marginBottom: '1rem' }} />
            <input type="text" placeholder="圖示 (Emoji)" value={catForm.icon} onChange={e => setCatForm({ ...catForm, icon: e.target.value })} style={{ width: '100%', padding: '12px', border: '1px solid #e5e5ea', borderRadius: '12px', marginBottom: '1.5rem' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="bank-button-primary" style={{ background: '#eee', color: '#333', margin: 0 }} onClick={() => setCatForm(null)}>取消</button>
              <button className="bank-button-primary" style={{ margin: 0 }} onClick={handleSaveCategory}>儲存</button>
            </div>
          </div>
        </div>
      )}

      {accForm?.show && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ background: '#fff' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{accForm.id ? '編輯帳戶' : '新增帳戶'}</h2>
            <input type="text" placeholder="帳戶名稱" value={accForm.name} onChange={e => setAccForm({ ...accForm, name: e.target.value })} style={{ width: '100%', padding: '12px', border: '1px solid #e5e5ea', borderRadius: '12px', marginBottom: '1rem' }} />
            <input type="text" placeholder="類型 (例如: 現金, 往來戶口)" value={accForm.type} onChange={e => setAccForm({ ...accForm, type: e.target.value })} style={{ width: '100%', padding: '12px', border: '1px solid #e5e5ea', borderRadius: '12px', marginBottom: '1rem' }} />
            <input type="number" placeholder="餘額" value={accForm.balance} onChange={e => setAccForm({ ...accForm, balance: parseInt(e.target.value) || 0 })} style={{ width: '100%', padding: '12px', border: '1px solid #e5e5ea', borderRadius: '12px', marginBottom: '1.5rem' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="bank-button-primary" style={{ background: '#eee', color: '#333', margin: 0 }} onClick={() => setAccForm(null)}>取消</button>
              <button className="bank-button-primary" style={{ margin: 0 }} onClick={handleSaveAccount}>儲存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
