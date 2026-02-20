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
    type: 'income' | 'expense';
    categoryId: string;
    date: string; // ISO string or local date string
    time: string;
    note?: string;
}

export const INITIAL_EXPENSE_CATEGORIES: Category[] = [
    { id: "food", label: "餐飲", icon: "🍱", color: "#FF6384", type: 'expense' },
    { id: "transport", label: "交通", icon: "🚌", color: "#36A2EB", type: 'expense' },
    { id: "shopping", label: "購物", icon: "🛍️", color: "#FFCE56", type: 'expense' },
    { id: "entertainment", label: "娛樂", icon: "🎮", color: "#4BC0C0", type: 'expense' },
    { id: "daily", label: "日用", icon: "🧻", color: "#9966FF", type: 'expense' },
    { id: "medical", label: "醫療", icon: "💊", color: "#FF9F40", type: 'expense' },
    { id: "housing", label: "房租", icon: "🏠", color: "#C9CBCF", type: 'expense' },
    { id: "other_exp", label: "其他", icon: "✨", color: "#4D5360", type: 'expense' },
];

export const INITIAL_INCOME_CATEGORIES: Category[] = [
    { id: "salary", label: "薪資", icon: "💰", color: "#32D74B", type: 'income' },
    { id: "bonus", label: "獎金", icon: "🧧", color: "#FFD700", type: 'income' },
    { id: "investment", label: "投資", icon: "📈", color: "#5AC8FA", type: 'income' },
    { id: "part_time", label: "兼職", icon: "🛵", color: "#FF2D55", type: 'income' },
    { id: "other_inc", label: "其他", icon: "🧧", color: "#AF52DE", type: 'income' },
];
