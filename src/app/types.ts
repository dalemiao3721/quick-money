export interface Category {
    id: string;
    label: string;
    icon: string;
    color: string;
    type: 'income' | 'expense';
}

export interface Transaction {
    id: number;
    amount: number;
    type: 'income' | 'expense' | 'transfer';
    categoryId: string;
    accountId: string;
    toAccountId?: string; // For transfers
    fee?: number; // Fees associated with the transaction (especially transfers)
    date: string;
    time: string;
    note?: string;
    status?: string; // e.g., '已完成'
}

export interface Account {
    id: string;
    name: string;
    type: string; // e.g., '往來戶口', '現金', '存款'
    number: string;
    balance: number;
    holderName?: string;
    icon?: string;
}

export const INITIAL_ACCOUNTS: Account[] = [
    {
        id: "acc_1",
        name: "儲蓄",
        type: "SAVINGS",
        number: "223012419",
        balance: 50000,
        holderName: "MIAO MENG TA",
        icon: "🏦"
    },
    {
        id: "acc_2",
        name: "現金",
        type: "CASH",
        number: "----",
        balance: 5000,
        icon: "💵"
    }
];

export const INITIAL_EXPENSE_CATEGORIES: Category[] = [
    { id: "misc", label: "其他雜項", icon: "💰", color: "#ff8a65", type: 'expense' },
    { id: "gifts", label: "送禮&捐贈", icon: "🎁", color: "#aed581", type: 'expense' },
    { id: "housing", label: "住家", icon: "🏠", color: "#4fc3f7", type: 'expense' },
    { id: "family", label: "家庭", icon: "👨‍👩‍👧‍👦", color: "#ffab91", type: 'expense' },
    { id: "transport", label: "交通", icon: "🚌", color: "#36A2EB", type: 'expense' },
    { id: "food", label: "餐飲", icon: "🍱", color: "#FF6384", type: 'expense' },
];

export const INITIAL_INCOME_CATEGORIES: Category[] = [
    { id: "salary", label: "薪資", icon: "💰", color: "#32D74B", type: 'income' },
    { id: "bonus", label: "獎金", icon: "🧧", color: "#FFD700", type: 'income' },
    { id: "investment", label: "投資", icon: "📈", color: "#5AC8FA", type: 'income' },
    { id: "part_time", label: "兼職", icon: "🛵", color: "#FF2D55", type: 'income' },
    { id: "other_inc", label: "其他", icon: "🧧", color: "#AF52DE", type: 'income' },
];
