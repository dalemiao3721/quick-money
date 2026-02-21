"use client";

import { useState, useEffect, useMemo } from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { Category, Transaction, Account, INITIAL_EXPENSE_CATEGORIES, INITIAL_INCOME_CATEGORIES, INITIAL_ACCOUNTS } from "./types";

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

type AppScreen = 'main' | 'accounts' | 'reports' | 'maintenance' | 'tx_detail';

const EXPENSE_ICONS = [
  "🍱", "🍔", "🍕", "🍜", "🍣", "🍛", "🥗", "🥪", "🍳", "🍰", "🍎", "☕", "🍺", "🥤",
  "🚌", "🚕", "🚗", "🛵", "🚲", "🚄", "✈️", "🚢", "⛽", "🅿️",
  "🛍️", "🎁", "🎮", "🎭", "🎬", "🎤", "🎨", "⚽", "🎾", "🏋️", "🧘",
  "🏠", "🧻", "💊", "🧼", "👕", "👗", "💇", "🧹", "🧴", "🚿", "🛏️", "🛋️",
  "✨", "💡", "📱", "💻", "🐾", "📚", "🔔", "🛠️", "🔑", "📦"
];

const INCOME_ICONS = [
  "💰", "🧧", "📈", "💼", "🏦", "💎", "💴", "💸", "💳", "💹",
  "🥇", "🥈", "🥉", "🏆", "🎁", "🎉", "🔥", "🤝", "🏪", "🏧"
];

const ACCOUNT_ICONS = ["💵", "🏦", "🪙", "💳", "💰", "🧧"];

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

  // Home Input States (NEW)
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [txNote, setTxNote] = useState("");
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // Drilldown State
  const [drilldownCatId, setDrilldownCatId] = useState<string | null>(null);

  // Report States (V5 New)
  const [reportView, setReportView] = useState<'category' | 'trend'>('category');
  const [reportMainType, setReportMainType] = useState<'expense' | 'income' | 'balance'>('expense');
  const [reportPeriod, setReportPeriod] = useState<'day' | 'month' | 'year'>('month'); // category: month/year, trend: day/month
  const [reportDate, setReportDate] = useState(new Date());

  // Account Detail & Privacy
  const [accountDetailId, setAccountDetailId] = useState<string | null>(null);
  const [hideBalance, setHideBalance] = useState(false);

  // Forms for Maintenance
  const [catForm, setCatForm] = useState<{ show: boolean, type: 'income' | 'expense', label: string, icon: string, id?: string } | null>(null);
  const [accForm, setAccForm] = useState<{ show: boolean, name: string, type: string, number: string, balance: number, icon: string, id?: string } | null>(null);

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

  // Helper for report date string
  const reportDateStr = useMemo(() => {
    if (reportPeriod === 'year') return `${reportDate.getFullYear()} 年`;
    return `${reportDate.getFullYear()} 年 ${reportDate.getMonth() + 1} 月`;
  }, [reportDate, reportPeriod]);

  // Filtered transactions for report
  const filteredReportTransactions = useMemo(() => {
    return transactions.filter(t => {
      const d = new Date(t.id);
      const sameYear = d.getFullYear() === reportDate.getFullYear();
      const sameMonth = d.getMonth() === reportDate.getMonth();

      if (reportPeriod === 'year') return sameYear;
      return sameYear && sameMonth;
    });
  }, [transactions, reportDate, reportPeriod]);

  // Doughnut Data (Category Report)
  const doughnutData = useMemo(() => {
    const dataMap: Record<string, number> = {};
    const filtered = filteredReportTransactions.filter(t => t.type === reportMainType);
    filtered.forEach(t => {
      dataMap[t.categoryId] = (dataMap[t.categoryId] || 0) + t.amount;
    });

    const cats = categories.filter(c => c.type === reportMainType);
    const sortedCats = [...cats].sort((a, b) => (dataMap[b.id] || 0) - (dataMap[a.id] || 0));

    return {
      labels: sortedCats.map(c => c.label),
      datasets: [{
        data: sortedCats.map(c => dataMap[c.id] || 0),
        backgroundColor: sortedCats.map(c => c.color),
        borderWidth: 0,
        hoverOffset: 4
      }],
      total: filtered.reduce((s, t) => s + t.amount, 0)
    };
  }, [filteredReportTransactions, categories, reportMainType]);

  // Bar Data (Trend)
  const barData = useMemo(() => {
    const labels: string[] = [];
    const incomeData: number[] = [];
    const expenseData: number[] = [];

    if (reportPeriod === 'month') {
      // Daily trend for specific month
      const daysInMonth = new Date(reportDate.getFullYear(), reportDate.getMonth() + 1, 0).getDate();
      for (let i = 1; i <= daysInMonth; i++) {
        labels.push(`${i}日`);
        const dayTxs = filteredReportTransactions.filter(t => new Date(t.id).getDate() === i);
        incomeData.push(dayTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0));
        expenseData.push(dayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
      }
    } else {
      // Monthly trend for specific year
      for (let i = 0; i < 12; i++) {
        labels.push(`${i + 1}月`);
        const monthTxs = transactions.filter(t => {
          const d = new Date(t.id);
          return d.getFullYear() === reportDate.getFullYear() && d.getMonth() === i;
        });
        incomeData.push(monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0));
        expenseData.push(monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
      }
    }

    const currentDataSet = reportMainType === 'income' ? incomeData : expenseData;

    return {
      labels,
      datasets: [{
        label: reportMainType === 'income' ? '收入' : '支出',
        data: currentDataSet,
        backgroundColor: reportMainType === 'income' ? '#32d74b' : '#ffb74d',
        borderRadius: 4
      }]
    };
  }, [filteredReportTransactions, transactions, reportDate, reportPeriod, reportMainType]);

  const handleSave = () => {
    const numAmount = parseInt(amount);
    if (numAmount === 0 || !selectedCatId) return;

    if (editingTx) {
      // 更新現有交易
      const oldAmount = editingTx.amount;
      const oldType = editingTx.type;

      const updatedTx: Transaction = {
        ...editingTx,
        amount: numAmount,
        type: activeType as any,
        categoryId: selectedCatId,
        accountId: selectedAccountId,
        date: txDate,
        note: txNote
      };

      setTransactions(prev => prev.map(t => t.id === editingTx.id ? updatedTx : t));

      // 修正帳戶餘額：先退回舊的，再扣除/增加新的
      setAccounts(prev => prev.map(a => {
        if (a.id === selectedAccountId) {
          let newBalance = a.balance;
          // 退回舊的
          newBalance = oldType === 'income' ? newBalance - oldAmount : newBalance + oldAmount;
          // 加上新的
          newBalance = activeType === 'income' ? newBalance + numAmount : newBalance - numAmount;
          return { ...a, balance: newBalance };
        }
        return a;
      }));

      setEditingTx(null);
    } else {
      // 新增交易
      const now = new Date();
      const newTx: Transaction = {
        id: now.getTime(),
        amount: numAmount,
        type: activeType as any,
        categoryId: selectedCatId,
        accountId: selectedAccountId,
        date: txDate,
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        note: txNote,
        status: '已完成'
      };

      setTransactions(prev => [newTx, ...prev]);
      setAccounts(prev => prev.map(a => {
        if (a.id === selectedAccountId) {
          return { ...a, balance: activeType === 'income' ? a.balance + numAmount : a.balance - numAmount };
        }
        return a;
      }));
    }

    setAmount("0");
    setTxNote("");
    setTxDate(new Date().toISOString().split('T')[0]);
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
      setAccounts(prev => prev.map(a => a.id === accForm.id ? { ...a, name: accForm.name, type: accForm.type, number: accForm.number, balance: accForm.balance, icon: accForm.icon } : a));
    } else {
      const newAcc: Account = {
        id: "acc_" + Date.now(),
        name: accForm.name,
        type: accForm.type,
        number: accForm.number,
        balance: accForm.balance,
        icon: accForm.icon || "🏦"
      };
      setAccounts(prev => [...prev, newAcc]);
    }
    setAccForm(null);
  };

  const changeReportDate = (dir: number) => {
    const next = new Date(reportDate);
    if (reportPeriod === 'year') {
      next.setFullYear(next.getFullYear() + dir);
    } else {
      next.setMonth(next.getMonth() + dir);
    }
    setReportDate(next);
  };

  if (!isMounted) return <div style={{ background: "#f2f2f7", height: "100vh" }}></div>;

  // --- SCREEN RENDERING ---

  const renderScreen = () => {
    switch (currentScreen) {
      case 'main':
        return (
          <div className="bank-view-container" style={{ height: 'calc(100vh - 65px)', overflowY: 'auto' }}>
            <div className="header" style={{ padding: '0.8rem 1.2rem' }}>
              <div className="summary-card" style={{ marginBottom: 0, padding: '1rem', display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ width: '45px', height: '45px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {selectedAccount.icon && selectedAccount.icon.startsWith('data:image') ? (
                    <img src={selectedAccount.icon} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '1.4rem' }}>{selectedAccount.icon || "💰"}</span>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  {editingTx ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ background: '#ff9800', color: 'white', padding: '2px 8px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: '800' }}>修改模式</span>
                      <button onClick={() => { setEditingTx(null); setAmount("0"); setTxNote(""); }} style={{ color: 'white', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', padding: '2px 8px', fontSize: '0.7rem' }}>取消</button>
                    </div>
                  ) : null}
                  <p className="summary-label" style={{ marginBottom: '2px', fontSize: '0.8rem' }}>{selectedAccount.name} 餘額</p>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ fontSize: '0.8rem', color: '#8e8e93' }}>TWD</span>
                    <p className="summary-amount" style={{ fontSize: '1.6rem' }}>${selectedAccount.balance.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="category-mini-grid" style={{ padding: '0 1.2rem', marginBottom: '0.5rem', gap: '8px', background: 'transparent' }}>
              {accounts.map(acc => (
                <button
                  key={acc.id}
                  onClick={() => setSelectedAccountId(acc.id)}
                  style={{
                    flex: '0 0 auto', padding: '6px 14px', borderRadius: '18px',
                    background: selectedAccountId === acc.id ? 'var(--primary)' : '#fff',
                    border: '1px solid ' + (selectedAccountId === acc.id ? 'var(--primary)' : '#e5e5ea'),
                    color: selectedAccountId === acc.id ? 'white' : '#1c1c1e',
                    fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                    transition: 'all 0.2s'
                  }}
                >
                  {acc.name}
                </button>
              ))}
            </div>

            {/* 移除歷史紀錄區域，騰出空間給備註與日期 */}

            <div style={{ background: '#fff', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', boxShadow: '0 -8px 20px rgba(0,0,0,0.03)', padding: '1rem 1.2rem 0' }}>
              <div className="type-selector" style={{ background: '#f2f2f7', marginBottom: '0.8rem', padding: '3px' }}>
                <button className={`type-tab ${activeType === 'expense' ? 'active expense' : ''}`} style={{ padding: '6px', fontSize: '0.9rem' }} onClick={() => setActiveType('expense')}>支出</button>
                <button className={`type-tab ${activeType === 'income' ? 'active income' : ''}`} style={{ padding: '6px', fontSize: '0.9rem' }} onClick={() => setActiveType('income')}>收入</button>
              </div>

              <div className="input-display" style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '2.4rem', fontWeight: '800', color: activeType === 'income' ? 'var(--income)' : 'var(--expense)' }}>
                  ${parseInt(amount).toLocaleString()}
                </span>
              </div>

              {/* 日期與備註輸入 (Compact) */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '0.8rem' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#f2f2f7', borderRadius: '10px', padding: '6px 10px' }}>
                  <span style={{ fontSize: '1rem', marginRight: '6px' }}>📅</span>
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    style={{ border: 'none', background: 'transparent', width: '100%', fontSize: '0.9rem', color: '#1c1c1e', fontWeight: '600', outline: 'none' }}
                  />
                </div>
                <div style={{ flex: 1.5, display: 'flex', alignItems: 'center', background: '#f2f2f7', borderRadius: '10px', padding: '6px 10px' }}>
                  <span style={{ fontSize: '1rem', marginRight: '6px' }}>📝</span>
                  <input
                    type="text"
                    placeholder="備註..."
                    value={txNote}
                    onChange={(e) => setTxNote(e.target.value)}
                    style={{ border: 'none', background: 'transparent', width: '100%', fontSize: '0.85rem', color: '#1c1c1e', outline: 'none' }}
                  />
                </div>
              </div>

              <div className="category-mini-grid" style={{ marginBottom: '0.8rem' }}>
                {currentTypeCategories.map((cat) => (
                  <button key={cat.id} className={`category-item ${selectedCatId === cat.id ? "selected" : ""}`} style={{ flex: '0 0 60px' }} onClick={() => setSelectedCatId(cat.id)}>
                    <span className="category-icon" style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {cat.icon && cat.icon.startsWith('data:image') ? (
                        <img src={cat.icon} style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        cat.icon
                      )}
                    </span>
                    <span className="category-label" style={{ fontSize: '0.65rem' }}>{cat.label}</span>
                  </button>
                ))}
              </div>

              <div className="keyboard" style={{ margin: '0 -1.2rem', background: '#e5e5ea', gap: '1px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"].map((k) => (
                  <button key={k} className="key" style={{ background: '#fff', border: 'none', fontSize: '1.2rem', height: '42px', color: '#1c1c1e', fontWeight: '600' }} onClick={() => (k === "⌫" ? setAmount(p => p.length > 1 ? p.slice(0, -1) : "0") : (k === "C" ? setAmount("0") : setAmount(p => p === "0" ? k : p + k)))}>{k}</button>
                ))}
                <button className="key confirm" onClick={handleSave} style={{ background: activeType === 'income' ? 'var(--income)' : 'var(--expense)', borderRadius: '12px', fontSize: '1rem', color: '#fff', gridColumn: 'span 3', height: '44px', margin: '8px 1.2rem', fontWeight: '700', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                  {editingTx ? "確認修改" : "確認保存"}
                </button>
              </div>
            </div>
          </div>
        );

      case 'accounts':
        if (accountDetailId) {
          const acc = accounts.find(a => a.id === accountDetailId);
          if (!acc) { setAccountDetailId(null); return null; }

          const accTxs = transactions.filter(t => t.accountId === acc.id);
          const income = accTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
          const expense = accTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

          // Group by date
          const groupedByDate: Record<string, Transaction[]> = {};
          accTxs.forEach(t => {
            if (!groupedByDate[t.date]) groupedByDate[t.date] = [];
            groupedByDate[t.date].push(t);
          });
          const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

          return (
            <div className="bank-view-container" style={{ background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '10px 1.2rem', background: '#fff' }}>
                <button onClick={() => setAccountDetailId(null)} style={{ border: 'none', background: 'none', fontSize: '1.2rem' }}>❮</button>
                <h2 style={{ flex: 1, textAlign: 'center', fontSize: '1.1rem' }}>{acc.name}</h2>
                <div style={{ display: 'flex', gap: '15px' }}><span>⏳</span><span>⋯</span></div>
              </div>

              <div style={{ padding: '1.5rem 1.2rem', borderBottom: '8px solid #f2f2f7' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1.5rem' }}>帳戶餘額</p>
                    <p style={{ fontSize: '0.9rem', fontWeight: '700', color: '#000' }}>TWD</p>
                    <p style={{ fontSize: '2.5rem', fontWeight: '800' }}>{acc.balance.toLocaleString()}</p>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                      <p style={{ fontSize: '0.9rem', color: '#8e8e93' }}>收入</p>
                      <p style={{ color: '#007aff', fontWeight: '700' }}>${income.toLocaleString()}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '0.9rem', color: '#8e8e93' }}>支出</p>
                      <p style={{ color: '#ff453a', fontWeight: '700' }}>$-{expense.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '15px', borderBottom: '1px solid #f2f2f7' }}>
                <span>◀</span>
                <span style={{ margin: '0 20px', fontWeight: '600' }}>{new Date().getFullYear()}/{new Date().getMonth() + 1}/01 - {new Date().getFullYear()}/{new Date().getMonth() + 1}/28</span>
                <span>▶</span>
              </div>

              <div style={{ padding: '10px 1.2rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#8e8e93' }}>
                <span>項目 : {accTxs.length} 筆</span>
                <span>結餘 : <span style={{ color: '#ff453a' }}>$-{(expense - income).toLocaleString()}</span></span>
              </div>

              <div style={{ padding: '0 0 80px' }}>
                {sortedDates.map(date => (
                  <div key={date}>
                    <div style={{ padding: '12px 1.2rem', background: '#fff', fontSize: '1rem', fontWeight: '700', borderBottom: '1px solid #f2f2f7' }}>
                      {date} {['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][new Date(date).getDay()]}
                    </div>
                    {groupedByDate[date].map(t => {
                      const cat = categories.find(c => c.id === t.categoryId);
                      return (
                        <div key={t.id} className="history-item" style={{ padding: '12px 1.2rem', borderBottom: '1px solid #f2f2f7' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#2c2c2e', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '12px', overflow: 'hidden' }}>
                            {cat?.icon && cat.icon.startsWith('data:image') ? <img src={cat.icon} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '1.2rem' }}>{cat?.icon}</span>}
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontWeight: '700', fontSize: '1rem' }}>{cat?.label}</p>
                            <p style={{ fontSize: '0.8rem', color: '#8e8e93' }}>{acc.name}</p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ fontWeight: '700', color: t.type === 'expense' ? '#ff453a' : '#007aff' }}>
                              {t.type === 'expense' ? '$-' : '$'}{t.amount.toLocaleString()}
                            </p>
                            <p style={{ fontSize: '0.7rem', color: '#8e8e93' }}>1:1</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        }

        const totalAssets = accounts.reduce((s, a) => s + (a.balance > 0 ? a.balance : 0), 0);
        const totalLiabilities = accounts.reduce((s, a) => s + (a.balance < 0 ? Math.abs(a.balance) : 0), 0);
        const netAssets = totalAssets - totalLiabilities;
        const types = Array.from(new Set(accounts.map(a => a.type)));

        return (
          <div className="bank-view-container" style={{ background: '#f2f2f7' }}>
            <div style={{ background: '#fff', padding: '1.5rem 1.2rem', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '20px', marginBottom: '1rem' }}>
                <span>📊</span><span>+</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.8rem' }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: '800' }}>淨資產</h2>
                    <span onClick={() => setHideBalance(!hideBalance)} style={{ cursor: 'pointer', fontSize: '1.2rem' }}>{hideBalance ? '🙈' : '👁️'}</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#8e8e93', marginBottom: '5px' }}>TWD</p>
                  <p style={{ fontSize: '2.5rem', fontWeight: '800' }}>
                    {hideBalance ? '******' : netAssets.toLocaleString()}
                  </p>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div>
                    <p style={{ fontSize: '0.9rem', color: '#000', fontWeight: '600' }}>資產 ❔</p>
                    <p style={{ color: '#007aff', fontWeight: '700' }}>${hideBalance ? '***' : totalAssets.toLocaleString()}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.9rem', color: '#000', fontWeight: '600' }}>負債 ❔</p>
                    <p style={{ color: '#ff453a', fontWeight: '700' }}>$0</p>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ paddingBottom: '80px' }}>
              {types.map(type => (
                <div key={type} style={{ marginBottom: '10px' }}>
                  <div style={{ padding: '10px 1.2rem', display: 'flex', justifyContent: 'space-between', background: '#fff', borderBottom: '1px solid #f2f2f7' }}>
                    <span style={{ color: '#8e8e93', fontSize: '0.9rem' }}>{type === 'CASH' ? '現金' : type === 'SAVINGS' ? '銀行' : type}</span>
                    <span style={{ color: '#007aff', fontSize: '0.9rem', fontWeight: '600' }}>TWD {accounts.filter(a => a.type === type).reduce((s, a) => s + a.balance, 0).toLocaleString()}</span>
                  </div>
                  {accounts.filter(a => a.type === type).map(acc => (
                    <div key={acc.id} onClick={() => setAccountDetailId(acc.id)} style={{ background: '#fff', padding: '12px 1.2rem', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #f2f2f7', cursor: 'pointer' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f2f2f7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {acc.icon && acc.icon.startsWith('data:image') ? <img src={acc.icon} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '1.2rem' }}>{acc.icon}</span>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: '700', fontSize: '1.1rem' }}>{acc.name}</p>
                        <p style={{ fontSize: '0.75rem', color: '#8e8e93' }}>初始資產：$0</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontWeight: '700', fontSize: '1.1rem' }}>${hideBalance ? '***' : acc.balance.toLocaleString()}</p>
                        <p style={{ fontSize: '0.75rem', color: '#8e8e93' }}>匯率 : 1:1</p>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              <div style={{ padding: '1.5rem 1.2rem' }}>
                <button onClick={() => setAccForm({ show: true, name: '', type: 'CASH', number: '', balance: 0, icon: '💵' })} style={{ width: '100%', padding: '12px', borderRadius: '24px', border: '2px solid #007aff', background: '#fff', color: '#007aff', fontWeight: '700', fontSize: '1rem' }}>
                  + 新增帳戶
                </button>
              </div>
            </div>
          </div>
        );

      case 'reports':
        const currentSum = reportMainType === 'balance'
          ? filteredReportTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0) - filteredReportTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
          : doughnutData.total;

        return (
          <div className="bank-view-container" style={{ background: '#fff' }}>
            <div className="report-toggle-group">
              <button className={`report-toggle-btn ${reportView === 'category' ? 'active' : ''}`} onClick={() => {
                setReportView('category');
                setReportPeriod('month');
                if (reportMainType === 'balance') setReportMainType('expense'); // 分類報表不支援結餘，自動跳回支出
              }}>分類報表</button>
              <button className={`report-toggle-btn ${reportView === 'trend' ? 'active' : ''}`} onClick={() => { setReportView('trend'); setReportPeriod('month'); }}>收支趨勢</button>
            </div>

            <div className="report-main-tabs">
              <button className={`report-main-tab ${reportMainType === 'expense' ? 'active' : ''}`} onClick={() => setReportMainType('expense')}>支出</button>
              <button className={`report-main-tab ${reportMainType === 'income' ? 'active' : ''}`} onClick={() => setReportMainType('income')}>收入</button>
              {reportView === 'trend' && (
                <button className={`report-main-tab ${reportMainType === 'balance' ? 'active' : ''}`} onClick={() => setReportMainType('balance')}>結餘</button>
              )}
            </div>

            <div className="sub-filter-row">
              {reportView === 'category' ? (
                <>
                  <button className={`sub-filter-pill ${reportPeriod === 'month' ? 'active' : ''}`} onClick={() => setReportPeriod('month')}>月分類</button>
                  <button className={`sub-filter-pill ${reportPeriod === 'year' ? 'active' : ''}`} onClick={() => setReportPeriod('year')}>年分類</button>
                </>
              ) : (
                <>
                  <button className={`sub-filter-pill ${reportPeriod === 'month' ? 'active' : ''}`} onClick={() => setReportPeriod('month')}>日支出</button>
                  <button className={`sub-filter-pill ${reportPeriod === 'year' ? 'active' : ''}`} onClick={() => setReportPeriod('year')}>月支出</button>
                </>
              )}
            </div>

            <div className="date-picker-row">
              <div className="date-text">
                <button onClick={() => changeReportDate(-1)} style={{ border: 'none', background: 'none', fontSize: '1.2rem' }}>❮</button>
                <span>{reportDateStr}</span>
                <button onClick={() => changeReportDate(1)} style={{ border: 'none', background: 'none', fontSize: '1.2rem' }}>❯</button>
              </div>
              <div className="total-summary-text">
                {reportView === 'category' ? '總支出' : '月總計'}：
                <span style={{ color: currentSum < 0 ? '#ff5252' : '#1c1c1e' }}> ${currentSum.toLocaleString()}</span>
              </div>
            </div>

            {reportView === 'category' ? (
              <>
                <div className="chart-center-container">
                  <Doughnut
                    data={doughnutData}
                    options={{
                      maintainAspectRatio: false,
                      cutout: '75%',
                      plugins: { legend: { display: false }, tooltip: { enabled: true } }
                    }}
                  />
                  <div className="chart-center-info">
                    <p className="center-label">{reportMainType === 'expense' ? '總支出' : '總收入'}</p>
                    <p className="center-amount">${doughnutData.total.toLocaleString()}</p>
                  </div>
                </div>

                <div className="report-list">
                  {categories.filter(c => c.type === (reportMainType === 'balance' ? 'expense' : reportMainType)).map(c => {
                    const amount = filteredReportTransactions.filter(t => t.categoryId === c.id).reduce((s, t) => s + t.amount, 0);
                    if (amount === 0) return null;
                    return (
                      <div key={c.id} className="report-item" onClick={() => setDrilldownCatId(c.id)} style={{ cursor: 'pointer' }}>
                        <div className="report-item-color-bar" style={{ background: c.color }}></div>
                        <div className="report-item-icon-circle">{c.icon}</div>
                        <div className="report-item-info">
                          <div className="report-item-label">{c.label}</div>
                        </div>
                        <div className={`report-item-amount ${reportMainType === 'income' ? 'income' : 'expense'}`}>
                          {reportMainType === 'income' ? '+' : '-'}${amount.toLocaleString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="chart-container">
                  <Bar
                    data={barData}
                    options={{
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: '#f2f2f7' } } }
                    }}
                  />
                </div>
                <div className="report-list">
                  {/* Show summary by day/month */}
                  {barData.labels.map((label, idx) => {
                    const val = barData.datasets[0].data[idx] as number;
                    if (val === 0) return null;
                    return (
                      <div key={label} className="report-item" onClick={() => {
                        // For trend, we can also jump to daily detail or direct edit
                        const dayTxs = filteredReportTransactions.filter(t => new Date(t.id).getDate() === parseInt(label));
                        if (dayTxs.length > 0) {
                          setDrilldownCatId(`day_${label}`);
                        }
                      }} style={{ cursor: 'pointer' }}>
                        <div className="report-item-color-bar" style={{ background: '#ffb74d' }}></div>
                        <div className="report-item-info">
                          <div className="report-item-label">{reportDate.getFullYear()}/{reportDate.getMonth() + 1}/{label.replace('日', '')}</div>
                        </div>
                        <div className="report-item-amount expense">${val.toLocaleString()}</div>
                      </div>
                    );
                  }).reverse()}
                </div>
              </>
            )}
            <div style={{ height: '100px' }}></div>
          </div>
        );

      case 'maintenance':
        return (
          <div className="bank-view-container">
            <header className="bank-header"><h1>設定與維護</h1></header>

            <div className="bank-card" style={{ borderRadius: '20px' }}>
              <h3 style={{ marginBottom: '1.2rem', fontSize: '1.1rem' }}>我的帳戶</h3>
              {accounts.map(acc => (
                <div key={acc.id} className="info-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f2f2f7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {acc.icon && acc.icon.startsWith('data:image') ? (
                        <img src={acc.icon} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        acc.icon
                      )}
                    </div>
                    <span>{acc.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => setAccForm({ ...acc, show: true, icon: acc.icon || "🏦" })} style={{ color: '#007aff', fontWeight: '600', border: 'none', background: 'none' }}>編輯</button>
                    <button onClick={() => setAccounts(p => p.filter(a => a.id !== acc.id))} style={{ color: '#ff453a', fontWeight: '600', border: 'none', background: 'none' }}>刪除</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bank-card" style={{ borderRadius: '20px' }}>
              <h3 style={{ marginBottom: '1.2rem', fontSize: '1.1rem' }}>分類設定 ({activeType === 'expense' ? '支出' : '收入'})</h3>
              <div className="type-selector" style={{ background: '#f2f2f7', marginBottom: '1.2rem' }}>
                <button className={`type-tab ${activeType === 'expense' ? 'active expense' : ''}`} onClick={() => setActiveType('expense')}>支出</button>
                <button className={`type-tab ${activeType === 'income' ? 'active income' : ''}`} onClick={() => setActiveType('income')}>收入</button>
              </div>
              {categories.filter(c => c.type === (activeType === 'transfer' ? 'expense' : activeType)).map(c => (
                <div key={c.id} className="info-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f2f2f7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {c.icon && c.icon.startsWith('data:image') ? (
                        <img src={c.icon} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        c.icon
                      )}
                    </div>
                    <span>{c.label}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => setCatForm({ ...c, show: true })} style={{ color: '#007aff', fontWeight: '600', border: 'none', background: 'none' }}>編輯</button>
                    <button onClick={() => setCategories(p => p.filter(cat => cat.id !== c.id))} style={{ color: '#ff453a', fontWeight: '600', border: 'none', background: 'none' }}>刪除</button>
                  </div>
                </div>
              ))}
              <button className="bank-button-primary" onClick={() => setCatForm({ show: true, type: activeType as any, label: '', icon: '✨' })} style={{ marginTop: '1.5rem', background: '#333' }}>+ 新增分類</button>
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
              <h1>交易明細</h1>
            </header>
            <div className="bank-card" style={{ marginTop: '2rem', borderRadius: '32px', padding: '2rem 1.5rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                <div style={{ fontSize: '4rem', marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
                  {cat?.icon && cat.icon.startsWith('data:image') ? (
                    <img src={cat.icon} style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    cat?.icon
                  )}
                </div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: '600', color: '#8e8e93', marginBottom: '0.5rem' }}>{cat?.label}</h2>
                <p style={{ color: selectedTx.type === 'expense' ? '#ff453a' : '#32d74b', fontSize: '2.8rem', fontWeight: '800' }}>
                  {selectedTx.type === 'expense' ? '-' : '+'}${selectedTx.amount.toLocaleString()}
                </p>
              </div>

              <div style={{ background: '#f2f2f7', borderRadius: '20px', padding: '8px 16px' }}>
                <div className="info-row">
                  <span className="info-label">支出帳戶</span>
                  <span className="info-value">{accounts.find(a => a.id === selectedTx.accountId)?.name}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">交易日期</span>
                  <span className="info-value">{selectedTx.date}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">交易時間</span>
                  <span className="info-value">{selectedTx.time}</span>
                </div>
                <div className="info-row" style={{ border: 'none' }}>
                  <span className="info-label">狀態</span>
                  <span className="info-value" style={{ color: '#32d74b' }}>{selectedTx.status}</span>
                </div>
              </div>
            </div>

            <div style={{ padding: '0 1.2rem', marginTop: '1rem' }}>
              <button className="bank-button-primary" style={{ background: '#fff', color: '#e64a19', border: '1px solid #e64a19' }}>下載電子交易證明</button>
              <button className="bank-button-primary" onClick={() => { setTransactions(p => p.filter(t => t.id !== selectedTx.id)); setCurrentScreen('main'); }} style={{ background: '#333' }}>刪除此筆交易紀錄</button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="app-container" style={{ background: '#f2f2f7' }}>
      <div style={{ height: 'calc(100vh - 65px)', overflow: 'hidden' }}>
        {renderScreen()}
      </div>

      {/* 底部導航欄 (V5) */}
      <nav className="tab-bar">
        <div className={`tab-item ${currentScreen === 'main' ? 'active' : ''}`} onClick={() => { setCurrentScreen('main'); setSelectedTx(null); }}>
          <span className="tab-icon">🏠</span>
          <span className="tab-label">首頁</span>
        </div>
        <div className={`tab-item ${currentScreen === 'accounts' ? 'active' : ''}`} onClick={() => { setCurrentScreen('accounts'); setSelectedTx(null); }}>
          <span className="tab-icon">👛</span>
          <span className="tab-label">帳戶</span>
        </div>

        <div className="floating-tab-center">
          <button className="floating-add-btn" onClick={() => setCurrentScreen('main')}>+</button>
        </div>

        <div className={`tab-item ${currentScreen === 'reports' ? 'active report' : ''}`} onClick={() => { setCurrentScreen('reports'); setSelectedTx(null); }}>
          <span className="tab-icon">📈</span>
          <span className="tab-label">報表</span>
        </div>
        <div className={`tab-item ${currentScreen === 'maintenance' ? 'active' : ''}`} onClick={() => { setCurrentScreen('maintenance'); setSelectedTx(null); }}>
          <span className="tab-icon">⚙️</span>
          <span className="tab-label">維護</span>
        </div>
      </nav>

      {/* Drilldown Modal (Transactions for Category/Day) */}
      {drilldownCatId && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ background: '#f2f2f7', padding: '1.5rem', maxHeight: '80vh', overflowY: 'auto', borderRadius: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.2rem' }}>交易明細</h2>
              <button onClick={() => setDrilldownCatId(null)} style={{ border: 'none', background: 'none', fontSize: '1.5rem' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredReportTransactions.filter(t =>
                drilldownCatId.startsWith('day_')
                  ? new Date(t.id).getDate() === parseInt(drilldownCatId.replace('day_', ''))
                  : t.categoryId === drilldownCatId && t.type === reportMainType
              ).length === 0 ? <p style={{ textAlign: 'center', color: '#8e8e93' }}>查無資料</p> : null}

              {filteredReportTransactions.filter(t =>
                drilldownCatId.startsWith('day_')
                  ? new Date(t.id).getDate() === parseInt(drilldownCatId.replace('day_', ''))
                  : t.categoryId === drilldownCatId && t.type === reportMainType
              ).map(t => {
                const cat = categories.find(c => c.id === t.categoryId);
                return (
                  <div key={t.id} className="history-item" onClick={() => {
                    setEditingTx(t);
                    setAmount(t.amount.toString());
                    setTxDate(t.date);
                    setTxNote(t.note || "");
                    setActiveType(t.type as any);
                    setSelectedCatId(t.categoryId);
                    setSelectedAccountId(t.accountId);
                    setCurrentScreen('main');
                    setDrilldownCatId(null);
                  }} style={{ background: '#fff', borderRadius: '16px', padding: '12px 16px', cursor: 'pointer' }}>
                    <div className="history-item-icon" style={{ background: '#f2f2f7', width: '40px', height: '40px', borderRadius: '12px', fontSize: '1.2rem' }}>{cat?.icon || "❓"}</div>
                    <div className="history-item-info">
                      <div className="history-item-label" style={{ fontSize: '0.95rem', fontWeight: '600' }}>{cat?.label}</div>
                      <div className="history-item-time" style={{ fontSize: '0.75rem', color: '#8e8e93' }}>{t.date} {t.note ? `· ${t.note}` : ''}</div>
                    </div>
                    <div className={`history-item-amount ${t.type}`} style={{ fontWeight: '700' }}>
                      ${t.amount.toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 彈窗與表單 */}
      {catForm?.show && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ background: '#fff', borderRadius: '32px' }}>
            <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>{catForm.id ? '編輯分類' : '新增分類'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input type="text" placeholder="名稱" value={catForm.label} onChange={e => setCatForm({ ...catForm, label: e.target.value })} style={{ width: '100%', padding: '14px', background: '#f2f2f7', border: 'none', borderRadius: '16px', fontSize: '1rem' }} />

              <div style={{ background: '#f2f2f7', borderRadius: '16px', padding: '14px' }}>
                <p style={{ fontSize: '0.8rem', color: '#8e8e93', marginBottom: '10px' }}>選取推薦圖示 ({catForm.type === 'expense' ? '支出' : '收入'})</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', maxHeight: '180px', overflowY: 'auto', padding: '5px' }}>
                  {(catForm.type === 'expense' ? EXPENSE_ICONS : INCOME_ICONS).map(icon => (
                    <button
                      key={icon}
                      onClick={() => setCatForm({ ...catForm, icon })}
                      style={{
                        fontSize: '1.5rem',
                        background: catForm.icon === icon ? '#fff' : 'transparent',
                        border: catForm.icon === icon ? '2px solid var(--primary)' : 'none',
                        borderRadius: '12px',
                        padding: '8px',
                        cursor: 'pointer',
                        boxShadow: catForm.icon === icon ? '0 4px 10px rgba(0,0,0,0.1)' : 'none'
                      }}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ background: '#f2f2f7', borderRadius: '16px', padding: '14px', textAlign: 'center' }}>
                <p style={{ fontSize: '0.8rem', color: '#8e8e93', marginBottom: '10px' }}>自定義圖片圖示</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', justifyContent: 'center' }}>
                  <div style={{ width: '50px', height: '50px', background: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '2px solid #e5e5ea' }}>
                    {catForm.icon && catForm.icon.startsWith('data:image') ? (
                      <img src={catForm.icon} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '1.5rem' }}>{catForm.icon}</span>
                    )}
                  </div>
                  <label style={{ background: 'var(--primary)', color: 'white', padding: '8px 16px', borderRadius: '12px', fontSize: '0.9rem', cursor: 'pointer', fontWeight: '600' }}>
                    上傳圖片
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            if (catForm) setCatForm({ ...catForm, icon: reader.result as string });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '2rem' }}>
              <button className="bank-button-primary" style={{ background: '#eee', color: '#333', margin: 0, flex: 1 }} onClick={() => setCatForm(null)}>取消</button>
              <button className="bank-button-primary" style={{ margin: 0, flex: 1 }} onClick={handleSaveCategory}>儲存</button>
            </div>
          </div>
        </div>
      )}

      {accForm?.show && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ background: '#fff', borderRadius: '32px' }}>
            <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>{accForm.id ? '編輯帳戶' : '新增帳戶'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input type="text" placeholder="帳戶名稱" value={accForm.name} onChange={e => setAccForm({ ...accForm, name: e.target.value })} style={{ width: '100%', padding: '14px', background: '#f2f2f7', border: 'none', borderRadius: '16px', fontSize: '1rem' }} />
              <input type="text" placeholder="類型 (例如: 現金, 往來戶口)" value={accForm.type} onChange={e => setAccForm({ ...accForm, type: e.target.value })} style={{ width: '100%', padding: '14px', background: '#f2f2f7', border: 'none', borderRadius: '16px', fontSize: '1rem' }} />
              <input type="number" placeholder="初始餘額" value={accForm.balance} onChange={e => setAccForm({ ...accForm, balance: parseInt(e.target.value) || 0 })} style={{ width: '100%', padding: '14px', background: '#f2f2f7', border: 'none', borderRadius: '16px', fontSize: '1rem' }} />

              <div style={{ background: '#f2f2f7', borderRadius: '16px', padding: '14px' }}>
                <p style={{ fontSize: '0.8rem', color: '#8e8e93', marginBottom: '10px' }}>選取預設圖示</p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  {ACCOUNT_ICONS.map(icon => (
                    <button
                      key={icon}
                      onClick={() => setAccForm({ ...accForm, icon })}
                      style={{
                        fontSize: '1.5rem',
                        background: accForm.icon === icon ? '#fff' : 'transparent',
                        border: accForm.icon === icon ? '2px solid var(--primary)' : 'none',
                        borderRadius: '12px',
                        padding: '8px',
                        cursor: 'pointer'
                      }}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ background: '#f2f2f7', borderRadius: '16px', padding: '14px', textAlign: 'center' }}>
                <p style={{ fontSize: '0.8rem', color: '#8e8e93', marginBottom: '10px' }}>自定義帳戶圖片</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', justifyContent: 'center' }}>
                  <div style={{ width: '45px', height: '45px', background: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid #e5e5ea' }}>
                    {accForm.icon && accForm.icon.startsWith('data:image') ? (
                      <img src={accForm.icon} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '1.2rem' }}>{accForm.icon || "🏦"}</span>
                    )}
                  </div>
                  <label style={{ background: '#333', color: 'white', padding: '6px 12px', borderRadius: '10px', fontSize: '0.8rem', cursor: 'pointer' }}>
                    上傳
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            if (accForm) setAccForm({ ...accForm, icon: reader.result as string });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
              <button className="bank-button-primary" style={{ background: '#eee', color: '#333', margin: 0, flex: 1 }} onClick={() => setAccForm(null)}>取消</button>
              <button className="bank-button-primary" style={{ margin: 0, flex: 1 }} onClick={handleSaveAccount}>儲存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
