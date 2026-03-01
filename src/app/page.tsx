"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title } from 'chart.js';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import { Category, Transaction, Account, RecurringTemplate, INITIAL_EXPENSE_CATEGORIES, INITIAL_INCOME_CATEGORIES, INITIAL_ACCOUNTS } from "./types";
import {
  isFileSystemAccessSupported,
  pickBackupFolder,
  getSavedFolderName,
  clearBackupFolder,
  backupToFolder,
  listBackupFiles,
  readBackupFile,
  downloadBackupFallback,
} from "./hooks/useBackup";

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title);

type AppScreen = 'main' | 'accounts' | 'reports' | 'maintenance' | 'tx_detail' | 'report_detail';

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
  const [selectedAccountId, setSelectedAccountId] = useState("");

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>(INITIAL_ACCOUNTS);
  const [recurringTemplates, setRecurringTemplates] = useState<RecurringTemplate[]>([]);
  const [recurringForm, setRecurringForm] = useState<Partial<RecurringTemplate> | null>(null);

  // Home Input States (NEW)
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [txNote, setTxNote] = useState("");
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // Account Detail & Privacy
  const [accountDetailId, setAccountDetailId] = useState<string | null>(null);
  const [hideBalance, setHideBalance] = useState(false);

  // Report States (V5 New)
  const [reportView, setReportView] = useState<'category' | 'trend' | 'advanced' | 'budget'>('category');
  const [reportMainType, setReportMainType] = useState<'expense' | 'income' | 'balance' | 'transfer'>('expense');
  const [reportPeriod, setReportPeriod] = useState<'day' | 'month' | 'year'>('month'); // category: month/year, trend: day/month
  const [reportDate, setReportDate] = useState(new Date());

  // 進階分析 state
  const [advancedSubView, setAdvancedSubView] = useState<'prediction' | 'ranking' | 'custom'>('prediction');
  const [rankingTopN, setRankingTopN] = useState(5);
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split('T')[0];
  });
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().split('T')[0]);

  // Reporting/Detail States
  const [reportDetailId, setReportDetailId] = useState<string | null>(null);

  // Transfer States
  const [transferToAccountId, setTransferToAccountId] = useState("acc_2");
  const [transferFee, setTransferFee] = useState("0");

  // Forms for Maintenance
  const [catForm, setCatForm] = useState<{ show: boolean, type: 'income' | 'expense', label: string, icon: string, id?: string, budget?: number } | null>(null);
  const [accForm, setAccForm] = useState<{ show: boolean, name: string, type: string, number: string, balance: number, icon: string, id?: string } | null>(null);

  // Backup States
  const [backupFolderName, setBackupFolderName] = useState<string | null>(null);
  const [backupStatus, setBackupStatus] = useState<{ type: 'success' | 'error' | 'info' | null; msg: string }>({ type: null, msg: '' });
  const [backupFiles, setBackupFiles] = useState<string[] | null>(null);
  const [showRestorePanel, setShowRestorePanel] = useState(false);
  const [isBackupLoading, setIsBackupLoading] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const { getCurrentUserId } = require('./components/AppShell');
    const uid = getCurrentUserId();
    const savedTransactions = localStorage.getItem(`qm_${uid}_transactions_v3`) || localStorage.getItem("qm_transactions_v3");
    const savedCategories = localStorage.getItem(`qm_${uid}_categories`) || localStorage.getItem("qm_categories");
    const savedAccounts = localStorage.getItem(`qm_${uid}_accounts`) || localStorage.getItem("qm_accounts");
    const savedRecurring = localStorage.getItem(`qm_${uid}_recurring`) || localStorage.getItem("qm_recurring");

    if (savedTransactions) setTransactions(JSON.parse(savedTransactions));
    if (savedCategories) setCategories(JSON.parse(savedCategories));
    else {
      const initialCats = [...INITIAL_EXPENSE_CATEGORIES, ...INITIAL_INCOME_CATEGORIES];
      setCategories(initialCats);
    }
    if (savedAccounts) {
      const parsed: Account[] = JSON.parse(savedAccounts);
      setAccounts(parsed);
      if (parsed.length > 0) setSelectedAccountId(parsed[0].id);
    } else {
      // 使用預設帳戶時，同步設定 selectedAccountId
      setSelectedAccountId(INITIAL_ACCOUNTS[0]?.id || "");
    }
    if (savedRecurring) setRecurringTemplates(JSON.parse(savedRecurring));
    // 載入已儲存的備份資料夾名稱
    getSavedFolderName().then(name => setBackupFolderName(name)).catch(() => { });
  }, []);

  // ── 定期收支自動生成邏輯 ────────────────────────────────────────────────
  useEffect(() => {
    if (!isMounted || recurringTemplates.length === 0) return;

    const todayStr = new Date().toISOString().split('T')[0];
    let hasChanges = false;
    const newTxs: Transaction[] = [];
    const updatedTemplates = recurringTemplates.map(tpl => {
      if (!tpl.active) return tpl;

      const lastDate = new Date(tpl.lastGenerated);
      const todayDate = new Date(todayStr);
      let shouldGen = false;

      if (tpl.frequency === 'daily') {
        shouldGen = todayDate > lastDate;
      } else if (tpl.frequency === 'weekly') {
        const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));
        const targetDay = tpl.executionDay ?? todayDate.getDay(); // 未設定則任意一天
        shouldGen = diffDays >= 6 && todayDate.getDay() === targetDay && todayDate > lastDate;
      } else if (tpl.frequency === 'monthly') {
        const targetDate = tpl.executionDay ?? todayDate.getDate(); // 未設定則任意一天
        const diffMonth = todayDate.getMonth() !== lastDate.getMonth() || todayDate.getFullYear() !== lastDate.getFullYear();
        shouldGen = diffMonth && todayDate.getDate() === targetDate;
      }

      if (shouldGen) {
        hasChanges = true;
        const newId = Date.now() + Math.random();
        newTxs.push({
          id: newId,
          amount: tpl.amount,
          type: tpl.type,
          categoryId: tpl.categoryId,
          accountId: tpl.accountId,
          date: todayStr.replace(/-/g, '/'),
          time: "08:00",
          note: `[定期] ${tpl.label}`,
          status: "已完成"
        });
        return { ...tpl, lastGenerated: todayStr };
      }
      return tpl;
    });

    if (hasChanges) {
      setTransactions(prev => [...newTxs, ...prev]);
      setRecurringTemplates(updatedTemplates);
    }
  }, [isMounted, recurringTemplates]);

  useEffect(() => {
    if (!isMounted) return;
    const { getCurrentUserId } = require('./components/AppShell');
    const uid = getCurrentUserId();
    localStorage.setItem(`qm_${uid}_transactions_v3`, JSON.stringify(transactions));
    localStorage.setItem(`qm_${uid}_categories`, JSON.stringify(categories));
    localStorage.setItem(`qm_${uid}_accounts`, JSON.stringify(accounts));
    localStorage.setItem(`qm_${uid}_recurring`, JSON.stringify(recurringTemplates));
  }, [transactions, categories, accounts, recurringTemplates, isMounted]);

  // ── 備份相關函式 ────────────────────────────────────────────────────
  const getBackupData = useCallback(() => ({
    version: 3,
    exportedAt: new Date().toISOString(),
    transactions,
    categories,
    accounts,
    recurringTemplates,
  }), [transactions, categories, accounts, recurringTemplates]);

  const handlePickFolder = useCallback(async () => {
    try {
      const result = await pickBackupFolder();
      if (result) {
        setBackupFolderName(result.name);
        setBackupStatus({ type: 'success', msg: `✅ 已設定資料夾：${result.name}` });
      }
    } catch (e: any) {
      if (e.name === 'AbortError') return; // 使用者取消
      if (e.message === 'NOT_SUPPORTED') {
        setBackupStatus({ type: 'error', msg: '⚠️ 此瀏覽器不支援資料夾選取，請使用 Chrome/Edge' });
      } else {
        setBackupStatus({ type: 'error', msg: `❌ 設定失敗：${e.message}` });
      }
    }
  }, []);

  const handleBackupNow = useCallback(async () => {
    setIsBackupLoading(true);
    setBackupStatus({ type: null, msg: '' });
    try {
      if (isFileSystemAccessSupported() && backupFolderName) {
        const filename = await backupToFolder(getBackupData());
        setBackupStatus({ type: 'success', msg: `✅ 備份成功：${filename}` });
      } else {
        // Fallback：直接下載
        downloadBackupFallback(getBackupData());
        setBackupStatus({ type: 'info', msg: '📥 備份已下載，請手動移至 iCloud Drive' });
      }
    } catch (e: any) {
      if (e.message === 'NO_FOLDER') {
        setBackupStatus({ type: 'error', msg: '❌ 請先設定備份資料夾' });
      } else if (e.message === 'PERMISSION_DENIED') {
        setBackupStatus({ type: 'error', msg: '❌ 資料夾存取被拒，請重新設定' });
      } else {
        setBackupStatus({ type: 'error', msg: `❌ 備份失敗：${e.message}` });
      }
    } finally {
      setIsBackupLoading(false);
    }
  }, [backupFolderName, getBackupData]);

  const handleShowRestoreList = useCallback(async () => {
    setIsBackupLoading(true);
    try {
      const files = await listBackupFiles();
      setBackupFiles(files);
      setShowRestorePanel(true);
    } catch (e: any) {
      if (e.message === 'NO_FOLDER') {
        setBackupStatus({ type: 'error', msg: '❌ 請先設定備份資料夾' });
      } else {
        setBackupStatus({ type: 'error', msg: `❌ 讀取失敗：${e.message}` });
      }
    } finally {
      setIsBackupLoading(false);
    }
  }, []);

  const handleRestoreFile = useCallback(async (filename: string) => {
    if (!window.confirm(`確定從 「${filename}」 還原？目前資料將被覆蓋。`)) return;
    setIsBackupLoading(true);
    try {
      const data = await readBackupFile(filename);
      if (data.transactions) setTransactions(data.transactions);
      if (data.categories) setCategories(data.categories);
      if (data.accounts) setAccounts(data.accounts);
      setShowRestorePanel(false);
      setBackupStatus({ type: 'success', msg: `✅ 已從 ${filename} 還原` });
    } catch (e: any) {
      setBackupStatus({ type: 'error', msg: `❌ 還原失敗：${e.message}` });
    } finally {
      setIsBackupLoading(false);
    }
  }, []);

  const handleClearFolder = useCallback(async () => {
    await clearBackupFolder();
    setBackupFolderName(null);
    setShowRestorePanel(false);
    setBackupFiles(null);
    setBackupStatus({ type: 'info', msg: '已清除備份資料夾設定' });
  }, []);

  // 從任意 JSON 檔案還原（file input picker，支援 Safari／所有瀏覽器）
  const handleRestoreFromFile = useCallback((file: File) => {
    if (!window.confirm(`確定從「${file.name}」還原？目前資料將被覆蓋。`)) return;
    setIsBackupLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.transactions) setTransactions(data.transactions);
        if (data.categories) setCategories(data.categories);
        if (data.accounts) setAccounts(data.accounts);
        setBackupStatus({ type: 'success', msg: `✅ 已從「${file.name}」成功還原` });
      } catch {
        setBackupStatus({ type: 'error', msg: '❌ 檔案格式錯誤，請選取正確的備份 JSON 檔' });
      } finally {
        setIsBackupLoading(false);
      }
    };
    reader.onerror = () => {
      setBackupStatus({ type: 'error', msg: '❌ 讀取檔案失敗' });
      setIsBackupLoading(false);
    };
    reader.readAsText(file);
  }, []);

  useEffect(() => {
    const typeCats = categories.filter(c => c.type === (activeType === 'transfer' ? 'expense' : activeType));
    if (typeCats.length > 0 && (!selectedCatId || !typeCats.find(c => c.id === selectedCatId))) {
      setSelectedCatId(typeCats[0].id);
    }
  }, [activeType, categories, selectedCatId]);

  // Sync edit mode states
  useEffect(() => {
    if (editingTx) {
      setAmount(editingTx.amount.toString());
      setTxNote(editingTx.note || "");
      // Ensure date format is YYYY-MM-DD for the input[type=date]
      if (editingTx.date) {
        setTxDate(editingTx.date.replace(/\//g, '-'));
      }
      setActiveType(editingTx.type);
      setSelectedCatId(editingTx.categoryId);
      setSelectedAccountId(editingTx.accountId);
      if (editingTx.type === 'transfer' && editingTx.toAccountId) {
        setTransferToAccountId(editingTx.toAccountId);
      }
    }
  }, [editingTx]);

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

    if (reportMainType === 'transfer') {
      // 轉帳：以轉出帳戶名稱分組
      const filtered = filteredReportTransactions.filter(t => t.type === 'transfer');
      filtered.forEach(t => {
        const key = t.accountId;
        dataMap[key] = (dataMap[key] || 0) + t.amount;
      });
      const accountKeys = Object.keys(dataMap);
      const COLORS = ['#5856d6', '#007aff', '#34c759', '#ff9500', '#ff453a', '#af52de', '#ff2d55', '#00c7be'];
      return {
        labels: accountKeys.map(id => accounts.find(a => a.id === id)?.name || id),
        datasets: [{
          data: accountKeys.map(k => dataMap[k]),
          backgroundColor: accountKeys.map((_, i) => COLORS[i % COLORS.length]),
          borderWidth: 0,
          hoverOffset: 4
        }],
        total: filtered.reduce((s, t) => s + t.amount, 0)
      };
    }

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
  }, [filteredReportTransactions, categories, accounts, reportMainType]);

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

  const handleExportCSV = useCallback(() => {
    try {
      // 標題行
      const headers = ["日期", "時間", "類型", "類別", "帳戶", "金額", "備註", "狀態"];

      // 資料列
      const rows = transactions.map(t => {
        const cat = categories.find(c => c.id === t.categoryId);
        const acc = accounts.find(a => a.id === t.accountId);
        const typeStr = t.type === 'expense' ? '支出' : (t.type === 'income' ? '收入' : '轉帳');

        return [
          t.date,
          t.time,
          typeStr,
          cat?.label || '未知',
          acc?.name || '未知',
          t.amount,
          `"${(t.note || '').replace(/"/g, '""')}"`, // 處理備註中的引號
          t.status
        ].join(",");
      });

      const csvContent = [headers.join(","), ...rows].join("\n");

      // 加入 UTF-8 BOM (\uFEFF) 確保 Excel 開啟時顯示正確中文
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const now = new Date();
      const filename = `quick-money-export-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}.csv`;

      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Export CSV failed:", err);
      alert("匯出失敗，請重試");
    }
  }, [transactions, categories, accounts]);

  const handleSaveRecurring = () => {
    if (!recurringForm || !recurringForm.label || !recurringForm.amount) return;
    const tpl: RecurringTemplate = {
      id: recurringForm.id || `rec_${Date.now()}`,
      label: recurringForm.label!,
      amount: recurringForm.amount!,
      type: recurringForm.type as any || 'expense',
      categoryId: recurringForm.categoryId || categories.find(c => c.type === (recurringForm.type || 'expense'))?.id || '',
      accountId: recurringForm.accountId || accounts[0].id,
      frequency: recurringForm.frequency || 'monthly',
      executionDay: recurringForm.executionDay,
      lastGenerated: recurringForm.lastGenerated || new Date().toISOString().split('T')[0],
      active: recurringForm.active ?? true,
    };

    if (recurringForm.id) {
      setRecurringTemplates(prev => prev.map(p => p.id === tpl.id ? tpl : p));
    } else {
      setRecurringTemplates(prev => [...prev, tpl]);
    }
    setRecurringForm(null);
  };

  const handleSave = () => {
    const numAmount = parseInt(amount);
    if (numAmount === 0) return;

    // 防止同帳戶轉帳
    if (activeType === 'transfer' && selectedAccountId === transferToAccountId) {
      alert('轉出帳戶與轉入帳戶不能相同！');
      return;
    }

    const now = new Date();
    if (editingTx) {
      // 處理編輯模式 (暫不處理編輯過往轉帳的複雜餘額抵銷，直接更新紀錄)
      const updatedTx: Transaction = {
        ...editingTx,
        amount: numAmount,
        type: activeType as any,
        categoryId: selectedCatId,
        accountId: selectedAccountId,
        toAccountId: activeType === 'transfer' ? transferToAccountId : undefined,
        fee: activeType === 'transfer' ? parseInt(transferFee) : undefined,
        date: txDate,
        note: txNote
      };
      setTransactions(prev => prev.map(t => t.id === editingTx.id ? updatedTx : t));

      // 餘額修正邏輯 (簡化版：僅針對當前選中帳戶)
      setAccounts(prev => prev.map(a => {
        if (a.id === selectedAccountId) {
          const diff = editingTx.type === 'income' ? numAmount - editingTx.amount : editingTx.amount - numAmount;
          return { ...a, balance: a.balance + diff };
        }
        return a;
      }));
      setEditingTx(null);
    } else {
      // 新增模式
      if (activeType === 'transfer') {
        const fee = parseInt(transferFee) || 0;
        const newTx: Transaction = {
          id: now.getTime(),
          amount: numAmount,
          type: 'transfer',
          categoryId: selectedCatId || 'transfer',
          accountId: selectedAccountId,
          toAccountId: transferToAccountId,
          fee: fee,
          date: txDate,
          time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          note: txNote,
          status: '已完成'
        };

        setTransactions(prev => [newTx, ...prev]);
        setAccounts(prev => prev.map(a => {
          if (a.id === selectedAccountId) return { ...a, balance: a.balance - numAmount - fee };
          if (a.id === transferToAccountId) return { ...a, balance: a.balance + numAmount };
          return a;
        }));
      } else {
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

    }

    setAmount("0");
    setTxNote("");
    setTransferFee("0");
    setTxDate(new Date().toISOString().split('T')[0]);
    if (window.navigator.vibrate) window.navigator.vibrate([10]);
  };

  const handleDeleteTransaction = (txToDelete: Transaction) => {
    if (!window.confirm("確定要刪除這筆紀錄嗎？")) return;

    setAccounts(prev => prev.map(a => {
      if (txToDelete.type === 'transfer') {
        const fee = txToDelete.fee || 0;
        if (a.id === txToDelete.accountId) return { ...a, balance: a.balance + txToDelete.amount + fee };
        if (a.id === txToDelete.toAccountId) return { ...a, balance: a.balance - txToDelete.amount };
      } else {
        if (a.id === txToDelete.accountId) {
          return { ...a, balance: txToDelete.type === 'income' ? a.balance - txToDelete.amount : a.balance + txToDelete.amount };
        }
      }
      return a;
    }));

    setTransactions(prev => prev.filter(t => t.id !== txToDelete.id));
    if (editingTx?.id === txToDelete.id) {
      setEditingTx(null);
      setAmount("0");
      setTxNote("");
      setTransferFee("0");
    }
  };

  const handleDeleteAccount = (accId: string) => {
    const relatedTxCount = transactions.filter(t => t.accountId === accId || t.toAccountId === accId).length;
    const msg = relatedTxCount > 0
      ? `確定刪除此帳戶？\n相關的 ${relatedTxCount} 筆交易紀錄將一同刪除，此操作無法復原。`
      : `確定要刪除此帳戶？`;
    if (!window.confirm(msg)) return;

    setTransactions(prev => prev.filter(t => t.accountId !== accId && t.toAccountId !== accId));
    setAccounts(prev => {
      const remaining = prev.filter(a => a.id !== accId);
      if (selectedAccountId === accId && remaining.length > 0) {
        setSelectedAccountId(remaining[0].id);
      }
      return remaining;
    });
  };

  const handleSaveCategory = () => {
    if (!catForm || !catForm.label) return;
    if (catForm.id) {
      setCategories(prev => prev.map(c => c.id === catForm.id ? { ...c, label: catForm.label, icon: catForm.icon, budget: catForm.budget } : c));
    } else {
      const newCat: Category = {
        id: Date.now().toString(),
        label: catForm.label,
        icon: catForm.icon || "✨",
        color: "#" + Math.floor(Math.random() * 16777215).toString(16),
        type: catForm.type,
        budget: catForm.budget
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
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleDeleteTransaction(editingTx)} style={{ color: 'white', background: '#ff453a', border: 'none', borderRadius: '8px', padding: '2px 8px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}><span>🗑️</span> 刪除</button>
                        <button onClick={() => { setEditingTx(null); setAmount("0"); setTxNote(""); }} style={{ color: 'white', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', padding: '2px 8px', fontSize: '0.7rem' }}>取消</button>
                      </div>
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

            <div style={{ background: '#fff', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', boxShadow: '0 -8px 20px rgba(0,0,0,0.03)', padding: '1rem 0 0', flex: 1, display: 'flex', flexDirection: 'column' }}>
              {/* 帳戶選擇列 (恢復並優化) */}
              <div style={{ padding: '0 1.2rem', marginBottom: '1rem' }}>
                <p style={{ fontSize: '0.75rem', color: '#8e8e93', marginBottom: '8px', fontWeight: '700' }}>選擇帳戶</p>
                <div className="category-mini-grid" style={{ gap: '8px' }}>
                  {accounts.map(acc => (
                    <button
                      key={acc.id}
                      onClick={() => setSelectedAccountId(acc.id)}
                      style={{
                        flex: '0 0 auto',
                        padding: '8px 16px',
                        borderRadius: '12px',
                        background: selectedAccountId === acc.id ? 'var(--primary)' : '#f2f2f7',
                        border: 'none',
                        color: selectedAccountId === acc.id ? 'white' : '#1c1c1e',
                        fontSize: '0.85rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <span>{acc.icon && !acc.icon.startsWith('data') ? acc.icon : '💰'}</span>
                      {acc.name}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ padding: '0 1.2rem' }}>
                <div className="type-selector" style={{ background: '#f2f2f7', marginBottom: '0.8rem', padding: '3px' }}>
                  <button className={`type-tab ${activeType === 'expense' ? 'active expense' : ''}`} style={{ padding: '6px', fontSize: '0.9rem' }} onClick={() => setActiveType('expense')}>支出</button>
                  <button className={`type-tab ${activeType === 'income' ? 'active income' : ''}`} style={{ padding: '6px', fontSize: '0.9rem' }} onClick={() => setActiveType('income')}>收入</button>
                  <button className={`type-tab ${activeType === 'transfer' ? 'active transfer' : ''}`} style={{ padding: '6px', fontSize: '0.9rem' }} onClick={() => setActiveType('transfer')}>轉帳</button>
                </div>

                {activeType === 'transfer' ? (
                  <div style={{ marginBottom: '1.2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8f9fa', borderRadius: '16px', padding: '15px', border: '1px solid #e9ecef' }}>
                      <div style={{ textAlign: 'center', flex: 1 }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#ff9500', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', color: '#fff' }}>
                          {accounts.find(a => a.id === selectedAccountId)?.icon || "💰"}
                        </div>
                        <p style={{ fontSize: '0.75rem', color: '#8e8e93' }}>轉出帳戶</p>
                        <p style={{ fontSize: '0.85rem', fontWeight: '700' }}>{accounts.find(a => a.id === selectedAccountId)?.name}</p>
                        <p style={{ fontSize: '1.1rem', fontWeight: '800', marginTop: '4px', color: '#ff453a' }}>${parseInt(amount).toLocaleString()}</p>
                      </div>

                      <div style={{ fontSize: '1.5rem', color: '#adb5bd', padding: '0 10px' }}>⇄</div>

                      <div style={{ textAlign: 'center', flex: 1, cursor: 'pointer' }} onClick={() => {
                        const idx = accounts.findIndex(a => a.id === transferToAccountId);
                        const nextIdx = (idx + 1) % accounts.length;
                        setTransferToAccountId(accounts[nextIdx].id);
                      }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#007aff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', color: '#fff' }}>
                          {accounts.find(a => a.id === transferToAccountId)?.icon || "🏦"}
                        </div>
                        <p style={{ fontSize: '0.75rem', color: '#8e8e93' }}>轉入帳戶</p>
                        <p style={{ fontSize: '0.85rem', fontWeight: '700' }}>{accounts.find(a => a.id === transferToAccountId)?.name}</p>
                        <p style={{ fontSize: '1.1rem', fontWeight: '800', marginTop: '4px', color: '#007aff' }}>${parseInt(amount).toLocaleString()}</p>
                      </div>
                    </div>

                    {/* 同帳戶警示 */}
                    {selectedAccountId === transferToAccountId && (
                      <div style={{ background: '#fff0f0', border: '1px solid #ff453a', borderRadius: '12px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                        <span style={{ fontSize: '1.1rem' }}>⚠️</span>
                        <p style={{ fontSize: '0.85rem', color: '#ff453a', fontWeight: '600' }}>轉出帳戶與轉入帳戶不能相同</p>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', background: '#f2f2f7', borderRadius: '10px', padding: '8px 12px' }}>
                        <span style={{ fontSize: '0.9rem', marginRight: '6px' }}>📅</span>
                        <input
                          type="date"
                          value={txDate}
                          onChange={(e) => setTxDate(e.target.value)}
                          style={{ border: 'none', background: 'transparent', width: '100%', fontSize: '0.85rem', fontWeight: '600', outline: 'none', color: '#1c1c1e' }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', background: '#f2f2f7', borderRadius: '10px', padding: '8px 12px' }}>
                        <span style={{ fontSize: '0.8rem', color: '#8e8e93', marginRight: '6px' }}>📝</span>
                        <input
                          type="text"
                          placeholder="備註..."
                          value={txNote}
                          onChange={(e) => setTxNote(e.target.value)}
                          style={{ border: 'none', background: 'transparent', width: '100%', fontSize: '16px', outline: 'none' }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="input-display" style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '2.4rem', fontWeight: '800', color: activeType === 'income' ? 'var(--income)' : 'var(--expense)' }}>
                        ${parseInt(amount).toLocaleString()}
                      </span>
                    </div>

                    {/* 日期與備註輸入 */}
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
                          style={{ border: 'none', background: 'transparent', width: '100%', fontSize: '16px', color: '#1c1c1e', outline: 'none' }}
                        />
                      </div>
                    </div>
                  </>
                )}

                {activeType !== 'transfer' && (
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
                )}

                <div className="keyboard" style={{ margin: '0 -1.2rem', background: '#e5e5ea', gap: '1px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"].map((k) => (
                    <button key={k} className="key" style={{ background: '#fff', border: 'none', fontSize: '1.2rem', height: '42px', color: '#1c1c1e', fontWeight: '600' }} onClick={() => (k === "⌫" ? setAmount(p => p.length > 1 ? p.slice(0, -1) : "0") : (k === "C" ? setAmount("0") : setAmount(p => p === "0" ? k : p + k)))}>{k}</button>
                  ))}
                  <button className="key confirm" onClick={handleSave} style={{ background: activeType === 'income' ? 'var(--income)' : (activeType === 'transfer' ? '#5856d6' : 'var(--expense)'), borderRadius: '12px', fontSize: '1rem', color: '#fff', gridColumn: 'span 3', height: '44px', margin: '8px 1.2rem', fontWeight: '700', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                    {editingTx ? "確認修改" : "確認保存"}
                  </button>
                </div>

                {/* 今日紀錄 */}
                <div style={{ marginTop: '1.5rem', paddingBottom: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '0.9rem', color: '#8e8e93', fontWeight: '700' }}>{txDate === new Date().toISOString().split('T')[0] ? '今日' : txDate} 紀錄</h3>
                    <span style={{ fontSize: '0.75rem', color: '#007aff' }}>共 {transactions.filter(t => t.date === txDate).length} 筆</span>
                  </div>

                  {transactions.filter(t => t.date === txDate).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem 0', color: '#c7c7cc' }}>
                      <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🍃</p>
                      <p style={{ fontSize: '0.85rem' }}>尚無記帳紀錄</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: '#f2f2f7', borderRadius: '16px', overflow: 'hidden' }}>
                      {transactions.filter(t => t.date === txDate).map(t => {
                        const cat = categories.find(c => c.id === t.categoryId);
                        const acc = accounts.find(a => a.id === t.accountId);
                        return (
                          <div
                            key={t.id}
                            style={{ background: '#fff', padding: '12px 1rem', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                          >
                            <div
                              onClick={() => setEditingTx(t)}
                              style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}
                            >
                              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#f2f2f7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                                {cat?.icon && cat.icon.startsWith('data:image') ? (
                                  <img src={cat.icon} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  <span style={{ fontSize: '1.1rem' }}>{cat?.icon || (t.type === 'transfer' ? '⇄' : '❓')}</span>
                                )}
                              </div>
                              <div style={{ flex: 1 }}>
                                <p style={{ fontWeight: '700', fontSize: '0.95rem', marginBottom: '2px' }}>
                                  {t.type === 'transfer' ? '轉帳項目' : cat?.label}
                                </p>
                                <p style={{ fontSize: '0.75rem', color: '#8e8e93' }}>
                                  {t.type === 'transfer'
                                    ? `${acc?.name} ➔ ${accounts.find(a => a.id === t.toAccountId)?.name}${t.note ? ` · ${t.note}` : ''}`
                                    : `${acc?.name} ${t.note ? `· ${t.note}` : ''}`}
                                </p>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <p style={{ fontWeight: '700', fontSize: '1rem', color: t.type === 'expense' ? '#ff453a' : (t.type === 'income' ? '#007aff' : '#8e8e93') }}>
                                  {t.type === 'expense' ? '-' : (t.type === 'income' ? '+' : '⇄')}{t.amount.toLocaleString()}
                                </p>
                                <p style={{ fontSize: '0.65rem', color: '#c7c7cc' }}>{t.time}</p>
                              </div>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteTransaction(t); }}
                              style={{ background: 'none', border: 'none', color: '#ff453a', fontSize: '1.2rem', padding: '0 0 0 8px', flexShrink: 0 }}
                            >
                              🗑️
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
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
                        <div
                          key={t.id}
                          className="history-item"
                          style={{ padding: '12px 1.2rem', borderBottom: '1px solid #f2f2f7', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                          <div
                            onClick={() => {
                              setEditingTx(t);
                              setCurrentScreen('main');
                              setAccountDetailId(null);
                            }}
                            style={{ flex: 1, display: 'flex', alignItems: 'center' }}
                          >
                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#2c2c2e', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '12px', overflow: 'hidden', flexShrink: 0 }}>
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
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteTransaction(t); }}
                            style={{ background: 'none', border: 'none', color: '#ff453a', fontSize: '1.2rem', padding: '0 0 0 12px', flexShrink: 0 }}
                          >
                            🗑️
                          </button>
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
        // 線性回歸工具函式
        const linReg = (data: number[]) => {
          const n = data.length;
          if (n < 2) return { predict: (x: number) => data[0] || 0 };
          const sumX = n * (n - 1) / 2;
          const sumY = data.reduce((s, v) => s + v, 0);
          const sumXY = data.reduce((s, v, i) => s + i * v, 0);
          const sumXX = data.reduce((s, _, i) => s + i * i, 0);
          const denom = n * sumXX - sumX * sumX;
          const slope = denom ? (n * sumXY - sumX * sumY) / denom : 0;
          const intercept = (sumY - slope * sumX) / n;
          return { predict: (x: number) => Math.max(0, Math.round(slope * x + intercept)) };
        };

        // 自訂時間範圍的交易
        const customFiltered = transactions.filter(t => {
          const d = t.date;
          return d >= customStart && d <= customEnd;
        });

        // 預測資料：取最近 6 個月的每月收支
        const predMonths: string[] = [];
        const predExpense: number[] = [];
        const predIncome: number[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(); d.setMonth(d.getMonth() - i);
          const y = d.getFullYear(); const m = d.getMonth();
          predMonths.push(`${d.getMonth() + 1}月`);
          const txs = transactions.filter(t => { const td = new Date(t.id); return td.getFullYear() === y && td.getMonth() === m; });
          predExpense.push(txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
          predIncome.push(txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0));
        }
        const expReg = linReg(predExpense);
        const incReg = linReg(predIncome);
        const futureLabels = [1, 2, 3].map(i => { const d = new Date(); d.setMonth(d.getMonth() + i); return `${d.getMonth() + 1}月(預)`; });
        const futureExpense = [1, 2, 3].map(i => expReg.predict(6 + i - 1));
        const futureIncome = [1, 2, 3].map(i => incReg.predict(6 + i - 1));

        // 分類消費排名
        const rankType = reportMainType === 'balance' ? 'expense' : reportMainType;
        const rankSource = reportView === 'advanced' && advancedSubView === 'custom' ? customFiltered : filteredReportTransactions;
        const categoryRanking = categories
          .filter(c => c.type === rankType)
          .map(c => ({ ...c, total: rankSource.filter(t => t.categoryId === c.id && t.type === rankType).reduce((s, t) => s + t.amount, 0) }))
          .filter(c => c.total > 0)
          .sort((a, b) => b.total - a.total)
          .slice(0, rankingTopN);
        const rankingMax = categoryRanking[0]?.total || 1;
        const rankingGrandTotal = categoryRanking.reduce((s, c) => s + c.total, 0);

        const currentSum = reportMainType === 'balance'
          ? filteredReportTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0) - filteredReportTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
          : doughnutData.total;

        return (
          <div className="bank-view-container" style={{ background: '#fff' }}>
            <div className="report-toggle-group" style={{ display: 'flex' }}>
              <button className={`report-toggle-btn ${reportView === 'category' ? 'active' : ''}`} onClick={() => {
                setReportView('category');
                setReportPeriod('month');
                if (reportMainType === 'balance') setReportMainType('expense');
              }}>分類報表</button>
              <button className={`report-toggle-btn ${reportView === 'trend' ? 'active' : ''}`} onClick={() => { setReportView('trend'); setReportPeriod('month'); }}>收支趨勢</button>
              <button className={`report-toggle-btn ${reportView === 'budget' ? 'active' : ''}`} onClick={() => { setReportView('budget'); setReportPeriod('month'); }}>預算進度</button>
              <button className={`report-toggle-btn ${reportView === 'advanced' ? 'active' : ''}`}
                style={reportView === 'advanced' ? { background: 'linear-gradient(135deg,#5856d6,#af52de)', color: '#fff' } : { color: '#5856d6' }}
                onClick={() => { setReportView('advanced'); if (reportMainType === 'balance') setReportMainType('expense'); }}>✨ 進階</button>
            </div>

            {/* 進階分析子 Tab */}
            {reportView === 'advanced' ? (
              <>
                {/* Sub-tabs */}
                <div style={{ display: 'flex', gap: '8px', padding: '10px 1rem', background: '#f8f7ff', borderBottom: '1px solid #e5e5ea' }}>
                  {(['prediction', 'ranking', 'custom'] as const).map((v, i) => (
                    <button key={v} onClick={() => setAdvancedSubView(v)} style={{
                      padding: '6px 14px', borderRadius: '20px', border: 'none', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer',
                      background: advancedSubView === v ? '#5856d6' : '#ede9ff',
                      color: advancedSubView === v ? '#fff' : '#5856d6',
                    }}>{['📈 趨勢預測', '🏆 消費排名', '📅 自訂範圍'][i]}</button>
                  ))}
                </div>

                {/* ─── [這裡] 趨勢預測 ─── */}
                {advancedSubView === 'prediction' && (
                  <div style={{ padding: '0 0 80px' }}>
                    <div style={{ padding: '12px 1rem', display: 'flex', gap: '8px', borderBottom: '1px solid #f2f2f7' }}>
                      <button onClick={() => setReportMainType('expense')} style={{ padding: '6px 16px', borderRadius: '20px', border: 'none', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer', background: reportMainType === 'expense' ? '#ff453a' : '#f2f2f7', color: reportMainType === 'expense' ? '#fff' : '#1c1c1e' }}>支出</button>
                      <button onClick={() => setReportMainType('income')} style={{ padding: '6px 16px', borderRadius: '20px', border: 'none', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer', background: reportMainType === 'income' ? '#007aff' : '#f2f2f7', color: reportMainType === 'income' ? '#fff' : '#1c1c1e' }}>收入</button>
                    </div>
                    <div style={{ padding: '1rem', fontSize: '0.8rem', color: '#8e8e93' }}>基於最近 6 個月線性回歸，預測未來 3 個月趨勢</div>
                    <div style={{ height: '220px', padding: '0 1rem' }}>
                      <Line
                        data={{
                          labels: [...predMonths, ...futureLabels],
                          datasets: [
                            {
                              label: '實際',
                              data: [...(reportMainType === 'expense' ? predExpense : predIncome), ...Array(3).fill(null)],
                              borderColor: reportMainType === 'expense' ? '#ff453a' : '#007aff',
                              backgroundColor: reportMainType === 'expense' ? '#ff453a22' : '#007aff22',
                              borderWidth: 2.5, pointRadius: 4, tension: 0.3, fill: true,
                            },
                            {
                              label: '預測',
                              data: [...Array(5).fill(null), (reportMainType === 'expense' ? predExpense : predIncome)[5], ...(reportMainType === 'expense' ? futureExpense : futureIncome)],
                              borderColor: '#5856d6',
                              backgroundColor: '#5856d622',
                              borderWidth: 2.5, pointRadius: 4, borderDash: [6, 4], tension: 0.3, fill: false,
                            },
                          ],
                        }}
                        options={{
                          maintainAspectRatio: false,
                          plugins: { legend: { position: 'bottom', labels: { font: { size: 12 } } }, tooltip: { callbacks: { label: ctx => `$${(ctx.raw as number)?.toLocaleString()}` } } },
                          scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: '#f2f2f7' }, ticks: { callback: v => `$${Number(v).toLocaleString()}` } } },
                        }}
                      />
                    </div>
                    {/* 預測明細 */}
                    <div style={{ margin: '1rem', background: '#f8f7ff', borderRadius: '16px', padding: '1rem' }}>
                      <p style={{ fontWeight: '700', fontSize: '0.9rem', marginBottom: '0.8rem', color: '#5856d6' }}>📈 未來預測</p>
                      {(reportMainType === 'expense' ? futureExpense : futureIncome).map((v, i) => {
                        const d = new Date(); d.setMonth(d.getMonth() + i + 1);
                        return (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < 2 ? '1px solid #ede9ff' : 'none' }}>
                            <span style={{ fontSize: '0.88rem', color: '#8e8e93' }}>{d.getFullYear()}/{d.getMonth() + 1}月</span>
                            <span style={{ fontWeight: '700', color: reportMainType === 'expense' ? '#ff453a' : '#007aff' }}>${v.toLocaleString()}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ─── [這裡] 消費排名 ─── */}
                {advancedSubView === 'ranking' && (
                  <div style={{ padding: '0 0 80px' }}>
                    {/* 籐選 支出/收入 + TopN */}
                    <div style={{ padding: '12px 1rem', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #f2f2f7', flexWrap: 'wrap' }}>
                      <button onClick={() => setReportMainType('expense')} style={{ padding: '6px 16px', borderRadius: '20px', border: 'none', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer', background: reportMainType !== 'income' ? '#ff453a' : '#f2f2f7', color: reportMainType !== 'income' ? '#fff' : '#1c1c1e' }}>支出</button>
                      <button onClick={() => setReportMainType('income')} style={{ padding: '6px 16px', borderRadius: '20px', border: 'none', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer', background: reportMainType === 'income' ? '#007aff' : '#f2f2f7', color: reportMainType === 'income' ? '#fff' : '#1c1c1e' }}>收入</button>
                      <span style={{ fontSize: '0.8rem', color: '#8e8e93', marginLeft: 'auto' }}>顯示前</span>
                      {[3, 5, 10].map(n => (
                        <button key={n} onClick={() => setRankingTopN(n)} style={{ padding: '4px 10px', borderRadius: '14px', border: 'none', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', background: rankingTopN === n ? '#5856d6' : '#ede9ff', color: rankingTopN === n ? '#fff' : '#5856d6' }}>{n}名</button>
                      ))}
                    </div>
                    {/* 日期範圍 selector */}
                    <div style={{ padding: '8px 1rem', display: 'flex', gap: '8px', borderBottom: '1px solid #f2f2f7' }}>
                      <button onClick={() => setReportPeriod('month')} style={{ padding: '5px 12px', borderRadius: '14px', border: 'none', fontWeight: '600', fontSize: '0.78rem', cursor: 'pointer', background: reportPeriod === 'month' ? '#1c1c1e' : '#f2f2f7', color: reportPeriod === 'month' ? '#fff' : '#1c1c1e' }}>本月</button>
                      <button onClick={() => setReportPeriod('year')} style={{ padding: '5px 12px', borderRadius: '14px', border: 'none', fontWeight: '600', fontSize: '0.78rem', cursor: 'pointer', background: reportPeriod === 'year' ? '#1c1c1e' : '#f2f2f7', color: reportPeriod === 'year' ? '#fff' : '#1c1c1e' }}>本年</button>
                      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.83rem' }}>
                        <button onClick={() => changeReportDate(-1)} style={{ border: 'none', background: 'none', fontSize: '1rem', cursor: 'pointer' }}>❮</button>
                        <span style={{ fontWeight: '600' }}>{reportDateStr}</span>
                        <button onClick={() => changeReportDate(1)} style={{ border: 'none', background: 'none', fontSize: '1rem', cursor: 'pointer' }}>❯</button>
                      </div>
                    </div>
                    {/* 排名列表 */}
                    <div style={{ padding: '1rem' }}>
                      {categoryRanking.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#c7c7cc' }}>
                          <p style={{ fontSize: '2rem' }}>🏆</p>
                          <p style={{ fontSize: '0.85rem' }}>這個期間尚無資料</p>
                        </div>
                      ) : categoryRanking.map((c, i) => (
                        <div key={c.id} style={{ marginBottom: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: i === 0 ? '#ffd700' : i === 1 ? '#ddd' : i === 2 ? '#cd7f32' : '#f2f2f7',
                                fontWeight: '900', fontSize: '0.72rem', flexShrink: 0, color: i < 3 ? '#fff' : '#8e8e93',
                              }}>{i + 1}</span>
                              <span style={{ fontSize: '1.1rem' }}>{c.icon && !c.icon.startsWith('data:') ? c.icon : '💰'}</span>
                              <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>{c.label}</span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <p style={{ fontWeight: '700', fontSize: '0.95rem', color: reportMainType === 'income' ? '#007aff' : '#ff453a' }}>${c.total.toLocaleString()}</p>
                              <p style={{ fontSize: '0.72rem', color: '#8e8e93' }}>{Math.round(c.total / rankingGrandTotal * 100)}%</p>
                            </div>
                          </div>
                          <div style={{ height: '8px', background: '#f2f2f7', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${c.total / rankingMax * 100}%`, background: c.color, borderRadius: '4px', transition: 'width 0.6s cubic-bezier(.4,0,.2,1)' }} />
                          </div>
                        </div>
                      ))}
                      {rankingGrandTotal > 0 && (
                        <div style={{ marginTop: '0.5rem', padding: '10px 14px', background: '#f8f7ff', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ color: '#8e8e93' }}>Top {rankingTopN} 合計</span>
                          <span style={{ fontWeight: '700', color: '#5856d6' }}>${rankingGrandTotal.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ─── [這裡] 自訂範圍 ─── */}
                {advancedSubView === 'custom' && (
                  <div style={{ padding: '0 0 80px' }}>
                    {/* 日期選擇器 */}
                    <div style={{ padding: '1rem', background: '#f8f7ff', margin: '0', borderBottom: '1px solid #e5e5ea' }}>
                      <p style={{ fontWeight: '700', fontSize: '0.88rem', marginBottom: '10px', color: '#5856d6' }}>📅 自訂時間範圍</p>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '130px' }}>
                          <p style={{ fontSize: '0.72rem', color: '#8e8e93', marginBottom: '4px' }}>開始</p>
                          <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: '10px', border: '1px solid #e5e5ea', fontSize: '0.9rem', background: '#fff' }} />
                        </div>
                        <span style={{ color: '#c7c7cc', fontWeight: '700', paddingTop: '16px' }}>—</span>
                        <div style={{ flex: 1, minWidth: '130px' }}>
                          <p style={{ fontSize: '0.72rem', color: '#8e8e93', marginBottom: '4px' }}>結束</p>
                          <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: '10px', border: '1px solid #e5e5ea', fontSize: '0.9rem', background: '#fff' }} />
                        </div>
                      </div>
                    </div>
                    {/* 攝要數據 */}
                    {(() => {
                      const cIncome = customFiltered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
                      const cExpense = customFiltered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
                      const cBalance = cIncome - cExpense;
                      return (
                        <div style={{ display: 'flex', gap: '1px', background: '#e5e5ea', borderBottom: '8px solid #f2f2f7' }}>
                          {[{ label: '收入', val: cIncome, color: '#007aff' }, { label: '支出', val: cExpense, color: '#ff453a' }, { label: '結餘', val: cBalance, color: cBalance >= 0 ? '#34c759' : '#ff453a' }].map(item => (
                            <div key={item.label} style={{ flex: 1, padding: '14px 0', textAlign: 'center', background: '#fff' }}>
                              <p style={{ fontSize: '0.72rem', color: '#8e8e93', marginBottom: '4px' }}>{item.label}</p>
                              <p style={{ fontWeight: '800', fontSize: '1.1rem', color: item.color }}>${Math.abs(item.val).toLocaleString()}</p>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    {/* 分類詳細列表 */}
                    <div style={{ padding: '10px 1rem 0' }}>
                      {['expense', 'income'].map(type => {
                        const typedCats = categories.filter(c => c.type === type);
                        const typedTotal = customFiltered.filter(t => t.type === type).reduce((s, t) => s + t.amount, 0);
                        if (typedTotal === 0) return null;
                        return (
                          <div key={type} style={{ marginBottom: '1.5rem' }}>
                            <p style={{ fontWeight: '700', fontSize: '0.88rem', color: type === 'expense' ? '#ff453a' : '#007aff', marginBottom: '8px', padding: '0 4px' }}>
                              {type === 'expense' ? '支出明細' : '收入明細'}
                            </p>
                            {typedCats.map(c => {
                              const amt = customFiltered.filter(t => t.categoryId === c.id && t.type === type).reduce((s, t) => s + t.amount, 0);
                              if (amt === 0) return null;
                              return (
                                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 4px', borderBottom: '1px solid #f2f2f7' }}>
                                  <span style={{ fontSize: '1.1rem' }}>{c.icon && !c.icon.startsWith('data:') ? c.icon : '💰'}</span>
                                  <span style={{ flex: 1, fontSize: '0.88rem', fontWeight: '600' }}>{c.label}</span>
                                  <span style={{ fontWeight: '700', color: type === 'expense' ? '#ff453a' : '#007aff', fontSize: '0.9rem' }}>${amt.toLocaleString()}</span>
                                  <span style={{ fontSize: '0.72rem', color: '#c7c7cc', minWidth: '36px', textAlign: 'right' }}>{Math.round(amt / typedTotal * 100)}%</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                      {customFiltered.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#c7c7cc' }}>
                          <p style={{ fontSize: '2rem' }}>🌃</p>
                          <p style={{ fontSize: '0.85rem' }}>此時間範圍內無交易記錄</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : reportView === 'budget' ? (
              // ─── [V4] 預算管理視圖 ───
              <div style={{ padding: '0 0 80px' }}>
                <div className="date-picker-row" style={{ borderBottom: '1px solid #f2f2f7' }}>
                  <div className="date-text">
                    <button onClick={() => changeReportDate(-1)} style={{ border: 'none', background: 'none', fontSize: '1.2rem' }}>❮</button>
                    <span>{reportDateStr} 預算</span>
                    <button onClick={() => changeReportDate(1)} style={{ border: 'none', background: 'none', fontSize: '1.2rem' }}>❯</button>
                  </div>
                </div>

                <div style={{ padding: '1rem' }}>
                  {(() => {
                    const budgetedCats = categories.filter(c => c.type === 'expense' && c.budget && c.budget > 0);
                    if (budgetedCats.length === 0) {
                      return (
                        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#c7c7cc' }}>
                          <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎯</p>
                          <p>尚未設定任何支出預算</p>
                          <p style={{ fontSize: '0.8rem', marginTop: '5px' }}>請至「維護 &gt; 分類設定」中設定每月預算</p>
                        </div>
                      );
                    }

                    const totalBudget = budgetedCats.reduce((s, c) => s + (c.budget || 0), 0);
                    const totalSpent = budgetedCats.reduce((s, c) => {
                      return s + filteredReportTransactions.filter(t => t.categoryId === c.id).reduce((sum, t) => sum + t.amount, 0);
                    }, 0);
                    const percent = Math.min(100, Math.round((totalSpent / totalBudget) * 100)) || 0;

                    return (
                      <>
                        {/* 總預算概覽 */}
                        <div style={{ background: 'linear-gradient(135deg, #2c2c2e, #1c1c1e)', borderRadius: '24px', padding: '1.5rem', marginBottom: '1.5rem', color: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.15)' }}>
                          <p style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '8px' }}>總預算執行率</p>
                          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', marginBottom: '1rem' }}>
                            <span style={{ fontSize: '2.2rem', fontWeight: '800' }}>{percent}%</span>
                            <span style={{ fontSize: '0.9rem', paddingBottom: '8px', opacity: 0.8 }}>${totalSpent.toLocaleString()} / ${totalBudget.toLocaleString()}</span>
                          </div>
                          <div style={{ height: '10px', background: 'rgba(255,255,255,0.15)', borderRadius: '5px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${percent}%`, background: percent > 90 ? '#ff453a' : '#32d74b', transition: 'width 0.8s ease-out' }} />
                          </div>
                        </div>

                        {/* 分類預算列表 */}
                        <h4 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '1rem', color: '#1c1c1e' }}>分類進度</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {budgetedCats.map(c => {
                            const spent = filteredReportTransactions.filter(t => t.categoryId === c.id).reduce((sum, t) => sum + t.amount, 0);
                            const bPercent = Math.round((spent / (c.budget || 1)) * 100);
                            const remaining = (c.budget || 0) - spent;
                            return (
                              <div key={c.id} style={{ background: '#fff', padding: '14px', borderRadius: '18px', border: '1px solid #f2f2f7' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontSize: '1.2rem' }}>{c.icon}</span>
                                    <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>{c.label}</span>
                                  </div>
                                  <div style={{ textAlign: 'right' }}>
                                    <span style={{ fontWeight: '700', color: bPercent > 100 ? '#ff453a' : '#1c1c1e' }}>${spent.toLocaleString()}</span>
                                    <span style={{ fontSize: '0.75rem', color: '#8e8e93' }}> / ${c.budget?.toLocaleString()}</span>
                                  </div>
                                </div>
                                <div style={{ height: '6px', background: '#f2f2f7', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
                                  <div style={{ height: '100%', width: `${Math.min(100, bPercent)}%`, background: bPercent > 100 ? '#ff453a' : (bPercent > 80 ? '#ff9500' : c.color) }} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                  <span style={{ color: bPercent > 100 ? '#ff453a' : '#8e8e93' }}>{bPercent > 100 ? `超支 $${Math.abs(remaining).toLocaleString()}` : `剩餘 $${remaining.toLocaleString()}`}</span>
                                  <span style={{ fontWeight: '600', color: bPercent > 100 ? '#ff453a' : '#8e8e93' }}>{bPercent}%</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            ) : (
              // ── 原有分類 / 趨勢報表 ──
              <>
                <div className="report-main-tabs">
                  <button className={`report-main-tab ${reportMainType === 'expense' ? 'active' : ''}`} onClick={() => setReportMainType('expense')}>支出</button>
                  <button className={`report-main-tab ${reportMainType === 'income' ? 'active' : ''}`} onClick={() => setReportMainType('income')}>收入</button>
                  {reportView === 'category' && (
                    <button className={`report-main-tab ${reportMainType === 'transfer' ? 'active' : ''}`} onClick={() => setReportMainType('transfer')}>轉帳</button>
                  )}
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
                        <p className="center-label">{reportMainType === 'expense' ? '總支出' : reportMainType === 'income' ? '總收入' : '總轉帳'}</p>
                        <p className="center-amount">${doughnutData.total.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="report-list">
                      {reportMainType === 'transfer' ? (
                        // 轉帳模式：以帳戶分組顯示
                        accounts.map(acc => {
                          const txs = filteredReportTransactions.filter(t => t.type === 'transfer' && (t.accountId === acc.id || t.toAccountId === acc.id));
                          if (txs.length === 0) return null;
                          const transferred = txs.filter(t => t.accountId === acc.id).reduce((s, t) => s + t.amount, 0);
                          const received = txs.filter(t => t.toAccountId === acc.id).reduce((s, t) => s + t.amount, 0);
                          return (
                            <div key={acc.id} className="report-item">
                              <div className="report-item-color-bar" style={{ background: '#5856d6' }}></div>
                              <div className="report-item-icon-circle">{acc.icon && !acc.icon.startsWith('data:') ? acc.icon : '💰'}</div>
                              <div className="report-item-info">
                                <div className="report-item-label">{acc.name}</div>
                                <div style={{ fontSize: '0.75rem', color: '#8e8e93' }}>
                                  {transferred > 0 && <span>轉出 ${transferred.toLocaleString()}　</span>}
                                  {received > 0 && <span>轉入 ${received.toLocaleString()}</span>}
                                </div>
                              </div>
                              <div className="report-item-amount" style={{ color: '#5856d6' }}>
                                {txs.length} 筆
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        categories.filter(c => c.type === (reportMainType === 'balance' ? 'expense' : reportMainType as 'expense' | 'income')).map(c => {
                          const amount = filteredReportTransactions.filter(t => t.categoryId === c.id && t.type !== 'transfer').reduce((s, t) => s + t.amount, 0);
                          if (amount === 0) return null;
                          return (
                            <div key={c.id} className="report-item" onClick={() => { setReportDetailId(c.id); setCurrentScreen('report_detail'); }} style={{ cursor: 'pointer' }}>
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
                        })
                      )}
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
                      {barData.labels.map((label, idx) => {
                        const val = barData.datasets[0].data[idx] as number;
                        if (val === 0) return null;
                        let detailId = '';
                        if (reportPeriod === 'month') {
                          detailId = `${reportDate.getFullYear()}-${(reportDate.getMonth() + 1).toString().padStart(2, '0')}-${label.replace('日', '').padStart(2, '0')}`;
                        } else {
                          detailId = `${reportDate.getFullYear()}-${label.replace('月', '').padStart(2, '0')}`;
                        }
                        return (
                          <div key={label} className="report-item" onClick={() => { setReportDetailId(detailId); setCurrentScreen('report_detail'); }} style={{ cursor: 'pointer' }}>
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
              </>
            )}
          </div>
        );

      case 'report_detail':
        if (!reportDetailId) return null;

        let detailTransactions: Transaction[] = [];
        let detailTitle = "交易明細";
        let detailIcon = "📊";
        let detailColor = '#1c1c1e';

        // Determine if it's a category drilldown or a date drilldown
        const isCategoryDrilldown = categories.some(c => c.id === reportDetailId);

        if (isCategoryDrilldown) {
          const category = categories.find(c => c.id === reportDetailId);
          detailTitle = category?.label || "分類明細";
          detailIcon = category?.icon || "❓";
          detailColor = category?.color || '#1c1c1e';
          detailTransactions = filteredReportTransactions.filter(t =>
            t.categoryId === reportDetailId && t.type === reportMainType
          );
        } else {
          // Date drilldown (from trend report)
          const [year, month, day] = reportDetailId.split('-').map(Number);
          if (day) { // Daily drilldown (YYYY-MM-DD)
            detailTitle = `${year}年${month}月${day}日 明細`;
            detailIcon = "📅";
            detailTransactions = filteredReportTransactions.filter(t => {
              const txDate = new Date(t.id);
              return txDate.getFullYear() === year && txDate.getMonth() + 1 === month && txDate.getDate() === day;
            });
          } else { // Monthly drilldown (YYYY-MM)
            detailTitle = `${year}年${month}月 明細`;
            detailIcon = "🗓️";
            detailTransactions = transactions.filter(t => {
              const txDate = new Date(t.id);
              return txDate.getFullYear() === year && txDate.getMonth() + 1 === month;
            });
          }
          // For date drilldown, we show all types (income/expense)
        }

        const totalAmount = detailTransactions.reduce((sum, t) => {
          return sum + (t.type === 'income' ? t.amount : -t.amount);
        }, 0);

        // Group transactions by date for display
        const groupedDetailTxs: Record<string, Transaction[]> = {};
        detailTransactions.forEach(t => {
          if (!groupedDetailTxs[t.date]) groupedDetailTxs[t.date] = [];
          groupedDetailTxs[t.date].push(t);
        });
        const sortedDetailDates = Object.keys(groupedDetailTxs).sort((a, b) => b.localeCompare(a));

        return (
          <div className="bank-view-container" style={{ background: '#f2f2f7' }}>
            <div style={{ background: '#fff', padding: '10px 1.2rem', borderBottom: '1px solid #f2f2f7' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <button onClick={() => setCurrentScreen('reports')} style={{ border: 'none', background: 'none', fontSize: '1.2rem' }}>❮</button>
                <h2 style={{ flex: 1, textAlign: 'center', fontSize: '1.1rem' }}>{detailTitle}</h2>
                <div style={{ width: '24px' }}></div> {/* Placeholder for alignment */}
              </div>
            </div>

            <div style={{ padding: '1.5rem 1.2rem', background: '#fff', borderBottom: '8px solid #f2f2f7' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '1rem' }}>
                <div style={{ width: '45px', height: '45px', borderRadius: '50%', background: detailColor, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {detailIcon && detailIcon.startsWith('data:image') ? (
                    <img src={detailIcon} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '1.4rem', color: '#fff' }}>{detailIcon}</span>
                  )}
                </div>
                <div>
                  <p style={{ fontSize: '0.9rem', color: '#8e8e93', marginBottom: '2px' }}>總計</p>
                  <p style={{ fontSize: '1.8rem', fontWeight: '800', color: totalAmount < 0 ? '#ff453a' : '#007aff' }}>
                    {totalAmount < 0 ? '-' : ''}${Math.abs(totalAmount).toLocaleString()}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#8e8e93' }}>
                <span>項目 : {detailTransactions.length} 筆</span>
                {isCategoryDrilldown && (
                  <span>
                    {reportMainType === 'expense' ? '總支出' : '總收入'} :
                    <span style={{ color: reportMainType === 'expense' ? '#ff453a' : '#007aff', fontWeight: '600' }}>
                      ${detailTransactions.reduce((s, t) => s + t.amount, 0).toLocaleString()}
                    </span>
                  </span>
                )}
              </div>
            </div>

            <div style={{ padding: '0 0 80px' }}>
              {sortedDetailDates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: '#c7c7cc' }}>
                  <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🍃</p>
                  <p style={{ fontSize: '0.85rem' }}>尚無記帳紀錄</p>
                </div>
              ) : (
                sortedDetailDates.map(date => (
                  <div key={date} style={{ marginBottom: '10px' }}>
                    <div style={{ padding: '12px 1.2rem', background: '#fff', fontSize: '1rem', fontWeight: '700', borderBottom: '1px solid #f2f2f7' }}>
                      {date.replace(/-/g, '/')} {['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][new Date(date).getDay()]}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: '#f2f2f7', borderRadius: '16px', overflow: 'hidden' }}>
                      {groupedDetailTxs[date].map(t => {
                        const cat = categories.find(c => c.id === t.categoryId);
                        const acc = accounts.find(a => a.id === t.accountId);
                        return (
                          <div
                            key={t.id}
                            onClick={() => {
                              setEditingTx(t);
                              setCurrentScreen('main');
                              setReportDetailId(null); // Clear drilldown state
                            }}
                            style={{ background: '#fff', padding: '12px 1rem', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                          >
                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#f2f2f7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                              {cat?.icon && cat.icon.startsWith('data:image') ? (
                                <img src={cat.icon} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <span style={{ fontSize: '1.1rem' }}>{cat?.icon}</span>
                              )}
                            </div>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontWeight: '700', fontSize: '0.95rem', marginBottom: '2px' }}>{cat?.label}</p>
                              <p style={{ fontSize: '0.75rem', color: '#8e8e93' }}>
                                {acc?.name} {t.note ? `· ${t.note}` : ''}
                              </p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <p style={{ fontWeight: '700', fontSize: '1rem', color: t.type === 'expense' ? '#ff453a' : '#007aff' }}>
                                {t.type === 'expense' ? '-' : '+'}{t.amount.toLocaleString()}
                              </p>
                              <p style={{ fontSize: '0.65rem', color: '#c7c7cc' }}>{t.time}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );

      case 'maintenance':
        return (
          <div className="bank-view-container">
            <header className="bank-header"><h1>設定與維護</h1></header>

            <div className="bank-card" style={{ borderRadius: '20px' }}>
              <h3 style={{ marginBottom: '1.2rem', fontSize: '1.1rem' }}>我的帳戶</h3>
              {accounts.map((acc, index) => (
                <div
                  key={acc.id}
                  className="info-row"
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginRight: '4px' }}>
                      <button
                        onClick={() => {
                          if (index === 0) return;
                          setAccounts(prev => {
                            const arr = [...prev];
                            [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
                            return arr;
                          });
                        }}
                        style={{ border: 'none', background: 'none', color: index === 0 ? '#e5e5ea' : '#8e8e93', fontSize: '1rem', cursor: index === 0 ? 'default' : 'pointer', padding: '0 4px' }}
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => {
                          if (index === accounts.length - 1) return;
                          setAccounts(prev => {
                            const arr = [...prev];
                            [arr[index + 1], arr[index]] = [arr[index], arr[index + 1]];
                            return arr;
                          });
                        }}
                        style={{ border: 'none', background: 'none', color: index === accounts.length - 1 ? '#e5e5ea' : '#8e8e93', fontSize: '1rem', cursor: index === accounts.length - 1 ? 'default' : 'pointer', padding: '0 4px' }}
                      >
                        ▼
                      </button>
                    </div>
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
                    <button onClick={() => handleDeleteAccount(acc.id)} style={{ color: '#ff453a', fontWeight: '600', border: 'none', background: 'none' }}>刪除</button>
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
              {categories.filter(c => c.type === (activeType === 'transfer' ? 'expense' : activeType)).map((c, displayIndex, filteredArr) => {
                const realIndex = categories.findIndex(cat => cat.id === c.id);
                return (
                  <div
                    key={c.id}
                    className="info-row"
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginRight: '4px' }}>
                        <button
                          onClick={() => {
                            if (displayIndex === 0) return;
                            const prevCatId = filteredArr[displayIndex - 1].id;
                            const prevRealIndex = categories.findIndex(cat => cat.id === prevCatId);
                            setCategories(prev => {
                              const arr = [...prev];
                              // Swap adjacent identical-type elements in original array
                              // (This logic properly swaps the single element upwards over the other)
                              [arr[prevRealIndex], arr[realIndex]] = [arr[realIndex], arr[prevRealIndex]];
                              return arr;
                            });
                          }}
                          style={{ border: 'none', background: 'none', color: displayIndex === 0 ? '#e5e5ea' : '#8e8e93', fontSize: '1rem', cursor: displayIndex === 0 ? 'default' : 'pointer', padding: '0 4px' }}
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => {
                            if (displayIndex === filteredArr.length - 1) return;
                            const nextCatId = filteredArr[displayIndex + 1].id;
                            const nextRealIndex = categories.findIndex(cat => cat.id === nextCatId);
                            setCategories(prev => {
                              const arr = [...prev];
                              [arr[nextRealIndex], arr[realIndex]] = [arr[realIndex], arr[nextRealIndex]];
                              return arr;
                            });
                          }}
                          style={{ border: 'none', background: 'none', color: displayIndex === filteredArr.length - 1 ? '#e5e5ea' : '#8e8e93', fontSize: '1rem', cursor: displayIndex === filteredArr.length - 1 ? 'default' : 'pointer', padding: '0 4px' }}
                        >
                          ▼
                        </button>
                      </div>
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
                );
              })}
              <button className="bank-button-primary" onClick={() => setCatForm({ show: true, type: activeType as any, label: '', icon: '✨' })} style={{ marginTop: '1.5rem', background: '#333' }}>+ 新增分類</button>
            </div>

            {/* 安全性設定 */}
            <div className="bank-card" style={{ borderRadius: '20px' }}>
              <h3 style={{ marginBottom: '1.2rem', fontSize: '1.1rem' }}>🔐 安全性</h3>
              <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontWeight: '600', fontSize: '0.95rem' }}>螢幕鎖定密碼</p>
                  <p style={{ fontSize: '0.75rem', color: '#ff9500', marginTop: '2px' }}>
                    {typeof window !== 'undefined' && (() => {
                      try {
                        const s = sessionStorage.getItem('qm_session');
                        const uid = s ? JSON.parse(s).user?.id : null;
                        return !localStorage.getItem(`qm_pin_changed_${uid || 'default'}`)
                          ? '⚠️ 仍在使用預設密碼 0000，請立即修改'
                          : '✅ 已設定個人密碼';
                      } catch { return ''; }
                    })()}
                  </p>
                </div>
                <button
                  onClick={() => {
                    import('./components/AppShell').then(m => m.triggerChangePin());
                  }}
                  style={{ padding: '8px 16px', background: '#007aff', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer' }}
                >
                  修改密碼
                </button>
              </div>
            </div>

            {/* 定期收支設定 (V4) */}
            <div className="bank-card" style={{ borderRadius: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                <h3 style={{ fontSize: '1.1rem' }}>📌 定期收支</h3>
                <button
                  onClick={() => setRecurringForm({ active: true, frequency: 'monthly', type: 'expense', amount: 0, label: '', categoryId: categories.find(c => c.type === 'expense')?.id, accountId: accounts[0].id })}
                  style={{ color: '#007aff', fontWeight: '700', border: 'none', background: 'none', fontSize: '0.9rem' }}
                >
                  + 新增範本
                </button>
              </div>
              {recurringTemplates.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#c7c7cc', fontSize: '0.85rem', padding: '1rem 0' }}>尚無定期收支項目</p>
              ) : (
                recurringTemplates.map(tpl => (
                  <div key={tpl.id} className="info-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: tpl.active ? '#e8f9e8' : '#f2f2f7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {tpl.active ? '⏰' : '⏸️'}
                      </div>
                      <div>
                        <p style={{ fontSize: '0.9rem', fontWeight: '600' }}>{tpl.label}</p>
                        <p style={{ fontSize: '0.72rem', color: '#8e8e93' }}>
                          {tpl.frequency === 'daily' ? '每日' : tpl.frequency === 'weekly' ? '每週' : '每月'}
                          {tpl.frequency === 'weekly' && tpl.executionDay !== undefined
                            ? ` 週${'日一二三四五六'[tpl.executionDay]}` : ''}
                          {tpl.frequency === 'monthly' && tpl.executionDay !== undefined
                            ? ` ${tpl.executionDay} 號` : ''} ·
                          {tpl.type === 'expense' ? '支出' : '收入'} ${tpl.amount.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setRecurringForm(tpl)} style={{ color: '#007aff', border: 'none', background: 'none', fontSize: '0.82rem', fontWeight: '600' }}>編輯</button>
                      <button onClick={() => setRecurringTemplates(p => p.filter(x => x.id !== tpl.id))} style={{ color: '#ff453a', border: 'none', background: 'none', fontSize: '0.82rem', fontWeight: '600' }}>刪除</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* ☁️ 雲端備份 */}
            <div className="bank-card" style={{ borderRadius: '20px', paddingBottom: '1.5rem' }}>
              <h3 style={{ marginBottom: '0.4rem', fontSize: '1.1rem' }}>☁️ 資料備份</h3>
              <p style={{ fontSize: '0.75rem', color: '#8e8e93', marginBottom: '1.2rem' }}>
                {isFileSystemAccessSupported()
                  ? '指定資料夾後可直接備份至 iCloud Drive 等位置'
                  : '你的瀏覽器不支援資料夾選取，將以下載方式備份'}
              </p>

              {/* 狀態訊息 */}
              {backupStatus.type && (
                <div style={{
                  padding: '10px 14px', borderRadius: '12px', marginBottom: '1rem', fontSize: '0.85rem', fontWeight: '600',
                  background: backupStatus.type === 'success' ? '#e8f9f0' : backupStatus.type === 'error' ? '#fff0f0' : '#f0f6ff',
                  color: backupStatus.type === 'success' ? '#1a7a4a' : backupStatus.type === 'error' ? '#c0392b' : '#005cbf',
                }}>
                  {backupStatus.msg}
                </div>
              )}

              {/* 資料夾設定 */}
              {isFileSystemAccessSupported() && (
                <div className="info-row" style={{ alignItems: 'center' }}>
                  <div>
                    <p style={{ fontWeight: '600', fontSize: '0.9rem' }}>備份資料夾</p>
                    <p style={{ fontSize: '0.75rem', color: backupFolderName ? '#007aff' : '#c7c7cc', marginTop: '2px' }}>
                      {backupFolderName ? `📁 ${backupFolderName}` : '尚未設定'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={handlePickFolder}
                      style={{ padding: '7px 14px', background: '#007aff', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      {backupFolderName ? '重新選取' : '選取資料夾'}
                    </button>
                    {backupFolderName && (
                      <button
                        onClick={handleClearFolder}
                        style={{ padding: '7px 12px', background: '#f2f2f7', color: '#ff453a', border: 'none', borderRadius: '10px', fontWeight: '600', fontSize: '0.82rem', cursor: 'pointer' }}
                      >
                        清除
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 備份 / 還原 按鈕 */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
                <button
                  onClick={handleBackupNow}
                  disabled={isBackupLoading}
                  style={{
                    flex: 1, padding: '12px', background: isBackupLoading ? '#c7c7cc' : '#34c759',
                    color: 'white', border: 'none', borderRadius: '14px', fontWeight: '700',
                    fontSize: '0.95rem', cursor: isBackupLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isBackupLoading ? '處理中…' : '⬆️ 立即備份'}
                </button>
                {isFileSystemAccessSupported() && backupFolderName && (
                  <button
                    onClick={handleShowRestoreList}
                    disabled={isBackupLoading}
                    style={{
                      flex: 1, padding: '12px', background: isBackupLoading ? '#c7c7cc' : '#ff9500',
                      color: 'white', border: 'none', borderRadius: '14px', fontWeight: '700',
                      fontSize: '0.95rem', cursor: isBackupLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    ⬇️ 還原備份
                  </button>
                )}
              </div>

              {/* 還原清單面板 */}
              {showRestorePanel && backupFiles !== null && (
                <div style={{ marginTop: '1rem', background: '#f8f8fa', borderRadius: '14px', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', background: '#ff9500', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'white', fontWeight: '700', fontSize: '0.9rem' }}>選擇要還原的備份</span>
                    <button onClick={() => setShowRestorePanel(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.1rem', cursor: 'pointer' }}>✕</button>
                  </div>
                  {backupFiles.length === 0 ? (
                    <p style={{ padding: '1rem', textAlign: 'center', color: '#8e8e93', fontSize: '0.85rem' }}>📂 資料夾內沒有備份檔案</p>
                  ) : (
                    backupFiles.map(f => (
                      <div
                        key={f}
                        onClick={() => handleRestoreFile(f)}
                        style={{
                          padding: '12px 14px', borderBottom: '1px solid #e5e5ea',
                          cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600', color: '#1c1c1e',
                        }}
                      >
                        📄 {f.replace('quick-money-backup-', '').replace('.json', '').replace('-', ' ')}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* 分隔線 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '1rem 0 0.5rem' }}>
                <div style={{ flex: 1, height: '1px', background: '#e5e5ea' }} />
                <span style={{ fontSize: '0.75rem', color: '#c7c7cc', whiteSpace: 'nowrap' }}>或從檔案選取</span>
                <div style={{ flex: 1, height: '1px', background: '#e5e5ea' }} />
              </div>

              {/* 從檔案還原（支援所有瀏覽器 / Safari / iCloud Drive） */}
              <label style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '12px', borderRadius: '14px', border: '2px dashed #c7c7cc',
                cursor: 'pointer', color: '#8e8e93', fontSize: '0.9rem', fontWeight: '600',
                background: '#fafafa',
              }}>
                📂 選取備份 JSON 檔案還原
                <input
                  type="file"
                  accept=".json,application/json"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleRestoreFromFile(file);
                    e.target.value = ''; // 清空，允許再次選同一個檔案
                  }}
                />
              </label>
            </div>

            {/* 📊 報表匯出 */}
            <div className="bank-card" style={{ borderRadius: '20px' }}>
              <h3 style={{ marginBottom: '0.4rem', fontSize: '1.1rem' }}>📊 報表匯出</h3>
              <p style={{ fontSize: '0.75rem', color: '#8e8e93', marginBottom: '1.2rem' }}>
                將所有交易紀錄導出為 CSV 格式，支援 Excel。
              </p>
              <button
                onClick={handleExportCSV}
                style={{
                  width: '100%', padding: '12px', background: '#5856d6',
                  color: 'white', border: 'none', borderRadius: '14px',
                  fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer'
                }}
              >
                📊 匯出完整 CSV 報表
              </button>
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

              {selectedTx.note && (
                <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f8f9fa', borderRadius: '16px' }}>
                  <p style={{ fontSize: '0.8rem', color: '#8e8e93', marginBottom: '5px' }}>備註</p>
                  <p style={{ fontSize: '0.95rem', color: '#1c1c1e' }}>{selectedTx.note}</p>
                </div>
              )}
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


      {/* 彈窗與表單 */}
      {catForm?.show && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ background: '#fff', borderRadius: '32px' }}>
            <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>{catForm.id ? '編輯分類' : '新增分類'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input type="text" placeholder="名稱" value={catForm.label} onChange={e => setCatForm({ ...catForm, label: e.target.value })} style={{ width: '100%', padding: '14px', background: '#f2f2f7', border: 'none', borderRadius: '16px', fontSize: '1rem' }} />

              <div style={{ background: '#f2f2f7', borderRadius: '16px', padding: '14px' }}>
                <p style={{ fontSize: '0.8rem', color: '#8e8e93', marginBottom: '4px' }}>每月預算金額 (選填)</p>
                <input
                  type="number"
                  placeholder="未設定"
                  value={catForm.budget || ''}
                  onChange={e => setCatForm({ ...catForm, budget: parseInt(e.target.value) || 0 })}
                  style={{ width: '100%', padding: '10px', background: '#fff', border: '1px solid #e5e5ea', borderRadius: '12px', fontSize: '1rem' }}
                />
              </div>

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
              <div>
                <p style={{ fontSize: '0.8rem', color: '#8e8e93', marginBottom: '6px', paddingLeft: '4px' }}>初始帳戶金額</p>
                <input
                  type="number"
                  placeholder="0"
                  value={accForm.balance || ''}
                  onChange={e => setAccForm({ ...accForm, balance: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0) })}
                  style={{ width: '100%', padding: '14px', background: '#f2f2f7', border: 'none', borderRadius: '16px', fontSize: '1rem', boxSizing: 'border-box' }}
                />
              </div>

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
      {recurringForm && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ background: '#fff', borderRadius: '32px', maxWidth: '360px' }}>
            <h2 style={{ marginBottom: '1.2rem', textAlign: 'center' }}>{recurringForm.id ? '編輯定期收支' : '新增定期收支'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input
                type="text" placeholder="名稱 (例如: 房租、薪資)"
                value={recurringForm.label || ''}
                onChange={e => setRecurringForm({ ...recurringForm, label: e.target.value })}
                style={{ width: '100%', padding: '14px', background: '#f2f2f7', border: 'none', borderRadius: '16px' }}
              />
              <input
                type="number" placeholder="金額"
                value={recurringForm.amount || ''}
                onChange={e => setRecurringForm({ ...recurringForm, amount: parseInt(e.target.value) || 0 })}
                style={{ width: '100%', padding: '14px', background: '#f2f2f7', border: 'none', borderRadius: '16px' }}
              />

              <div style={{ background: '#f2f2f7', borderRadius: '16px', padding: '14px' }}>
                <p style={{ fontSize: '0.8rem', color: '#8e8e93', marginBottom: '8px' }}>執行頻率</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['daily', 'weekly', 'monthly'].map(f => (
                    <button
                      key={f}
                      onClick={() => setRecurringForm({ ...recurringForm, frequency: f as any, executionDay: undefined })}
                      style={{
                        flex: 1, padding: '8px', borderRadius: '10px', border: 'none', fontSize: '0.85rem',
                        background: recurringForm.frequency === f ? '#007aff' : '#fff',
                        color: recurringForm.frequency === f ? '#fff' : '#000',
                        fontWeight: '600'
                      }}
                    >
                      {f === 'daily' ? '每日' : f === 'weekly' ? '每週' : '每月'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 每週：選擇星期幾 */}
              {recurringForm.frequency === 'weekly' && (
                <div style={{ background: '#f2f2f7', borderRadius: '16px', padding: '14px' }}>
                  <p style={{ fontSize: '0.8rem', color: '#8e8e93', marginBottom: '8px' }}>每週執行星期</p>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {['日', '一', '二', '三', '四', '五', '六'].map((d, i) => (
                      <button
                        key={i}
                        onClick={() => setRecurringForm({ ...recurringForm, executionDay: i })}
                        style={{
                          flex: 1, padding: '8px 4px', borderRadius: '10px', border: 'none',
                          fontSize: '0.78rem', fontWeight: '700',
                          background: recurringForm.executionDay === i ? '#5856d6' : '#fff',
                          color: recurringForm.executionDay === i ? '#fff' : (i === 0 || i === 6 ? '#ff453a' : '#000'),
                        }}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                  {recurringForm.executionDay === undefined && (
                    <p style={{ fontSize: '0.72rem', color: '#ff9500', marginTop: '6px' }}>⚠️ 請選擇執行星期</p>
                  )}
                </div>
              )}

              {/* 每月：選擇幾號 */}
              {recurringForm.frequency === 'monthly' && (
                <div style={{ background: '#f2f2f7', borderRadius: '16px', padding: '14px' }}>
                  <p style={{ fontSize: '0.8rem', color: '#8e8e93', marginBottom: '8px' }}>每月執行日期（號）</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                      <button
                        key={d}
                        onClick={() => setRecurringForm({ ...recurringForm, executionDay: d })}
                        style={{
                          width: 'calc(14.28% - 6px)', padding: '7px 0', borderRadius: '10px', border: 'none',
                          fontSize: '0.78rem', fontWeight: '700',
                          background: recurringForm.executionDay === d ? '#5856d6' : '#fff',
                          color: recurringForm.executionDay === d ? '#fff' : '#000',
                        }}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                  {recurringForm.executionDay === undefined && (
                    <p style={{ fontSize: '0.72rem', color: '#ff9500', marginTop: '6px' }}>⚠️ 請選擇執行日期</p>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={recurringForm.type || 'expense'}
                  onChange={e => setRecurringForm({ ...recurringForm, type: e.target.value as any, categoryId: categories.find(c => c.type === e.target.value)?.id })}
                  style={{ flex: 1, padding: '12px', borderRadius: '14px', border: 'none', background: '#f2f2f7' }}
                >
                  <option value="expense">支出</option>
                  <option value="income">收入</option>
                </select>
                <select
                  value={recurringForm.categoryId || ''}
                  onChange={e => setRecurringForm({ ...recurringForm, categoryId: e.target.value })}
                  style={{ flex: 1, padding: '12px', borderRadius: '14px', border: 'none', background: '#f2f2f7' }}
                >
                  {categories.filter(c => c.type === (recurringForm.type || 'expense')).map(c => (
                    <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                  ))}
                </select>
              </div>

              <select
                value={recurringForm.accountId || ''}
                onChange={e => setRecurringForm({ ...recurringForm, accountId: e.target.value })}
                style={{ width: '100%', padding: '12px', borderRadius: '14px', border: 'none', background: '#f2f2f7' }}
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.icon} {a.name}</option>
                ))}
              </select>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', padding: '4px' }}>
                <input
                  type="checkbox"
                  checked={recurringForm.active ?? true}
                  onChange={e => setRecurringForm({ ...recurringForm, active: e.target.checked })}
                />
                啟用此項定期任務
              </label>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
              <button className="bank-button-primary" style={{ background: '#eee', color: '#333', margin: 0, flex: 1 }} onClick={() => setRecurringForm(null)}>取消</button>
              <button className="bank-button-primary" style={{ margin: 0, flex: 1 }} onClick={handleSaveRecurring}>儲存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
