import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { requestAndRegisterFCMToken, listenForForegroundMessages } from './firebase';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const API_BASE = 'http://127.0.0.1:8000/api';

const CATEGORY_COLORS = {
  FOOD: '#f59e0b',
  TRAVEL: '#3b82f6',
  SHOPPING: '#ec4899',
  EDUCATION: '#8b5cf6',
  ENTERTAINMENT: '#10b981',
  MISCELLANEOUS: '#64748b',
};

const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const VIEW_META = {
  overview: {
    title: 'Overview & Activity',
    subtitle: 'Unified financial snapshot, recent transactions, and monthly report exports',
  },
  analytics: {
    title: 'Visual Analytics',
    subtitle: 'Category spending distribution, cashflow comparisons, and monthly trends',
  },
  expenses: {
    title: 'Expense Tracker',
    subtitle: 'Log, categorize, and manage your daily expenditures',
  },
  incomes: {
    title: 'Income Management',
    subtitle: 'Record pocket money, scholarships, freelance work, and other inflows',
  },
  budgets: {
    title: 'Budget Planning',
    subtitle: 'Set monthly category spending caps and monitor utilization alerts',
  },
  goals: {
    title: 'Savings Goals',
    subtitle: 'Create dedicated funding milestones and track deposit progress',
  },
  profile: {
    title: 'Profile & Account Settings',
    subtitle: 'Manage your account credentials, plan tier, preferences, and security',
  },
  admin: {
    title: 'Admin Control Panel',
    subtitle: 'Platform-wide user role assignments and account status management',
  },
};

export default function App() {
  // --- Auth State ---
  const [isLogin, setIsLogin] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('access_token') || null);
  const [authForm, setAuthForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'STUDENT',
  });
  const [authMessage, setAuthMessage] = useState('');

  // --- Responsive Sidebar State ---
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 900 : false
  );
  const [sidebarOpen, setSidebarOpen] = useState(
    typeof window !== 'undefined' ? window.innerWidth > 900 : true
  );

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 900;
      setIsMobile(mobile);
      setSidebarOpen(!mobile);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- Active View ('overview' | 'analytics' | 'expenses' | 'incomes' | 'budgets' | 'goals' | 'profile' | 'admin') ---
  const [activeTab, setActiveTab] = useState('overview');

  // --- Expenses State ---
  const [expenses, setExpenses] = useState([]);
  const [expenseForm, setExpenseForm] = useState({
    amount: '',
    category: 'FOOD',
    date: new Date().toISOString().split('T')[0],
    description: '',
  });
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [expenseError, setExpenseError] = useState('');

  // --- Incomes State ---
  const [incomes, setIncomes] = useState([]);
  const [incomeForm, setIncomeForm] = useState({
    amount: '',
    source: 'POCKET_MONEY',
    date: new Date().toISOString().split('T')[0],
    description: '',
  });
  const [editingIncomeId, setEditingIncomeId] = useState(null);
  const [incomeError, setIncomeError] = useState('');

  // --- Budgets State ---
  const [budgets, setBudgets] = useState([]);
  const [budgetForm, setBudgetForm] = useState({
    category: 'FOOD',
    monthly_limit: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });
  const [budgetError, setBudgetError] = useState('');

  // --- Savings Goals State ---
  const [goals, setGoals] = useState([]);
  const [goalForm, setGoalForm] = useState({
    title: '',
    target_amount: '',
    current_amount: '0.00',
    target_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [goalError, setGoalError] = useState('');
  const [depositInputs, setDepositInputs] = useState({});

  // --- Top-Right Menus (Notifications & Profile Dropdown) ---
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // --- User Profile, Account Settings & Password State ---
  const [profileForm, setProfileForm] = useState({
    username: '',
    email: '',
    role: 'STUDENT',
    monthly_income_baseline: '0.00',
    currency: 'INR',
    alert_threshold_percent: 80,
    monthly_report_notifications: true,
    updated_at: null,
  });
  const [profileMessage, setProfileMessage] = useState('');
  const [accountMessage, setAccountMessage] = useState('');
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [passwordMessage, setPasswordMessage] = useState('');

  // --- Admin Panel State ---
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminStats, setAdminStats] = useState({
    total_users: 0,
    students: 0,
    premium: 0,
    admins: 0,
    active: 0,
  });
  const [adminMessage, setAdminMessage] = useState('');

  // --- Section 9: Monthly Report & Export Selectors ---
  const [reportMonth, setReportMonth] = useState(String(new Date().getMonth() + 1));
  const [reportYear, setReportYear] = useState(String(new Date().getFullYear()));
  const [isExporting, setIsExporting] = useState(false);

  // --- Analytics Date Filter State ---
  const [dateFilterMode, setDateFilterMode] = useState('THIS_MONTH');
  const [customStartDate, setCustomStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [customEndDate, setCustomEndDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const isInvalidCustomRange = Boolean(
    customStartDate && customEndDate && customEndDate < customStartDate
  );

  // Derived Role & Layout Helpers
  const userRole = profileForm.role || 'STUDENT';
  const isStudentTier = userRole === 'STUDENT';
  const isPremiumOrAdmin = userRole === 'PREMIUM' || userRole === 'ADMIN';
  const isAdmin = userRole === 'ADMIN';
  const activeGoalsCount = goals.filter((g) => !g.is_completed && (g.progress_percentage || 0) < 100).length;
  const userInitial = (profileForm.username || 'U').charAt(0).toUpperCase();
  const isCollapsedDesktop = !isMobile && !sidebarOpen;

  // ----------------------------------------------------
  // Auth Handlers
  // ----------------------------------------------------
  const handleAuthChange = (e) => {
    setAuthForm({ ...authForm, [e.target.name]: e.target.value });
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthMessage('');

    try {
      const endpoint = isLogin ? `${API_BASE}/auth/login/` : `${API_BASE}/auth/register/`;
      const payload = isLogin
        ? { username: authForm.username, password: authForm.password }
        : authForm;

      const res = await axios.post(endpoint, payload);
      localStorage.setItem('access_token', res.data.access);
      localStorage.setItem('refresh_token', res.data.refresh);
      setToken(res.data.access);
    } catch (err) {
      const errData = err.response?.data;
      if (errData?.detail) {
        setAuthMessage(`Error: ${errData.detail}`);
      } else if (errData) {
        const firstKey = Object.keys(errData)[0];
        setAuthMessage(`Error (${firstKey}): ${JSON.stringify(errData[firstKey])}`);
      } else {
        setAuthMessage('Error: Server connection failed.');
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setToken(null);
    setExpenses([]);
    setIncomes([]);
    setBudgets([]);
    setGoals([]);
    setNotifications([]);
    setUnreadCount(0);
    setAdminUsers([]);
    setShowNotifications(false);
    setShowProfileMenu(false);
    setActiveTab('overview');
  };

  // ----------------------------------------------------
  // API Fetchers
  // ----------------------------------------------------
  const fetchExpenses = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_BASE}/expenses/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setExpenses(res.data.results || res.data || []);
    } catch (err) {
      console.error('Failed to fetch expenses:', err);
    }
  };

  const fetchIncomes = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_BASE}/incomes/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setIncomes(res.data.results || res.data || []);
    } catch (err) {
      console.error('Failed to fetch incomes:', err);
    }
  };

  const fetchBudgets = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_BASE}/budgets/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBudgets(res.data.results || res.data || []);
    } catch (err) {
      console.error('Failed to fetch budgets:', err);
    }
  };

  const fetchGoals = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_BASE}/goals/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setGoals(res.data.results || res.data || []);
    } catch (err) {
      console.error('Failed to fetch savings goals:', err);
    }
  };

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_BASE}/notifications/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(res.data.results || res.data || []);

      const countRes = await axios.get(`${API_BASE}/notifications/unread-count/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUnreadCount(countRes.data.unread_count || 0);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  const fetchProfile = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_BASE}/auth/profile/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfileForm(res.data);
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
    }
  };

  const fetchAdminUsers = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_BASE}/auth/admin/users/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAdminUsers(res.data.users || []);
      setAdminStats(
        res.data.stats || {
          total_users: 0,
          students: 0,
          premium: 0,
          admins: 0,
          active: 0,
        }
      );
    } catch (err) {
      setAdminUsers([]);
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await axios.post(
        `${API_BASE}/notifications/${id}/mark-read/`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchNotifications();
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await axios.post(
        `${API_BASE}/notifications/mark-all-read/`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchNotifications();
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchExpenses();
      fetchIncomes();
      fetchBudgets();
      fetchGoals();
      fetchNotifications();
      fetchProfile();

      // Register browser FCM device token with Django
      requestAndRegisterFCMToken(token);

      // Listen for live foreground push alerts
      const unsubscribe = listenForForegroundMessages((payload) => {
        fetchNotifications();
        const title = payload.notification?.title || 'BudgetBuddy Alert';
        const body = payload.notification?.body || '';
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(title, { body });
        }
      });

      return () => {
        if (typeof unsubscribe === 'function') unsubscribe();
      };
    }
  }, [token]);

  useEffect(() => {
    if (token && profileForm.role === 'ADMIN') {
      fetchAdminUsers();
    }
  }, [token, profileForm.role]);

  // ----------------------------------------------------
  // Profile, Account Details, Password & Admin Handlers
  // ----------------------------------------------------
  const handleProfileChange = (e) => {
    const { name, value, type, checked } = e.target;
    setProfileForm({
      ...profileForm,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSaveAccountDetails = async (e) => {
    e.preventDefault();
    setAccountMessage('');
    try {
      const res = await axios.patch(
        `${API_BASE}/auth/profile/`,
        {
          username: profileForm.username,
          email: profileForm.email,
          role: profileForm.role,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProfileForm(res.data);
      setAccountMessage('Account details & role plan updated successfully!');
    } catch (err) {
      const errData = err.response?.data;
      if (errData) {
        const firstKey = Object.keys(errData)[0];
        const msg = Array.isArray(errData[firstKey]) ? errData[firstKey][0] : errData[firstKey];
        setAccountMessage(`Error (${firstKey}): ${msg}`);
      } else {
        setAccountMessage('Error: Failed to update account details.');
      }
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileMessage('');
    try {
      const res = await axios.patch(
        `${API_BASE}/auth/profile/`,
        {
          monthly_income_baseline: profileForm.monthly_income_baseline,
          currency: profileForm.currency,
          alert_threshold_percent: parseInt(profileForm.alert_threshold_percent, 10),
          monthly_report_notifications: profileForm.monthly_report_notifications,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProfileForm(res.data);
      setProfileMessage('Financial & notification preferences saved successfully!');
    } catch (err) {
      setProfileMessage('Error: Failed to update profile settings.');
    }
  };

  const handlePasswordChange = (e) => {
    setPasswordForm({ ...passwordForm, [e.target.name]: e.target.value });
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMessage('');
    try {
      const res = await axios.post(
        `${API_BASE}/auth/change-password/`,
        passwordForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPasswordMessage(res.data.detail || 'Password updated successfully!');
      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
    } catch (err) {
      const errData = err.response?.data;
      if (errData) {
        const firstKey = Object.keys(errData)[0];
        const msg = Array.isArray(errData[firstKey]) ? errData[firstKey][0] : errData[firstKey];
        setPasswordMessage(`Error: ${msg}`);
      } else {
        setPasswordMessage('Error: Failed to update password.');
      }
    }
  };

  const handleAdminUpdateUser = async (userId, updates) => {
    setAdminMessage('');
    try {
      await axios.patch(`${API_BASE}/auth/admin/users/${userId}/`, updates, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAdminMessage('User permissions updated successfully.');
      fetchAdminUsers();
    } catch (err) {
      setAdminMessage(`Error: ${err.response?.data?.detail || 'Failed to update user.'}`);
    }
  };

  // ----------------------------------------------------
  // Section 9: Unified Export Handler (RBAC-Gated)
  // ----------------------------------------------------
  const handleExportReport = async (format) => {
    if (!token) return;

    if (isStudentTier && (format === 'pdf' || format === 'excel')) {
      alert(
        'PDF and Excel reports are Premium features. Switch your Account Plan to Premium User in Profile & Settings to unlock them!'
      );
      setActiveTab('profile');
      return;
    }

    setIsExporting(true);

    const configMap = {
      pdf: {
        endpoint: `${API_BASE}/expenses/export-pdf/`,
        mime: 'application/pdf',
        ext: 'pdf',
      },
      excel: {
        endpoint: `${API_BASE}/expenses/export-excel/`,
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ext: 'xlsx',
      },
      csv: {
        endpoint: `${API_BASE}/expenses/export-csv/`,
        mime: 'text/csv',
        ext: 'csv',
      },
    };

    const target = configMap[format];
    if (!target) {
      setIsExporting(false);
      return;
    }

    const params = {};
    let fileLabel = 'all_time';

    if (reportMonth !== 'ALL' && reportYear !== 'ALL') {
      params.month = reportMonth;
      params.year = reportYear;
      const mObj = MONTHS.find((m) => m.value === reportMonth);
      fileLabel = `${(mObj ? mObj.label : reportMonth).toLowerCase()}_${reportYear}`;
    } else if (reportYear !== 'ALL') {
      params.year = reportYear;
      fileLabel = `year_${reportYear}`;
    }

    try {
      const res = await axios.get(target.endpoint, {
        headers: { Authorization: `Bearer ${token}` },
        params,
        responseType: 'blob',
      });

      const contentType = res.headers['content-type'] || '';
      if (contentType.includes('application/json') || contentType.includes('text/html')) {
        const errorText = await res.data.text();
        console.error(`Server error during ${format.toUpperCase()} export:`, errorText);
        alert(`Failed to generate ${format.toUpperCase()} report. Check permissions or backend logs.`);
        setIsExporting(false);
        return;
      }

      const blob = new Blob([res.data], { type: target.mime });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `budgetbuddy_report_${fileLabel}.${target.ext}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      if (err.response?.status === 403) {
        alert('Upgrade to a Premium account in Profile & Settings to export PDF and Excel reports.');
        setActiveTab('profile');
      } else {
        console.error(`Failed to export ${format.toUpperCase()}:`, err);
        alert(`Failed to export ${format.toUpperCase()} report. Ensure backend is running.`);
      }
    } finally {
      setIsExporting(false);
    }
  };

  // ----------------------------------------------------
  // Expense Actions
  // ----------------------------------------------------
  const handleExpenseChange = (e) => {
    setExpenseForm({ ...expenseForm, [e.target.name]: e.target.value });
  };

  const handleStartEditExpense = (item) => {
    setActiveTab('expenses');
    setEditingExpenseId(item.id);
    setExpenseForm({
      amount: item.amount,
      category: item.category,
      date: item.date,
      description: item.description || '',
    });
  };

  const handleCancelEditExpense = () => {
    setEditingExpenseId(null);
    setExpenseForm({
      amount: '',
      category: 'FOOD',
      date: new Date().toISOString().split('T')[0],
      description: '',
    });
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    setExpenseError('');

    try {
      if (editingExpenseId) {
        await axios.patch(`${API_BASE}/expenses/${editingExpenseId}/`, expenseForm, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setEditingExpenseId(null);
      } else {
        await axios.post(`${API_BASE}/expenses/`, expenseForm, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      setExpenseForm({
        amount: '',
        category: 'FOOD',
        date: new Date().toISOString().split('T')[0],
        description: '',
      });

      fetchExpenses();
      fetchBudgets();
      fetchNotifications();
    } catch (err) {
      setExpenseError(JSON.stringify(err.response?.data || 'Failed to save expense.'));
    }
  };

  const handleDeleteExpense = async (id) => {
    try {
      await axios.delete(`${API_BASE}/expenses/${id}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchExpenses();
      fetchBudgets();
      fetchNotifications();
    } catch (err) {
      console.error('Failed to delete expense:', err);
    }
  };

  // ----------------------------------------------------
  // Income Actions
  // ----------------------------------------------------
  const handleIncomeChange = (e) => {
    setIncomeForm({ ...incomeForm, [e.target.name]: e.target.value });
  };

  const handleStartEditIncome = (item) => {
    setActiveTab('incomes');
    setEditingIncomeId(item.id);
    setIncomeForm({
      amount: item.amount,
      source: item.source,
      date: item.date,
      description: item.description || '',
    });
  };

  const handleCancelEditIncome = () => {
    setEditingIncomeId(null);
    setIncomeForm({
      amount: '',
      source: 'POCKET_MONEY',
      date: new Date().toISOString().split('T')[0],
      description: '',
    });
  };

  const handleSaveIncome = async (e) => {
    e.preventDefault();
    setIncomeError('');

    try {
      if (editingIncomeId) {
        await axios.patch(`${API_BASE}/incomes/${editingIncomeId}/`, incomeForm, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setEditingIncomeId(null);
      } else {
        await axios.post(`${API_BASE}/incomes/`, incomeForm, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      setIncomeForm({
        amount: '',
        source: 'POCKET_MONEY',
        date: new Date().toISOString().split('T')[0],
        description: '',
      });

      fetchIncomes();
    } catch (err) {
      setIncomeError(JSON.stringify(err.response?.data || 'Failed to save income.'));
    }
  };

  const handleDeleteIncome = async (id) => {
    try {
      await axios.delete(`${API_BASE}/incomes/${id}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchIncomes();
    } catch (err) {
      console.error('Failed to delete income:', err);
    }
  };

  // ----------------------------------------------------
  // Budget Actions
  // ----------------------------------------------------
  const handleBudgetChange = (e) => {
    setBudgetForm({ ...budgetForm, [e.target.name]: e.target.value });
  };

  const handleAddBudget = async (e) => {
    e.preventDefault();
    setBudgetError('');

    try {
      await axios.post(`${API_BASE}/budgets/`, budgetForm, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setBudgetForm({
        category: 'FOOD',
        monthly_limit: '',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
      });

      fetchBudgets();
      fetchNotifications();
    } catch (err) {
      const errData = err.response?.data;

      if (errData?.non_field_errors) {
          setBudgetError(errData.non_field_errors[0]);
      } else if (errData?.detail) {
          setBudgetError(errData.detail);
      } else if (typeof errData === 'string') {
          setBudgetError(errData);
      } else {
          setBudgetError(
              'Unable to create budget. Please check your details and try again.'
          );
      }
    }
  };

  const handleDeleteBudget = async (id) => {
    try {
      await axios.delete(`${API_BASE}/budgets/${id}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchBudgets();
      fetchNotifications();
    } catch (err) {
      console.error('Failed to delete budget:', err);
    }
  };

  // ----------------------------------------------------
  // Savings Goals Actions (RBAC-Aware)
  // ----------------------------------------------------
  const handleGoalChange = (e) => {
    setGoalForm({ ...goalForm, [e.target.name]: e.target.value });
  };

  const handleStartEditGoal = (item) => {
    setEditingGoalId(item.id);
    setGoalForm({
      title: item.title,
      target_amount: item.target_amount,
      current_amount: item.current_amount,
      target_date: item.target_date,
    });
  };

  const handleCancelEditGoal = () => {
    setEditingGoalId(null);
    setGoalForm({
      title: '',
      target_amount: '',
      current_amount: '0.00',
      target_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
  };

  const handleSaveGoal = async (e) => {
    e.preventDefault();
    setGoalError('');

    try {
      if (editingGoalId) {
        await axios.patch(`${API_BASE}/goals/${editingGoalId}/`, goalForm, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setEditingGoalId(null);
      } else {
        await axios.post(`${API_BASE}/goals/`, goalForm, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      setGoalForm({
        title: '',
        target_amount: '',
        current_amount: '0.00',
        target_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });

      fetchGoals();
      fetchNotifications();
    } catch (err) {
      const errData = err.response?.data;
      if (errData?.detail) {
        setGoalError(errData.detail);
      } else {
        setGoalError(JSON.stringify(errData || 'Failed to save savings goal.'));
      }
    }
  };

  const handleDeleteGoal = async (id) => {
    try {
      await axios.delete(`${API_BASE}/goals/${id}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchGoals();
      fetchNotifications();
    } catch (err) {
      console.error('Failed to delete goal:', err);
    }
  };

  const handleDepositAmountChange = (goalId, value) => {
    setDepositInputs({ ...depositInputs, [goalId]: value });
  };

  const handleQuickDeposit = async (goalId) => {
    const amount = depositInputs[goalId];
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid deposit amount greater than zero.');
      return;
    }

    try {
      await axios.post(
        `${API_BASE}/goals/${goalId}/deposit/`,
        { amount: parseFloat(amount) },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setDepositInputs({ ...depositInputs, [goalId]: '' });
      fetchGoals();
      fetchNotifications();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to record deposit toward goal.');
    }
  };

  // ----------------------------------------------------
  // Date Filtering Logic for Visual Analytics
  // ----------------------------------------------------
  const filteredExpenses = useMemo(() => {
    if (dateFilterMode === 'CUSTOM' && isInvalidCustomRange) return [];
    const today = new Date();
    return expenses.filter((item) => {
      if (!item.date) return false;
      const itemDate = new Date(item.date);

      if (dateFilterMode === 'THIS_MONTH') {
        return (
          itemDate.getFullYear() === today.getFullYear() &&
          itemDate.getMonth() === today.getMonth()
        );
      }
      if (dateFilterMode === 'LAST_30') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        return itemDate >= thirtyDaysAgo && itemDate <= today;
      }
      if (dateFilterMode === 'CUSTOM') {
        const start = customStartDate ? new Date(customStartDate) : null;
        const end = customEndDate ? new Date(`${customEndDate}T23:59:59.999`) : null;
        if (start && itemDate < start) return false;
        if (end && itemDate > end) return false;
        return true;
      }
      return true;
    });
  }, [expenses, dateFilterMode, customStartDate, customEndDate, isInvalidCustomRange]);

  const filteredIncomes = useMemo(() => {
    if (dateFilterMode === 'CUSTOM' && isInvalidCustomRange) return [];
    const today = new Date();
    return incomes.filter((item) => {
      if (!item.date) return false;
      const itemDate = new Date(item.date);

      if (dateFilterMode === 'THIS_MONTH') {
        return (
          itemDate.getFullYear() === today.getFullYear() &&
          itemDate.getMonth() === today.getMonth()
        );
      }
      if (dateFilterMode === 'LAST_30') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        return itemDate >= thirtyDaysAgo && itemDate <= today;
      }
      if (dateFilterMode === 'CUSTOM') {
        const start = customStartDate ? new Date(customStartDate) : null;
        const end = customEndDate ? new Date(`${customEndDate}T23:59:59.999`) : null;
        if (start && itemDate < start) return false;
        if (end && itemDate > end) return false;
        return true;
      }
      return true;
    });
  }, [incomes, dateFilterMode, customStartDate, customEndDate, isInvalidCustomRange]);

  const filteredExpenseTotal = useMemo(
    () => filteredExpenses.reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0),
    [filteredExpenses]
  );

  const filteredIncomeTotal = useMemo(
    () => filteredIncomes.reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0),
    [filteredIncomes]
  );

  // ----------------------------------------------------
  // Chart Data Computations
  // ----------------------------------------------------
  const categoryChartData = useMemo(() => {
    const grouped = filteredExpenses.reduce((acc, curr) => {
      const cat = curr.category || 'MISCELLANEOUS';
      acc[cat] = (acc[cat] || 0) + parseFloat(curr.amount || 0);
      return acc;
    }, {});

    return Object.keys(grouped).map((cat) => ({
      name: cat,
      value: parseFloat(grouped[cat].toFixed(2)),
      color: CATEGORY_COLORS[cat] || '#64748b',
    }));
  }, [filteredExpenses]);

  const goalsChartData = useMemo(() => {
    return goals.map((g) => ({
      name: g.title.length > 14 ? `${g.title.slice(0, 12)}...` : g.title,
      saved: parseFloat(g.current_amount || 0),
      target: parseFloat(g.target_amount || 0),
      progress: g.progress_percentage || 0,
    }));
  }, [goals]);


  const monthlyTrendsData = useMemo(() => {
    const monthBuckets = {};
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    const ensureBucket = (dateStr) => {
      if (!dateStr) return null;

      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;

      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      if (!monthBuckets[key]) {
        monthBuckets[key] = {
          sortKey: key,
          month: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
          income: 0,
          expenses: 0,
          net: 0,
        };
      }

      return monthBuckets[key];
    };

    filteredIncomes.forEach((inc) => {
      const bucket = ensureBucket(inc.date);
      if (bucket) bucket.income += Number(inc.amount || 0);
    });

    filteredExpenses.forEach((exp) => {
      const bucket = ensureBucket(exp.date);
      if (bucket) bucket.expenses += Number(exp.amount || 0);
    });

    return Object.values(monthBuckets)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map((b) => ({
        ...b,
        income: Number(b.income.toFixed(2)),
        expenses: Number(b.expenses.toFixed(2)),
        net: Number((b.income - b.expenses).toFixed(2)),
      }));
  }, [filteredExpenses, filteredIncomes]);


  const cashflowData = [
    { name: 'Income', amount: filteredIncomeTotal, fill: '#059669' },
    { name: 'Expenses', amount: filteredExpenseTotal, fill: '#dc2626' },
  ];

  // Budget utilization analytics (budget API supplies spent_amount and utilization_percentage).
  const budgetAnalyticsData = useMemo(() => budgets.map((budget) => ({
    name: `${budget.category} (${budget.month}/${budget.year})`,
    category: budget.category,
    spent: Number(budget.spent_amount || 0),
    limit: Number(budget.monthly_limit || 0),
    utilization: Number(budget.utilization_percentage || 0),
    remaining: Number(budget.remaining_amount || 0),
  })), [budgets]);

  const completedGoalsCount = goals.filter((goal) =>
    goal.is_completed || Number(goal.progress_percentage || 0) >= 100
  ).length;
  const goalCompletionRate = goals.length
    ? (completedGoalsCount / goals.length) * 100
    : 0;
  const averageDailyExpense = filteredExpenseTotal / Math.max(1, (() => {
    if (dateFilterMode === 'THIS_MONTH') return new Date().getDate();
    if (dateFilterMode === 'LAST_30') return 30;
    if (dateFilterMode === 'CUSTOM' && customStartDate && customEndDate && !isInvalidCustomRange) {
      return Math.max(1, Math.floor((new Date(`${customEndDate}T23:59:59`) - new Date(`${customStartDate}T00:00:00`)) / 86400000) + 1);
    }
    const dates = [...filteredExpenses, ...filteredIncomes].map((item) => item.date).filter(Boolean).sort();
    if (!dates.length) return 1;
    return Math.max(1, Math.floor((new Date(`${dates[dates.length - 1]}T00:00:00`) - new Date(`${dates[0]}T00:00:00`)) / 86400000) + 1);
  })());
  const filteredNetBalance = filteredIncomeTotal - filteredExpenseTotal;
  const filteredSavingsRate = filteredIncomeTotal > 0
    ? (filteredNetBalance / filteredIncomeTotal) * 100
    : 0;

  // Global All-Time Metrics
  const totalExpenseAmount = expenses.reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
  const totalIncomeAmount = incomes.reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
  const totalSavedGoals = goals.reduce((acc, curr) => acc + parseFloat(curr.current_amount || 0), 0);
  const netBalance = totalIncomeAmount - totalExpenseAmount;

  const unifiedTransactions = [
    ...expenses.map((item) => ({
      ...item,
      transactionType: 'EXPENSE',
      categoryOrSource: item.category,
      numericAmount: parseFloat(item.amount),
    })),
    ...incomes.map((item) => ({
      ...item,
      transactionType: 'INCOME',
      categoryOrSource: item.source,
      numericAmount: parseFloat(item.amount),
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  const recentTransactions = unifiedTransactions.slice(0, 8);

  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  // Sidebar Navigation Sections
  const sidebarGroups = [
    {
      group: 'WORKSPACE',
      items: [
        { id: 'overview', icon: '🏠', label: 'Overview & Activity' },
        { id: 'analytics', icon: '📊', label: 'Visual Analytics' },
      ],
    },
    {
      group: 'TRANSACTIONS',
      items: [
        { id: 'expenses', icon: '💸', label: 'Expenses' },
        { id: 'incomes', icon: '💰', label: 'Incomes' },
      ],
    },
    {
      group: 'PLANNING',
      items: [
        { id: 'budgets', icon: '📋', label: 'Budget Planning' },
        { id: 'goals', icon: '🎯', label: 'Savings Goals' },
      ],
    },
    ...(isAdmin
      ? [
          {
            group: 'ADMINISTRATION',
            items: [{ id: 'admin', icon: '🛡️', label: 'Admin Panel' }],
          },
        ]
      : []),
  ];

  const currentViewInfo = VIEW_META[activeTab] || VIEW_META.overview;

  // Dynamic Sidebar Style (Mobile Drawer vs. Desktop Collapsible Rail)
  const dynamicSidebarStyle = {
    ...ui.sidebar,
    width: isMobile ? '260px' : sidebarOpen ? '260px' : '76px',
    position: isMobile ? 'fixed' : 'sticky',
    left: 0,
    top: 0,
    zIndex: 60,
    transform: isMobile && !sidebarOpen ? 'translateX(-100%)' : 'translateX(0)',
    transition: 'width 0.22s ease, transform 0.24s ease',
  };

  // ----------------------------------------------------
  // Authentication Screen
  // ----------------------------------------------------
  if (!token) {
    return (
      <div style={ui.authPage}>
        <div style={ui.authCard}>
          <div style={ui.authBrand}>
            <div style={ui.authIconBox}>💳</div>
            <h2 style={ui.authTitle}>{isLogin ? 'Welcome Back' : 'Create an Account'}</h2>
            <p style={ui.authSubtitle}>
              {isLogin
                ? 'Sign in to access your BudgetBuddy workspace'
                : 'Join BudgetBuddy to manage your personal finances'}
            </p>
          </div>

          {authMessage && <div style={ui.errorBanner}>{authMessage}</div>}

          <form onSubmit={handleAuthSubmit} style={ui.formVertical}>
            <div style={ui.fieldWrapper}>
              <label style={ui.label}>Username</label>
              <input
                style={ui.input}
                name="username"
                placeholder="e.g. johndoe"
                value={authForm.username}
                onChange={handleAuthChange}
                required
              />
            </div>

            {!isLogin && (
              <>
                <div style={ui.fieldWrapper}>
                  <label style={ui.label}>Email Address</label>
                  <input
                    style={ui.input}
                    name="email"
                    type="email"
                    placeholder="john@example.com"
                    value={authForm.email}
                    onChange={handleAuthChange}
                    required
                  />
                </div>
                <div style={ui.fieldWrapper}>
                  <label style={ui.label}>Account Role</label>
                  <select
                    style={ui.input}
                    name="role"
                    value={authForm.role}
                    onChange={handleAuthChange}
                  >
                    <option value="STUDENT">Student (Up to 3 Goals, CSV Export)</option>
                    <option value="PREMIUM">Premium User (Unlimited Goals, PDF & Excel)</option>
                    <option value="ADMIN">Admin (Full Platform Access)</option>
                  </select>
                </div>
              </>
            )}

            <div style={ui.fieldWrapper}>
              <label style={ui.label}>Password</label>
              <input
                style={ui.input}
                name="password"
                type="password"
                placeholder="••••••••"
                value={authForm.password}
                onChange={handleAuthChange}
                required
              />
            </div>

            <button style={ui.btnPrimaryFull} type="submit">
              {isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p style={ui.authSwitch}>
            {isLogin ? "Don't have an account yet? " : 'Already have an account? '}
            <span style={ui.linkHighlight} onClick={() => setIsLogin(!isLogin)}>
              {isLogin ? 'Register' : 'Log In'}
            </span>
          </p>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // Responsive Left-Sidebar + Top-Right Profile Workspace
  // ----------------------------------------------------
  return (
    <div style={ui.appShell}>
      {/* Mobile Backdrop Overlay */}
      {isMobile && sidebarOpen && (
        <div
          style={ui.mobileBackdrop}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ==================================================== */}
      {/* COLLAPSIBLE LEFT SIDEBAR NAVIGATION                  */}
      {/* ==================================================== */}
      <aside style={dynamicSidebarStyle}>
        {/* Sidebar Brand Header */}
        <div
          style={{
            ...ui.sidebarHeader,
            justifyContent: isCollapsedDesktop ? 'center' : 'space-between',
            padding: isCollapsedDesktop ? '22px 12px' : '22px 20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={ui.brandLogo}>₹</div>
            {!isCollapsedDesktop && (
              <div>
                <div style={ui.brandName}>BudgetBuddy</div>
                <div style={ui.brandSub}>Personal Finance</div>
              </div>
            )}
          </div>

          {isMobile && (
            <button
              type="button"
              aria-label="Close navigation menu"
              style={ui.sidebarCloseBtn}
              onClick={() => setSidebarOpen(false)}
            >
              ✕
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <div style={ui.sidebarNavScroll}>
          {sidebarGroups.map((group) => (
            <div key={group.group} style={ui.sidebarGroup}>
              {!isCollapsedDesktop && (
                <div style={ui.sidebarGroupLabel}>{group.group}</div>
              )}
              {group.items.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={isCollapsedDesktop ? item.label : undefined}
                    style={{
                      ...(isActive ? ui.sidebarItemActive : ui.sidebarItem),
                      justifyContent: isCollapsedDesktop ? 'center' : 'flex-start',
                      padding: isCollapsedDesktop ? '11px 0' : '10px 12px',
                    }}
                    onClick={() => {
                      setActiveTab(item.id);
                      setShowProfileMenu(false);
                      setShowNotifications(false);
                      if (isMobile) setSidebarOpen(false);
                    }}
                  >
                    <span style={{ fontSize: '17px', width: '22px', textAlign: 'center', flexShrink: 0 }}>
                      {item.icon}
                    </span>
                    {!isCollapsedDesktop && <span>{item.label}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Sidebar Bottom Reserve Card (Expanded vs. Compact Icon) */}
        {!isCollapsedDesktop ? (
          <div style={ui.sidebarFooterCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8' }}>NET RESERVE</span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: '800',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: isAdmin
                    ? 'rgba(245, 158, 11, 0.2)'
                    : isPremiumOrAdmin
                    ? 'rgba(139, 92, 246, 0.25)'
                    : 'rgba(59, 130, 246, 0.25)',
                  color: isAdmin ? '#fbbf24' : isPremiumOrAdmin ? '#c4b5fd' : '#93c5fd',
                }}
              >
                {userRole}
              </span>
            </div>
            <div
              style={{
                fontSize: '18px',
                fontWeight: '800',
                color: netBalance >= 0 ? '#34d399' : '#f87171',
                marginTop: '4px',
              }}
            >
              ₹{netBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              {activeGoalsCount} active savings {activeGoalsCount === 1 ? 'goal' : 'goals'}
            </div>
          </div>
        ) : (
          <div
            title={`Net Reserve: ₹${netBalance.toFixed(2)} (${userRole})`}
            style={{
              margin: '12px auto',
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: '800',
              color: netBalance >= 0 ? '#34d399' : '#f87171',
            }}
          >
            ₹
          </div>
        )}
      </aside>

      {/* ==================================================== */}
      {/* RIGHT WORKSPACE COLUMN (TOP HEADER + MAIN CONTENT)   */}
      {/* ==================================================== */}
      <div style={ui.contentColumn}>
        {/* Top Header Bar with Sidebar Toggle + Top-Right Profile */}
        <header
          style={{
            ...ui.topHeader,
            padding: isMobile ? '14px 16px' : '16px 32px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
            <button
              type="button"
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              style={ui.sidebarToggleBtn}
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              ☰
            </button>

            <div style={{ minWidth: 0 }}>
              <h1 style={{ ...ui.pageHeading, fontSize: isMobile ? '17px' : '20px' }}>
                {currentViewInfo.title}
              </h1>
              {!isMobile && <p style={ui.pageSubheading}>{currentViewInfo.subtitle}</p>}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '14px' }}>
            {/* Notification Bell Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                aria-label="Notifications"
                style={ui.iconButton}
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setShowProfileMenu(false);
                }}
              >
                🔔
                {unreadCount > 0 && <span style={ui.unreadBadge}>{unreadCount}</span>}
              </button>

              {showNotifications && (
                <div style={{ ...ui.dropdownMenu, width: isMobile ? '290px' : '340px' }}>
                  <div style={ui.dropdownHeader}>
                    <span style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>
                      Notifications ({unreadCount} new)
                    </span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        style={ui.dropdownActionLink}
                        onClick={handleMarkAllAsRead}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <p style={ui.dropdownEmpty}>No notifications yet</p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid #f1f5f9',
                            backgroundColor: n.is_read ? '#ffffff' : '#f0fdf4',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            cursor: 'pointer',
                          }}
                          onClick={() => !n.is_read && handleMarkAsRead(n.id)}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>
                              {n.title}
                            </span>
                            {!n.is_read && (
                              <span
                                style={{
                                  width: '7px',
                                  height: '7px',
                                  borderRadius: '50%',
                                  backgroundColor: '#10b981',
                                }}
                              />
                            )}
                          </div>
                          <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: '1.4' }}>
                            {n.message}
                          </p>
                          <span style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                            {new Date(n.created_at).toLocaleDateString()}{' '}
                            {new Date(n.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* TOP-RIGHT PROFILE OPTION & DROPDOWN */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                style={
                  activeTab === 'profile'
                    ? { ...ui.profileTrigger, borderColor: '#4f46e5', backgroundColor: '#eef2ff' }
                    : ui.profileTrigger
                }
                onClick={() => {
                  setShowProfileMenu(!showProfileMenu);
                  setShowNotifications(false);
                }}
              >
                <div style={ui.avatarCircle}>{userInitial}</div>
                {!isMobile && (
                  <div style={{ textAlign: 'left', lineHeight: '1.2' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                      {profileForm.username || 'Account'}
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b' }}>
                      {userRole}
                    </div>
                  </div>
                )}
                <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '2px' }}>▾</span>
              </button>

              {showProfileMenu && (
                <div style={{ ...ui.dropdownMenu, width: '240px' }}>
                  <div
                    style={{
                      padding: '14px 16px',
                      borderBottom: '1px solid #f1f5f9',
                      backgroundColor: '#fafbfc',
                    }}
                  >
                    <div style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>
                      {profileForm.username || 'User'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      {profileForm.email || 'No email set'}
                    </div>
                  </div>

                  <div style={{ padding: '6px' }}>
                    <button
                      type="button"
                      style={ui.dropdownMenuItem}
                      onClick={() => {
                        setActiveTab('profile');
                        setShowProfileMenu(false);
                      }}
                    >
                      <span>👤</span>
                      <span>Profile & Settings</span>
                    </button>

                    {isAdmin && (
                      <button
                        type="button"
                        style={ui.dropdownMenuItem}
                        onClick={() => {
                          setActiveTab('admin');
                          setShowProfileMenu(false);
                        }}
                      >
                        <span>🛡️</span>
                        <span>Admin Control Panel</span>
                      </button>
                    )}

                    <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '6px 0' }} />

                    <button
                      type="button"
                      style={{ ...ui.dropdownMenuItem, color: '#dc2626' }}
                      onClick={handleLogout}
                    >
                      <span>🚪</span>
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Workspace Container */}
        <main
          style={{
            ...ui.mainArea,
            padding: isMobile ? '20px 16px' : '28px 32px',
          }}
        >
          {/* Metric Summary Cards (Shown on Overview & Analytics) */}
          {(activeTab === 'overview' || activeTab === 'analytics') && (
            <section style={ui.metricGrid}>
              <div style={ui.statCard}>
                <div style={ui.statHeader}>
                  <span style={ui.statTitle}>Total Incomes</span>
                  <span style={ui.statIconGreen}>↗</span>
                </div>
                <div style={{ ...ui.statAmount, color: '#059669' }}>
                  +₹{(activeTab === 'analytics' ? filteredIncomeTotal : totalIncomeAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <span style={ui.statSub}>Total deposits recorded</span>
              </div>

              <div style={ui.statCard}>
                <div style={ui.statHeader}>
                  <span style={ui.statTitle}>Total Expenses</span>
                  <span style={ui.statIconRed}>↘</span>
                </div>
                <div style={{ ...ui.statAmount, color: '#dc2626' }}>
                  -₹{(activeTab === 'analytics' ? filteredExpenseTotal : totalExpenseAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <span style={ui.statSub}>Total expenditures logged</span>
              </div>

              <div style={ui.statCard}>
                <div style={ui.statHeader}>
                  <span style={ui.statTitle}>Net Balance</span>
                  <span style={ui.statIconBlue}>=</span>
                </div>
                <div
                  style={{
                    ...ui.statAmount,
                    color: (activeTab === 'analytics' ? filteredNetBalance : netBalance) >= 0 ? '#4f46e5' : '#dc2626',
                  }}
                >
                  ₹{(activeTab === 'analytics' ? filteredNetBalance : netBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <span style={ui.statSub}>Current cash reserve</span>
              </div>

              <div style={ui.statCard}>
                <div style={ui.statHeader}>
                  <span style={ui.statTitle}>Savings Allocated</span>
                  <span style={ui.statIconPurple}>🎯</span>
                </div>
                <div style={{ ...ui.statAmount, color: '#7c3aed' }}>
                  ₹{totalSavedGoals.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <span style={ui.statSub}>
                  {isStudentTier
                    ? `${activeGoalsCount}/3 Student goal slots used`
                    : `Across ${goals.length} goals (Unlimited)`}
                </span>
              </div>
            </section>
          )}

          {/* ==================================================== */}
          {/* VIEW 0: OVERVIEW & ACTIVITY + REPORTS & EXPORT       */}
          {/* ==================================================== */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <section style={ui.card}>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '16px',
                  }}
                >
                  <div>
                    <h3 style={ui.cardTitle}>📑 Financial Reports & Export Center</h3>
                    <p style={ui.cardSubtitle}>
                      {isStudentTier
                        ? 'Student Plan includes CSV exports. Upgrade to Premium in Profile & Settings for PDF & Excel reports.'
                        : 'Generate monthly or all-time financial summaries, category breakdowns, and expense history reports'}
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
                    <select
                      aria-label="Report Month"
                      style={{ ...ui.input, width: '145px', padding: '8px 12px', fontWeight: '600' }}
                      value={reportMonth}
                      onChange={(e) => setReportMonth(e.target.value)}
                    >
                      <option value="ALL">All Months</option>
                      {MONTHS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>

                    <select
                      aria-label="Report Year"
                      style={{ ...ui.input, width: '110px', padding: '8px 12px', fontWeight: '600' }}
                      value={reportYear}
                      onChange={(e) => setReportYear(e.target.value)}
                    >
                      <option value="ALL">All Years</option>
                      {yearOptions.map((yr) => (
                        <option key={yr} value={String(yr)}>
                          {yr}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={isExporting}
                      style={{
                        backgroundColor: isStudentTier ? '#94a3b8' : '#dc2626',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '9px 14px',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: isExporting ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        opacity: isExporting ? 0.7 : 1,
                      }}
                      onClick={() => handleExportReport('pdf')}
                    >
                      {isStudentTier ? '🔒 Export PDF (Pro)' : '📄 Export PDF'}
                    </button>

                    <button
                      type="button"
                      disabled={isExporting}
                      style={{
                        backgroundColor: isStudentTier ? '#94a3b8' : '#059669',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '9px 14px',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: isExporting ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        opacity: isExporting ? 0.7 : 1,
                      }}
                      onClick={() => handleExportReport('excel')}
                    >
                      {isStudentTier ? '🔒 Export Excel (Pro)' : '📊 Export Excel (.xlsx)'}
                    </button>

                    <button
                      type="button"
                      disabled={isExporting}
                      style={{
                        backgroundColor: '#4f46e5',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '9px 14px',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: isExporting ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        opacity: isExporting ? 0.7 : 1,
                      }}
                      onClick={() => handleExportReport('csv')}
                    >
                      📥 Export CSV
                    </button>
                  </div>
                </div>
              </section>

              <section style={ui.card}>
                <div style={ui.cardHeader}>
                  <div>
                    <h3 style={ui.cardTitle}>Recent Daily Transactions</h3>
                    <p style={ui.cardSubtitle}>Your unified timeline of inflows and outflows</p>
                  </div>
                  <span style={ui.badgeSlate}>Latest {recentTransactions.length} records</span>
                </div>

                {recentTransactions.length === 0 ? (
                  <div style={ui.emptyState}>No transactions recorded yet.</div>
                ) : (
                  <div style={ui.tableWrapper}>
                    <table style={ui.table}>
                      <thead>
                        <tr>
                          <th style={ui.th}>Date</th>
                          <th style={ui.th}>Type</th>
                          <th style={ui.th}>Category / Source</th>
                          <th style={ui.th}>Description</th>
                          <th style={ui.thRight}>Amount</th>
                          <th style={ui.thRight}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentTransactions.map((tx) => {
                          const isIncome = tx.transactionType === 'INCOME';
                          return (
                            <tr key={`${tx.transactionType}-${tx.id}`} style={ui.tr}>
                              <td style={ui.tdMuted}>{tx.date}</td>
                              <td style={ui.td}>
                                <span style={isIncome ? ui.tagGreen : ui.tagRed}>
                                  {tx.transactionType}
                                </span>
                              </td>
                              <td style={ui.tdBold}>{tx.categoryOrSource}</td>
                              <td style={ui.tdMuted}>{tx.description || '—'}</td>
                              <td
                                style={{
                                  ...ui.tdRight,
                                  fontWeight: '600',
                                  color: isIncome ? '#059669' : '#dc2626',
                                }}
                              >
                                {isIncome
                                  ? `+₹${tx.numericAmount.toFixed(2)}`
                                  : `-₹${tx.numericAmount.toFixed(2)}`}
                              </td>
                              <td style={ui.tdRight}>
                                <div style={{ display: 'inline-flex', gap: '6px' }}>
                                  <button
                                    style={ui.btnSmallEdit}
                                    onClick={() =>
                                      isIncome
                                        ? handleStartEditIncome(tx)
                                        : handleStartEditExpense(tx)
                                    }
                                  >
                                    Edit
                                  </button>
                                  <button
                                    style={ui.btnSmallDelete}
                                    onClick={() =>
                                      isIncome
                                        ? handleDeleteIncome(tx.id)
                                        : handleDeleteExpense(tx.id)
                                    }
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* ==================================================== */}
          {/* VIEW 1: VISUAL ANALYTICS (WITH MONTHLY TRENDS CHART) */}
          {/* ==================================================== */}
          {activeTab === 'analytics' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <section style={ui.card}>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '14px',
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#475569', marginRight: '6px' }}>
                      TIME PERIOD:
                    </span>
                    {[
                      { id: 'THIS_MONTH', label: 'This Month' },
                      { id: 'LAST_30', label: 'Last 30 Days' },
                      { id: 'ALL', label: 'All Time' },
                      { id: 'CUSTOM', label: 'Custom Range' },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        style={
                          dateFilterMode === mode.id
                            ? {
                                ...ui.btnSecondary,
                                backgroundColor: '#4f46e5',
                                color: '#ffffff',
                                borderColor: '#4f46e5',
                              }
                            : ui.btnSecondary
                        }
                        onClick={() => setDateFilterMode(mode.id)}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>

                  <span style={ui.badgeSlate}>
                    Analyzing {filteredExpenses.length} Expenses | {filteredIncomes.length} Deposits
                  </span>
                </div>

                {dateFilterMode === 'CUSTOM' && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '16px',
                      marginTop: '16px',
                      paddingTop: '16px',
                      borderTop: '1px solid #f1f5f9',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={ui.microLabel}>Start Date:</label>
                      <input
                        type="date"
                        style={{ ...ui.input, width: '160px', padding: '6px 10px' }}
                        value={customStartDate}
                        max={customEndDate || undefined}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={ui.microLabel}>End Date:</label>
                      <input
                        type="date"
                        style={{ ...ui.input, width: '160px', padding: '6px 10px' }}
                        value={customEndDate}
                        min={customStartDate || undefined}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                )}
                {dateFilterMode === 'CUSTOM' && isInvalidCustomRange && (
                  <p style={{ color: '#dc2626', fontSize: '12px', margin: '10px 0 0' }}>
                    End date cannot be earlier than start date. Select a valid date range.
                  </p>
                )}
              </section>

              <section style={ui.metricGrid}>
                <div style={ui.statCard}>
                  <span style={ui.statTitle}>Average Daily Spending</span>
                  <div style={{ ...ui.statAmount, color: '#dc2626' }}>
                    ₹{averageDailyExpense.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <span style={ui.statSub}>Average expenses per day in selected period</span>
                </div>
                <div style={ui.statCard}>
                  <span style={ui.statTitle}>Savings Rate</span>
                  <div style={{ ...ui.statAmount, color: filteredSavingsRate >= 0 ? '#059669' : '#dc2626' }}>
                    {filteredSavingsRate.toFixed(1)}%
                  </div>
                  <span style={ui.statSub}>Net income divided by income for selected period</span>
                </div>
                <div style={ui.statCard}>
                  <span style={ui.statTitle}>Goal Completion Rate</span>
                  <div style={{ ...ui.statAmount, color: '#7c3aed' }}>{goalCompletionRate.toFixed(1)}%</div>
                  <span style={ui.statSub}>{completedGoalsCount} of {goals.length} goals completed</span>
                </div>
                <div style={ui.statCard}>
                  <span style={ui.statTitle}>Budget Alerts</span>
                  <div style={{ ...ui.statAmount, color: budgetAnalyticsData.filter((b) => b.utilization >= 80).length ? '#d97706' : '#059669' }}>
                    {budgetAnalyticsData.filter((b) => b.utilization >= 80).length}
                  </div>
                  <span style={ui.statSub}>Budgets at or above 80% utilization</span>
                </div>
              </section>

              <div style={ui.chartGridTwoCol}>
                <section style={ui.card}>
                  <div style={ui.cardHeader}>
                    <div>
                      <h3 style={ui.cardTitle}>Category Spending Breakdown</h3>
                      <p style={ui.cardSubtitle}>Distribution for the selected interval</p>
                    </div>
                    <span style={ui.badgeSlate}>Total: ₹{filteredExpenseTotal.toFixed(2)}</span>
                  </div>

                  {categoryChartData.length === 0 ? (
                    <div style={ui.emptyState}>No expense records found for this period.</div>
                  ) : (
                    <div style={{ width: '100%', height: 320 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryChartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={65}
                            outerRadius={95}
                            paddingAngle={4}
                          >
                            {categoryChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [`₹${parseFloat(value).toFixed(2)}`, 'Spent']} />
                          <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </section>

                <section style={ui.card}>
                  <div style={ui.cardHeader}>
                    <div>
                      <h3 style={ui.cardTitle}>Cashflow Summary</h3>
                      <p style={ui.cardSubtitle}>Inflow vs. Outflow for period</p>
                    </div>
                    <span style={ui.badgeSlate}>
                      Net: ₹{(filteredIncomeTotal - filteredExpenseTotal).toFixed(2)}
                    </span>
                  </div>

                  <div style={{ width: '100%', height: 320 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={cashflowData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" stroke="#64748b" />
                        <YAxis stroke="#64748b" tickFormatter={(v) => `₹${v}`} />
                        <Tooltip formatter={(value) => [`₹${parseFloat(value).toFixed(2)}`, 'Total']} />
                        <Bar dataKey="amount" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              </div>

              <section style={ui.card}>
                <div style={ui.cardHeader}>
                  <div>
                    <h3 style={ui.cardTitle}>Budget Utilization Analysis</h3>
                    <p style={ui.cardSubtitle}>Actual spending compared with each monthly category budget</p>
                  </div>
                  <span style={ui.badgeSlate}>{budgetAnalyticsData.length} Budgets</span>
                </div>
                {budgetAnalyticsData.length === 0 ? (
                  <div style={ui.emptyState}>Create monthly budgets to view utilization analysis.</div>
                ) : (
                  <div style={{ width: '100%', height: 340 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={budgetAnalyticsData} margin={{ top: 20, right: 25, left: 10, bottom: 55 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" stroke="#64748b" angle={-25} textAnchor="end" interval={0} height={75} />
                        <YAxis stroke="#64748b" tickFormatter={(v) => `₹${v}`} />
                        <Tooltip formatter={(value) => [`₹${Number(value).toFixed(2)}`]} />
                        <Legend />
                        <Bar dataKey="spent" fill="#4f46e5" name="Amount Spent" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="limit" fill="#cbd5e1" name="Budget Limit" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {budgetAnalyticsData.length > 0 && (
                  <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                    {budgetAnalyticsData.map((budget, index) => (
                      <div key={`${budget.name}-${index}`} style={{ padding: '12px', background: '#f8fafc', borderRadius: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '12px', fontWeight: '700' }}>
                          <span>{budget.category}</span><span>{budget.utilization.toFixed(1)}%</span>
                        </div>
                        <div style={ui.progressBarTrack}>
                          <div style={{ ...ui.progressBarFill, width: `${Math.min(Math.max(budget.utilization, 0), 100)}%`, backgroundColor: budget.utilization >= 100 ? '#dc2626' : budget.utilization >= 80 ? '#d97706' : '#059669' }} />
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '5px' }}>
                          ₹{budget.spent.toFixed(2)} spent of ₹{budget.limit.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section style={ui.card}>
                <div style={ui.cardHeader}>
                  <div>
                    <h3 style={ui.cardTitle}>Monthly Income vs. Spending Trends</h3>
                    <p style={ui.cardSubtitle}>Chronological cashflow trajectory across recorded months</p>
                  </div>
                  <span style={ui.badgeSlate}>{monthlyTrendsData.length} Months Tracked</span>
                </div>

                {monthlyTrendsData.length === 0 ? (
                  <div style={ui.emptyState}>Record transactions across dates to view monthly trends.</div>
                ) : (
                  <div style={{ width: '100%', height: 340 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthlyTrendsData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="month" stroke="#64748b" />
                        <YAxis stroke="#64748b" tickFormatter={(v) => `₹${v}`} />
                        <Tooltip formatter={(value) => [`₹${parseFloat(value).toFixed(2)}`]} />
                        <Legend />
                        <Line type="monotone" dataKey="income" stroke="#059669" strokeWidth={3} name="Monthly Income" />
                        <Line type="monotone" dataKey="expenses" stroke="#dc2626" strokeWidth={3} name="Monthly Expenses" />
                        <Line type="monotone" dataKey="net" stroke="#4f46e5" strokeWidth={2} strokeDasharray="5 5" name="Net Savings" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </section>

              <section style={ui.card}>
                <div style={ui.cardHeader}>
                  <div>
                    <h3 style={ui.cardTitle}>Savings Goals Progress Comparison</h3>
                    <p style={ui.cardSubtitle}>Current amount saved vs. total target per goal</p>
                  </div>
                  <span style={ui.badgeSlate}>{completedGoalsCount}/{goals.length} Completed</span>
                </div>

                {goalsChartData.length === 0 ? (
                  <div style={ui.emptyState}>No goals created yet. Create a goal to view the chart.</div>
                ) : (
                  <div style={{ width: '100%', height: 340 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={goalsChartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" stroke="#64748b" />
                        <YAxis stroke="#64748b" tickFormatter={(v) => `₹${v}`} />
                        <Tooltip formatter={(value) => [`₹${parseFloat(value).toFixed(2)}`]} />
                        <Legend />
                        <Bar dataKey="saved" fill="#7c3aed" name="Saved Amount" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="target" fill="#cbd5e1" name="Target Amount" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* ==================================================== */}
          {/* VIEW 2: EXPENSES                                     */}
          {/* ==================================================== */}
          {activeTab === 'expenses' && (
            <div style={isMobile ? ui.mobileStackGrid : ui.splitGrid}>
              <section style={ui.card}>
                <h3 style={ui.cardTitle}>
                  {editingExpenseId ? '✏️ Edit Expense' : '➕ Record Expense'}
                </h3>
                <p style={ui.cardSubtitle}>
                  {editingExpenseId ? 'Update details for this record' : 'Log a new personal outflow'}
                </p>

                {expenseError && <div style={ui.errorBanner}>{expenseError}</div>}

                <form onSubmit={handleSaveExpense} style={ui.formVertical}>
                  <div style={ui.fieldWrapper}>
                    <label style={ui.label}>Amount (₹)</label>
                    <input
                      style={ui.input}
                      type="number"
                      step="0.01"
                      name="amount"
                      value={expenseForm.amount}
                      onChange={handleExpenseChange}
                      required
                      placeholder="e.g. 250.00"
                    />
                  </div>

                  <div style={ui.fieldWrapper}>
                    <label style={ui.label}>Category</label>
                    <select
                      style={ui.input}
                      name="category"
                      value={expenseForm.category}
                      onChange={handleExpenseChange}
                    >
                      <option value="FOOD">Food & Dining</option>
                      <option value="TRAVEL">Travel & Transport</option>
                      <option value="SHOPPING">Shopping</option>
                      <option value="EDUCATION">Education & Books</option>
                      <option value="ENTERTAINMENT">Entertainment</option>
                      <option value="MISCELLANEOUS">Miscellaneous</option>
                    </select>
                  </div>

                  <div style={ui.fieldWrapper}>
                    <label style={ui.label}>Date</label>
                    <input
                      style={ui.input}
                      type="date"
                      name="date"
                      value={expenseForm.date}
                      onChange={handleExpenseChange}
                      required
                    />
                  </div>

                  <div style={ui.fieldWrapper}>
                    <label style={ui.label}>Description</label>
                    <input
                      style={ui.input}
                      name="description"
                      value={expenseForm.description}
                      onChange={handleExpenseChange}
                      placeholder="Optional notes..."
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button
                      style={editingExpenseId ? ui.btnWarning : ui.btnPrimaryFull}
                      type="submit"
                    >
                      {editingExpenseId ? '✓ Update Expense' : '+ Save Expense'}
                    </button>
                    {editingExpenseId && (
                      <button
                        type="button"
                        style={ui.btnSecondary}
                        onClick={handleCancelEditExpense}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </section>

              <section style={ui.card}>
                <div style={ui.cardHeader}>
                  <div>
                    <h3 style={ui.cardTitle}>Expense History</h3>
                    <p style={ui.cardSubtitle}>All recorded expenditures</p>
                  </div>
                  <span style={ui.badgeSlate}>{expenses.length} records</span>
                </div>

                {expenses.length === 0 ? (
                  <div style={ui.emptyState}>No expenses recorded yet.</div>
                ) : (
                  <div style={ui.tableWrapper}>
                    <table style={ui.table}>
                      <thead>
                        <tr>
                          <th style={ui.th}>Date</th>
                          <th style={ui.th}>Category</th>
                          <th style={ui.th}>Description</th>
                          <th style={ui.thRight}>Amount</th>
                          <th style={ui.thRight}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenses.map((item) => (
                          <tr key={item.id} style={ui.tr}>
                            <td style={ui.tdMuted}>{item.date}</td>
                            <td style={ui.td}>
                              <span style={ui.tagRed}>{item.category}</span>
                            </td>
                            <td style={ui.tdMuted}>{item.description || '—'}</td>
                            <td style={{ ...ui.tdRight, fontWeight: '600', color: '#dc2626' }}>
                              -₹{parseFloat(item.amount).toFixed(2)}
                            </td>
                            <td style={ui.tdRight}>
                              <div style={{ display: 'inline-flex', gap: '6px' }}>
                                <button
                                  style={ui.btnSmallEdit}
                                  onClick={() => handleStartEditExpense(item)}
                                >
                                  Edit
                                </button>
                                <button
                                  style={ui.btnSmallDelete}
                                  onClick={() => handleDeleteExpense(item.id)}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* ==================================================== */}
          {/* VIEW 3: INCOMES                                      */}
          {/* ==================================================== */}
          {activeTab === 'incomes' && (
            <div style={isMobile ? ui.mobileStackGrid : ui.splitGrid}>
              <section style={ui.card}>
                <h3 style={ui.cardTitle}>
                  {editingIncomeId ? '✏️ Edit Income' : '➕ Record Income'}
                </h3>
                <p style={ui.cardSubtitle}>
                  {editingIncomeId ? 'Update details for this deposit' : 'Log a new cash inflow'}
                </p>

                {incomeError && <div style={ui.errorBanner}>{incomeError}</div>}

                <form onSubmit={handleSaveIncome} style={ui.formVertical}>
                  <div style={ui.fieldWrapper}>
                    <label style={ui.label}>Amount (₹)</label>
                    <input
                      style={ui.input}
                      type="number"
                      step="0.01"
                      name="amount"
                      value={incomeForm.amount}
                      onChange={handleIncomeChange}
                      required
                      placeholder="e.g. 5000.00"
                    />
                  </div>

                  <div style={ui.fieldWrapper}>
                    <label style={ui.label}>Source</label>
                    <select
                      style={ui.input}
                      name="source"
                      value={incomeForm.source}
                      onChange={handleIncomeChange}
                    >
                      <option value="POCKET_MONEY">Pocket Money</option>
                      <option value="SCHOLARSHIP">Scholarship</option>
                      <option value="FREELANCE">Freelance Work</option>
                      <option value="OTHER">Other Inflow</option>
                    </select>
                  </div>

                  <div style={ui.fieldWrapper}>
                    <label style={ui.label}>Date</label>
                    <input
                      style={ui.input}
                      type="date"
                      name="date"
                      value={incomeForm.date}
                      onChange={handleIncomeChange}
                      required
                    />
                  </div>

                  <div style={ui.fieldWrapper}>
                    <label style={ui.label}>Description</label>
                    <input
                      style={ui.input}
                      name="description"
                      value={incomeForm.description}
                      onChange={handleIncomeChange}
                      placeholder="e.g. Monthly stipend"
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button
                      style={editingIncomeId ? ui.btnWarning : ui.btnSuccessFull}
                      type="submit"
                    >
                      {editingIncomeId ? '✓ Update Income' : '+ Save Income'}
                    </button>
                    {editingIncomeId && (
                      <button
                        type="button"
                        style={ui.btnSecondary}
                        onClick={handleCancelEditIncome}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </section>

              <section style={ui.card}>
                <div style={ui.cardHeader}>
                  <div>
                    <h3 style={ui.cardTitle}>Income History</h3>
                    <p style={ui.cardSubtitle}>All recorded deposits</p>
                  </div>
                  <span style={ui.badgeSlate}>{incomes.length} records</span>
                </div>

                {incomes.length === 0 ? (
                  <div style={ui.emptyState}>No incomes recorded yet.</div>
                ) : (
                  <div style={ui.tableWrapper}>
                    <table style={ui.table}>
                      <thead>
                        <tr>
                          <th style={ui.th}>Date</th>
                          <th style={ui.th}>Source</th>
                          <th style={ui.th}>Description</th>
                          <th style={ui.thRight}>Amount</th>
                          <th style={ui.thRight}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {incomes.map((item) => (
                          <tr key={item.id} style={ui.tr}>
                            <td style={ui.tdMuted}>{item.date}</td>
                            <td style={ui.td}>
                              <span style={ui.tagGreen}>{item.source}</span>
                            </td>
                            <td style={ui.tdMuted}>{item.description || '—'}</td>
                            <td style={{ ...ui.tdRight, fontWeight: '600', color: '#059669' }}>
                              +₹{parseFloat(item.amount).toFixed(2)}
                            </td>
                            <td style={ui.tdRight}>
                              <div style={{ display: 'inline-flex', gap: '6px' }}>
                                <button
                                  style={ui.btnSmallEdit}
                                  onClick={() => handleStartEditIncome(item)}
                                >
                                  Edit
                                </button>
                                <button
                                  style={ui.btnSmallDelete}
                                  onClick={() => handleDeleteIncome(item.id)}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* ==================================================== */}
          {/* VIEW 4: BUDGET PLANNING                              */}
          {/* ==================================================== */}
          {activeTab === 'budgets' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <section style={ui.card}>
                <h3 style={ui.cardTitle}>🎯 Set Monthly Category Target</h3>
                <p style={ui.cardSubtitle}>Establish proactive spending boundaries by category</p>

                {budgetError && <div style={ui.errorBanner}>{budgetError}</div>}

                <form onSubmit={handleAddBudget} style={ui.formInlineGrid}>
                  <div style={ui.fieldWrapper}>
                    <label style={ui.label}>Category</label>
                    <select
                      style={ui.input}
                      name="category"
                      value={budgetForm.category}
                      onChange={handleBudgetChange}
                    >
                      <option value="FOOD">Food & Dining</option>
                      <option value="TRAVEL">Travel & Transport</option>
                      <option value="SHOPPING">Shopping</option>
                      <option value="EDUCATION">Education & Books</option>
                      <option value="ENTERTAINMENT">Entertainment</option>
                      <option value="MISCELLANEOUS">Miscellaneous</option>
                    </select>
                  </div>

                  <div style={ui.fieldWrapper}>
                    <label style={ui.label}>Monthly Limit (₹)</label>
                    <input
                      style={ui.input}
                      type="number"
                      step="0.01"
                      name="monthly_limit"
                      value={budgetForm.monthly_limit}
                      onChange={handleBudgetChange}
                      required
                      placeholder="e.g. 3500.00"
                    />
                  </div>

                  <div style={ui.fieldWrapper}>
                    <label style={ui.label}>Month (1–12)</label>
                    <input
                      style={ui.input}
                      type="number"
                      min="1"
                      max="12"
                      name="month"
                      value={budgetForm.month}
                      onChange={handleBudgetChange}
                      required
                    />
                  </div>

                  <div style={ui.fieldWrapper}>
                    <label style={ui.label}>Year</label>
                    <input
                      style={ui.input}
                      type="number"
                      name="year"
                      value={budgetForm.year}
                      onChange={handleBudgetChange}
                      required
                    />
                  </div>

                  <button style={ui.btnPurple} type="submit">
                    + Create Target
                  </button>
                </form>
              </section>

              <section style={ui.card}>
                <div style={ui.cardHeader}>
                  <div>
                    <h3 style={ui.cardTitle}>Category Utilization Cards</h3>
                    <p style={ui.cardSubtitle}>Real-time monitoring against your allocated budgets</p>
                  </div>
                  <span style={ui.badgeSlate}>{budgets.length} budgets active</span>
                </div>

                {budgets.length === 0 ? (
                  <div style={ui.emptyState}>No monthly targets defined yet.</div>
                ) : (
                  <div style={ui.budgetGrid}>
                    {budgets.map((b) => {
                      const percent = Math.min(b.utilization_percentage, 100);
                      const isOver = b.utilization_percentage >= 100;
                      const isWarning = b.utilization_percentage >= 80 && !isOver;
                      const barColor = isOver ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981';

                      return (
                        <div key={b.id} style={ui.budgetCard}>
                          <div style={ui.budgetCardTop}>
                            <span style={ui.budgetCategoryName}>{b.category}</span>
                            <span style={ui.badgeSlate}>
                              {b.month}/{b.year}
                            </span>
                          </div>

                          <div style={ui.budgetSplitRow}>
                            <div>
                              <span style={ui.microLabel}>Spent / Limit</span>
                              <div style={ui.budgetMainFigures}>
                                ₹{parseFloat(b.spent_amount).toFixed(2)} / ₹
                                {parseFloat(b.monthly_limit).toFixed(2)}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={ui.microLabel}>Remaining</span>
                              <div
                                style={{
                                  ...ui.budgetMainFigures,
                                  color: b.remaining_amount < 0 ? '#dc2626' : '#059669',
                                }}
                              >
                                ₹{parseFloat(b.remaining_amount).toFixed(2)}
                              </div>
                            </div>
                          </div>

                          <div style={ui.progressBarTrack}>
                            <div
                              style={{
                                ...ui.progressBarFill,
                                width: `${percent}%`,
                                backgroundColor: barColor,
                              }}
                            />
                          </div>

                          <div style={ui.budgetCardFooter}>
                            <span
                              style={{
                                fontSize: '12px',
                                fontWeight: '600',
                                color: barColor,
                              }}
                            >
                              {b.utilization_percentage}% utilized {isOver ? '(Exceeded!)' : ''}
                            </span>
                            <button
                              style={ui.btnSmallDelete}
                              onClick={() => handleDeleteBudget(b.id)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* ==================================================== */}
          {/* VIEW 5: SAVINGS GOALS (RBAC STUDENT LIMIT AWARE)     */}
          {/* ==================================================== */}
          {activeTab === 'goals' && (
            <div style={isMobile ? ui.mobileStackGrid : ui.splitGrid}>
              <section style={ui.card}>
                <h3 style={ui.cardTitle}>
                  {editingGoalId ? '✏️ Edit Savings Goal' : '🎯 Create Savings Goal'}
                </h3>
                <p style={ui.cardSubtitle}>
                  {isStudentTier
                    ? `Student Plan: ${activeGoalsCount}/3 active goal slots used`
                    : 'Premium/Admin Plan: Unlimited savings goals'}
                </p>

                {goalError && <div style={ui.errorBanner}>{goalError}</div>}

                <form onSubmit={handleSaveGoal} style={ui.formVertical}>
                  <div style={ui.fieldWrapper}>
                    <label style={ui.label}>Goal Title</label>
                    <input
                      style={ui.input}
                      name="title"
                      placeholder="e.g. New Laptop Fund, Japan Trip Fund"
                      value={goalForm.title}
                      onChange={handleGoalChange}
                      required
                    />
                  </div>

                  <div style={ui.fieldWrapper}>
                    <label style={ui.label}>Target Amount (₹)</label>
                    <input
                      style={ui.input}
                      type="number"
                      step="0.01"
                      name="target_amount"
                      placeholder="e.g. 50000.00"
                      value={goalForm.target_amount}
                      onChange={handleGoalChange}
                      required
                    />
                  </div>

                  <div style={ui.fieldWrapper}>
                    <label style={ui.label}>Initial / Current Saved (₹)</label>
                    <input
                      style={ui.input}
                      type="number"
                      step="0.01"
                      name="current_amount"
                      placeholder="e.g. 5000.00"
                      value={goalForm.current_amount}
                      onChange={handleGoalChange}
                      required
                    />
                  </div>

                  <div style={ui.fieldWrapper}>
                    <label style={ui.label}>Target Deadline</label>
                    <input
                      style={ui.input}
                      type="date"
                      name="target_date"
                      value={goalForm.target_date}
                      onChange={handleGoalChange}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button
                      style={editingGoalId ? ui.btnWarning : ui.btnPurpleFull}
                      type="submit"
                    >
                      {editingGoalId ? '✓ Update Goal' : '+ Launch Goal'}
                    </button>
                    {editingGoalId && (
                      <button
                        type="button"
                        style={ui.btnSecondary}
                        onClick={handleCancelEditGoal}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </section>

              <section style={ui.card}>
                <div style={ui.cardHeader}>
                  <div>
                    <h3 style={ui.cardTitle}>Active Savings Goals</h3>
                    <p style={ui.cardSubtitle}>Track progress and deposit funds toward your milestones</p>
                  </div>
                  <span style={ui.badgeSlate}>
                    {isStudentTier ? `${activeGoalsCount}/3 slots` : `${goals.length} goals`}
                  </span>
                </div>

                {goals.length === 0 ? (
                  <div style={ui.emptyState}>No savings goals launched yet.</div>
                ) : (
                  <div style={ui.goalCardsGrid}>
                    {goals.map((g) => {
                      const progress = Math.min(g.progress_percentage || 0, 100);
                      const isCompleted = g.is_completed || progress >= 100;
                      const remaining = parseFloat(g.remaining_amount || 0);

                      return (
                        <div key={g.id} style={ui.goalCard}>
                          <div style={ui.goalCardTop}>
                            <div>
                              <h4 style={ui.goalCardTitle}>{g.title}</h4>
                              <span style={ui.goalDeadline}>Due: {g.target_date}</span>
                            </div>
                            <span style={isCompleted ? ui.tagGreen : ui.tagPurple}>
                              {isCompleted ? '✓ Completed' : 'In Progress'}
                            </span>
                          </div>

                          <div style={ui.budgetSplitRow}>
                            <div>
                              <span style={ui.microLabel}>Saved / Target</span>
                              <div style={ui.budgetMainFigures}>
                                ₹{parseFloat(g.current_amount).toFixed(2)} / ₹
                                {parseFloat(g.target_amount).toFixed(2)}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={ui.microLabel}>Needed</span>
                              <div
                                style={{
                                  ...ui.budgetMainFigures,
                                  color: isCompleted ? '#059669' : '#e11d48',
                                }}
                              >
                                ₹{remaining.toFixed(2)}
                              </div>
                            </div>
                          </div>

                          <div style={ui.progressBarTrack}>
                            <div
                              style={{
                                ...ui.progressBarFill,
                                width: `${progress}%`,
                                backgroundColor: isCompleted ? '#10b981' : '#7c3aed',
                              }}
                            />
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span
                              style={{
                                fontSize: '13px',
                                fontWeight: '700',
                                color: isCompleted ? '#059669' : '#7c3aed',
                              }}
                            >
                              {g.progress_percentage}% funded
                            </span>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                style={ui.btnSmallEdit}
                                onClick={() => handleStartEditGoal(g)}
                              >
                                Edit
                              </button>
                              <button
                                style={ui.btnSmallDelete}
                                onClick={() => handleDeleteGoal(g.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>

                          {!isCompleted && (
                            <div style={ui.quickDepositBox}>
                              <input
                                style={ui.quickDepositInput}
                                type="number"
                                step="0.01"
                                placeholder="₹ Deposit amount"
                                value={depositInputs[g.id] || ''}
                                onChange={(e) => handleDepositAmountChange(g.id, e.target.value)}
                              />
                              <button
                                style={ui.btnQuickDeposit}
                                onClick={() => handleQuickDeposit(g.id)}
                              >
                                + Add Funds
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* ==================================================== */}
          {/* VIEW 6: USER PROFILE, ACCOUNT EDIT & PASSWORD        */}
          {/* ==================================================== */}
          {activeTab === 'profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={isMobile ? ui.mobileStackGrid : ui.splitGrid}>
                <section style={ui.card}>
                  <h3 style={ui.cardTitle}>👤 Account Details & Plan</h3>
                  <p style={ui.cardSubtitle}>Edit your username, email address, or account tier</p>

                  {accountMessage && (
                    <div
                      style={{
                        ...ui.errorBanner,
                        backgroundColor: accountMessage.startsWith('Error') ? '#fef2f2' : '#ecfdf5',
                        color: accountMessage.startsWith('Error') ? '#b91c1c' : '#047857',
                        borderColor: accountMessage.startsWith('Error') ? '#fecaca' : '#a7f3d0',
                        marginTop: '14px',
                      }}
                    >
                      {accountMessage}
                    </div>
                  )}

                  <form onSubmit={handleSaveAccountDetails} style={ui.formVertical}>
                    <div style={ui.fieldWrapper}>
                      <label style={ui.label}>Username</label>
                      <input
                        style={ui.input}
                        name="username"
                        value={profileForm.username}
                        onChange={handleProfileChange}
                        required
                      />
                    </div>

                    <div style={ui.fieldWrapper}>
                      <label style={ui.label}>Email Address</label>
                      <input
                        style={ui.input}
                        type="email"
                        name="email"
                        value={profileForm.email}
                        onChange={handleProfileChange}
                        required
                      />
                    </div>

                    <div style={ui.fieldWrapper}>
                      <label style={ui.label}>Account Role / Plan</label>
                      <select
                        style={ui.input}
                        name="role"
                        value={profileForm.role}
                        onChange={handleProfileChange}
                      >
                        <option value="STUDENT">Student (Max 3 Goals, CSV Export)</option>
                        <option value="PREMIUM">Premium User (Unlimited Goals, PDF & Excel)</option>
                        {isAdmin && <option value="ADMIN">Admin (Full Platform Management)</option>}
                      </select>
                    </div>

                    <button style={ui.btnPrimaryFull} type="submit">
                      Update Account Details
                    </button>
                  </form>

                  {profileForm.updated_at && (
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '14px' }}>
                      Last synced: {new Date(profileForm.updated_at).toLocaleString()}
                    </div>
                  )}
                </section>

                <section style={ui.card}>
                  <h3 style={ui.cardTitle}>⚙️ Financial & Notification Preferences</h3>
                  <p style={ui.cardSubtitle}>
                    Configure your baseline monthly income and automated alert settings
                  </p>

                  {profileMessage && (
                    <div
                      style={{
                        ...ui.errorBanner,
                        backgroundColor: profileMessage.startsWith('Error') ? '#fef2f2' : '#ecfdf5',
                        color: profileMessage.startsWith('Error') ? '#b91c1c' : '#047857',
                        borderColor: profileMessage.startsWith('Error') ? '#fecaca' : '#a7f3d0',
                        marginTop: '14px',
                      }}
                    >
                      {profileMessage}
                    </div>
                  )}

                  <form onSubmit={handleSaveProfile} style={ui.formVertical}>
                    <div style={ui.fieldWrapper}>
                      <label style={ui.label}>Baseline Monthly Income (₹)</label>
                      <input
                        style={ui.input}
                        type="number"
                        step="0.01"
                        name="monthly_income_baseline"
                        value={profileForm.monthly_income_baseline}
                        onChange={handleProfileChange}
                        placeholder="e.g. 15000.00"
                      />
                    </div>

                    <div style={ui.fieldWrapper}>
                      <label style={ui.label}>Preferred Display Currency</label>
                      <select
                        style={ui.input}
                        name="currency"
                        value={profileForm.currency}
                        onChange={handleProfileChange}
                      >
                        <option value="INR">Indian Rupee (₹ INR)</option>
                        <option value="USD">US Dollar ($ USD)</option>
                        <option value="EUR">Euro (€ EUR)</option>
                      </select>
                    </div>

                    <div style={ui.fieldWrapper}>
                      <label style={ui.label}>Budget Warning Threshold (%)</label>
                      <input
                        style={ui.input}
                        type="number"
                        min="50"
                        max="99"
                        name="alert_threshold_percent"
                        value={profileForm.alert_threshold_percent}
                        onChange={handleProfileChange}
                      />
                    </div>

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '14px',
                        color: '#1e293b',
                        cursor: 'pointer',
                        marginTop: '4px',
                      }}
                    >
                      <input
                        type="checkbox"
                        name="monthly_report_notifications"
                        checked={Boolean(profileForm.monthly_report_notifications)}
                        onChange={handleProfileChange}
                      />
                      <span>Receive automated monthly financial report notifications</span>
                    </label>

                    <button style={ui.btnSuccessFull} type="submit">
                      Save Financial Preferences
                    </button>
                  </form>
                </section>
              </div>

              <section style={ui.card}>
                <h3 style={ui.cardTitle}>🔒 Account Security & Password</h3>
                <p style={ui.cardSubtitle}>Update your login password (minimum 8 characters)</p>

                {passwordMessage && (
                  <div
                    style={{
                      ...ui.errorBanner,
                      backgroundColor: passwordMessage.startsWith('Error') ? '#fef2f2' : '#ecfdf5',
                      color: passwordMessage.startsWith('Error') ? '#b91c1c' : '#047857',
                      borderColor: passwordMessage.startsWith('Error') ? '#fecaca' : '#a7f3d0',
                      marginTop: '14px',
                    }}
                  >
                    {passwordMessage}
                  </div>
                )}

                <form onSubmit={handleChangePassword} style={ui.formInlineGrid}>
                  <div style={ui.fieldWrapper}>
                    <label style={ui.label}>Current Password</label>
                    <input
                      style={ui.input}
                      type="password"
                      name="current_password"
                      value={passwordForm.current_password}
                      onChange={handlePasswordChange}
                      required
                      placeholder="••••••••"
                    />
                  </div>

                  <div style={ui.fieldWrapper}>
                    <label style={ui.label}>New Password</label>
                    <input
                      style={ui.input}
                      type="password"
                      name="new_password"
                      value={passwordForm.new_password}
                      onChange={handlePasswordChange}
                      required
                      minLength={8}
                      placeholder="Min. 8 characters"
                    />
                  </div>

                  <div style={ui.fieldWrapper}>
                    <label style={ui.label}>Confirm New Password</label>
                    <input
                      style={ui.input}
                      type="password"
                      name="confirm_password"
                      value={passwordForm.confirm_password}
                      onChange={handlePasswordChange}
                      required
                      minLength={8}
                      placeholder="Re-enter new password"
                    />
                  </div>

                  <button style={ui.btnPurple} type="submit">
                    Update Password
                  </button>
                </form>
              </section>
            </div>
          )}

          {/* ==================================================== */}
          {/* VIEW 7: ADMIN USER & ROLE MANAGEMENT PANEL           */}
          {/* ==================================================== */}
          {activeTab === 'admin' && isAdmin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <section style={ui.metricGrid}>
                <div style={ui.statCard}>
                  <span style={ui.statTitle}>Total Registered Users</span>
                  <div style={{ ...ui.statAmount, color: '#0f172a' }}>{adminStats.total_users}</div>
                </div>
                <div style={ui.statCard}>
                  <span style={ui.statTitle}>Student Accounts</span>
                  <div style={{ ...ui.statAmount, color: '#4f46e5' }}>{adminStats.students}</div>
                </div>
                <div style={ui.statCard}>
                  <span style={ui.statTitle}>Premium Users</span>
                  <div style={{ ...ui.statAmount, color: '#7c3aed' }}>{adminStats.premium}</div>
                </div>
                <div style={ui.statCard}>
                  <span style={ui.statTitle}>Active Accounts</span>
                  <div style={{ ...ui.statAmount, color: '#059669' }}>{adminStats.active}</div>
                </div>
              </section>

              <section style={ui.card}>
                <div style={ui.cardHeader}>
                  <div>
                    <h3 style={ui.cardTitle}>🛡️ Platform User & Role Management</h3>
                    <p style={ui.cardSubtitle}>
                      Promote/demote user roles (Student, Premium, Admin) and manage account access
                    </p>
                  </div>
                  <button type="button" style={ui.btnSecondary} onClick={fetchAdminUsers}>
                    ↻ Refresh Users
                  </button>
                </div>

                {adminMessage && (
                  <div
                    style={{
                      ...ui.errorBanner,
                      backgroundColor: adminMessage.startsWith('Error') ? '#fef2f2' : '#ecfdf5',
                      color: adminMessage.startsWith('Error') ? '#b91c1c' : '#047857',
                      borderColor: adminMessage.startsWith('Error') ? '#fecaca' : '#a7f3d0',
                    }}
                  >
                    {adminMessage}
                  </div>
                )}

                <div style={ui.tableWrapper}>
                  <table style={ui.table}>
                    <thead>
                      <tr>
                        <th style={ui.th}>ID</th>
                        <th style={ui.th}>Username</th>
                        <th style={ui.th}>Email</th>
                        <th style={ui.th}>Joined</th>
                        <th style={ui.th}>Assigned Role</th>
                        <th style={ui.thRight}>Account Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminUsers.map((u) => {
                        const isSelf = u.username === profileForm.username;
                        return (
                          <tr key={u.id} style={ui.tr}>
                            <td style={ui.tdMuted}>#{u.id}</td>
                            <td style={ui.tdBold}>
                              {u.username} {isSelf && <span style={ui.badgeSlate}>(You)</span>}
                            </td>
                            <td style={ui.tdMuted}>{u.email}</td>
                            <td style={ui.tdMuted}>
                              {new Date(u.date_joined).toLocaleDateString()}
                            </td>
                            <td style={ui.td}>
                              <select
                                disabled={isSelf}
                                style={{ ...ui.input, width: '150px', padding: '6px 10px' }}
                                value={u.role}
                                onChange={(e) =>
                                  handleAdminUpdateUser(u.id, { role: e.target.value })
                                }
                              >
                                <option value="STUDENT">STUDENT</option>
                                <option value="PREMIUM">PREMIUM</option>
                                <option value="ADMIN">ADMIN</option>
                              </select>
                            </td>
                            <td style={ui.tdRight}>
                              <button
                                type="button"
                                disabled={isSelf}
                                style={{
                                  ...(u.is_active ? ui.tagGreen : ui.tagRed),
                                  border: 'none',
                                  cursor: isSelf ? 'not-allowed' : 'pointer',
                                }}
                                onClick={() =>
                                  handleAdminUpdateUser(u.id, { is_active: !u.is_active })
                                }
                              >
                                {u.is_active ? '✓ Active' : '✕ Suspended'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// Responsive Left-Sidebar SaaS Design System Tokens
// ----------------------------------------------------
const ui = {
  appShell: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#f4f6f9',
    color: '#0f172a',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  mobileBackdrop: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    zIndex: 50,
  },
  sidebar: {
    width: '260px',
    flexShrink: 0,
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    height: '100vh',
    borderRight: '1px solid #1e293b',
    overflow: 'hidden',
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    borderBottom: '1px solid #1e293b',
    minHeight: '81px',
    boxSizing: 'border-box',
  },
  sidebarCloseBtn: {
    background: 'rgba(255,255,255,0.08)',
    border: 'none',
    color: '#cbd5e1',
    borderRadius: '8px',
    width: '32px',
    height: '32px',
    fontSize: '15px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarToggleBtn: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    width: '38px',
    height: '38px',
    fontSize: '18px',
    fontWeight: '700',
    color: '#0f172a',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  brandLogo: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    backgroundColor: '#4f46e5',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '800',
    fontSize: '19px',
    flexShrink: 0,
    boxShadow: '0 4px 10px rgba(79, 70, 229, 0.35)',
  },
  brandName: {
    fontWeight: '800',
    fontSize: '18px',
    letterSpacing: '-0.3px',
    color: '#ffffff',
    whiteSpace: 'nowrap',
  },
  brandSub: {
    fontSize: '11px',
    color: '#94a3b8',
    fontWeight: '500',
    whiteSpace: 'nowrap',
  },
  sidebarNavScroll: {
    flex: 1,
    overflowY: 'auto',
    padding: '18px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  sidebarGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  sidebarGroupLabel: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: '0.8px',
    padding: '0 10px 6px',
    whiteSpace: 'nowrap',
  },
  sidebarItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#cbd5e1',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  },
  sidebarItemActive: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: '#4f46e5',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.35)',
  },
  sidebarFooterCard: {
    margin: '14px',
    padding: '14px',
    borderRadius: '12px',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
  },
  contentColumn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  topHeader: {
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'sticky',
    top: 0,
    zIndex: 25,
    gap: '12px',
  },
  pageHeading: {
    margin: 0,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: '-0.3px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  pageSubheading: {
    margin: '2px 0 0',
    fontSize: '13px',
    color: '#64748b',
  },
  iconButton: {
    position: 'relative',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '9px 12px',
    cursor: 'pointer',
    fontSize: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadge: {
    position: 'absolute',
    top: '-5px',
    right: '-5px',
    backgroundColor: '#ef4444',
    color: '#ffffff',
    borderRadius: '10px',
    padding: '2px 6px',
    fontSize: '10px',
    fontWeight: '800',
  },
  profileTrigger: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '6px 10px 6px 8px',
    cursor: 'pointer',
  },
  avatarCircle: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: '#4f46e5',
    color: '#ffffff',
    fontWeight: '800',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownMenu: {
    position: 'absolute',
    right: 0,
    marginTop: '10px',
    backgroundColor: '#ffffff',
    borderRadius: '14px',
    boxShadow: '0 12px 30px rgba(15, 23, 42, 0.14)',
    border: '1px solid #e2e8f0',
    zIndex: 100,
    overflow: 'hidden',
  },
  dropdownHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid #f1f5f9',
    backgroundColor: '#fafbfc',
  },
  dropdownActionLink: {
    background: 'none',
    border: 'none',
    color: '#4f46e5',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  dropdownEmpty: {
    padding: '24px 16px',
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: '13px',
    margin: 0,
  },
  dropdownMenuItem: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: 'transparent',
    color: '#1e293b',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    textAlign: 'left',
  },
  mainArea: {
    maxWidth: '1240px',
    width: '100%',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    boxSizing: 'border-box',
  },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
    gap: '16px',
  },
  statCard: {
    backgroundColor: '#ffffff',
    padding: '22px',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  statHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statTitle: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  statIconGreen: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#059669',
    backgroundColor: '#ecfdf5',
    padding: '4px 8px',
    borderRadius: '6px',
  },
  statIconRed: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#dc2626',
    backgroundColor: '#fef2f2',
    padding: '4px 8px',
    borderRadius: '6px',
  },
  statIconBlue: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#4f46e5',
    backgroundColor: '#eef2ff',
    padding: '4px 8px',
    borderRadius: '6px',
  },
  statIconPurple: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#7c3aed',
    backgroundColor: '#f5f3ff',
    padding: '4px 8px',
    borderRadius: '6px',
  },
  statAmount: {
    fontSize: '26px',
    fontWeight: '800',
    letterSpacing: '-0.5px',
    margin: '4px 0 0',
  },
  statSub: {
    fontSize: '12px',
    color: '#94a3b8',
  },
  chartGridTwoCol: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '24px',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
    padding: '24px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
    gap: '12px',
  },
  cardTitle: {
    margin: 0,
    fontSize: '17px',
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: '-0.2px',
  },
  cardSubtitle: {
    margin: '4px 0 0',
    fontSize: '13px',
    color: '#64748b',
  },
  splitGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(300px, 380px) 1fr',
    gap: '24px',
    alignItems: 'start',
  },
  mobileStackGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '24px',
  },
  formVertical: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    marginTop: '16px',
  },
  formInlineGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '14px',
    alignItems: 'end',
    marginTop: '16px',
  },
  fieldWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  },
  microLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  input: {
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    fontSize: '14px',
    color: '#0f172a',
    outline: 'none',
    boxSizing: 'border-box',
    width: '100%',
  },
  btnPrimaryFull: {
    backgroundColor: '#4f46e5',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '11px 16px',
    fontWeight: '600',
    fontSize: '14px',
    cursor: 'pointer',
    width: '100%',
  },
  btnSuccessFull: {
    backgroundColor: '#059669',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '11px 16px',
    fontWeight: '600',
    fontSize: '14px',
    cursor: 'pointer',
    width: '100%',
  },
  btnPurpleFull: {
    backgroundColor: '#7c3aed',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '11px 16px',
    fontWeight: '600',
    fontSize: '14px',
    cursor: 'pointer',
    width: '100%',
  },
  btnWarning: {
    backgroundColor: '#d97706',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '11px 16px',
    fontWeight: '600',
    fontSize: '14px',
    cursor: 'pointer',
    flex: 1,
  },
  btnSecondary: {
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    padding: '9px 14px',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
  },
  btnPurple: {
    backgroundColor: '#7c3aed',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '11px 16px',
    fontWeight: '600',
    fontSize: '14px',
    cursor: 'pointer',
    height: '42px',
  },
  btnSmallEdit: {
    backgroundColor: '#eef2ff',
    color: '#4f46e5',
    border: '1px solid #c7d2fe',
    borderRadius: '6px',
    padding: '4px 10px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  btnSmallDelete: {
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    padding: '4px 10px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  th: {
    padding: '12px 14px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#64748b',
    borderBottom: '1px solid #e2e8f0',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  },
  thRight: {
    padding: '12px 14px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#64748b',
    borderBottom: '1px solid #e2e8f0',
    textAlign: 'right',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  },
  tr: {
    borderBottom: '1px solid #f1f5f9',
  },
  td: {
    padding: '14px',
    fontSize: '14px',
    color: '#0f172a',
  },
  tdBold: {
    padding: '14px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#0f172a',
  },
  tdMuted: {
    padding: '14px',
    fontSize: '13px',
    color: '#64748b',
  },
  tdRight: {
    padding: '14px',
    fontSize: '14px',
    textAlign: 'right',
  },
  badgeSlate: {
    backgroundColor: '#f1f5f9',
    color: '#475569',
    fontSize: '12px',
    fontWeight: '600',
    padding: '4px 8px',
    borderRadius: '6px',
    whiteSpace: 'nowrap',
  },
  tagRed: {
    backgroundColor: '#fee2e2',
    color: '#b91c1c',
    fontSize: '11px',
    fontWeight: '700',
    padding: '3px 8px',
    borderRadius: '6px',
    letterSpacing: '0.3px',
  },
  tagGreen: {
    backgroundColor: '#dcfce7',
    color: '#15803d',
    fontSize: '11px',
    fontWeight: '700',
    padding: '3px 8px',
    borderRadius: '6px',
    letterSpacing: '0.3px',
  },
  tagPurple: {
    backgroundColor: '#f5f3ff',
    color: '#7c3aed',
    fontSize: '11px',
    fontWeight: '700',
    padding: '3px 8px',
    borderRadius: '6px',
    letterSpacing: '0.3px',
  },
  budgetGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px',
  },
  budgetCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  budgetCardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetCategoryName: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#0f172a',
  },
  budgetSplitRow: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  budgetMainFigures: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#1e293b',
    marginTop: '2px',
  },
  progressBarTrack: {
    width: '100%',
    height: '8px',
    backgroundColor: '#f1f5f9',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.4s ease, background-color 0.4s ease',
  },
  budgetCardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalCardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '16px',
  },
  goalCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '14px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
  },
  goalCardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  goalCardTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '700',
    color: '#0f172a',
  },
  goalDeadline: {
    fontSize: '12px',
    color: '#64748b',
    display: 'block',
    marginTop: '2px',
  },
  quickDepositBox: {
    display: 'flex',
    gap: '8px',
    borderTop: '1px dashed #e2e8f0',
    paddingTop: '12px',
  },
  quickDepositInput: {
    flex: 1,
    padding: '7px 10px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '13px',
    boxSizing: 'border-box',
  },
  btnQuickDeposit: {
    backgroundColor: '#f5f3ff',
    color: '#7c3aed',
    border: '1px solid #ddd6fe',
    borderRadius: '6px',
    padding: '7px 12px',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  emptyState: {
    padding: '48px 0',
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: '14px',
  },
  errorBanner: {
    backgroundColor: '#fef2f2',
    color: '#b91c1c',
    border: '1px solid #fecaca',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '14px',
  },
  authPage: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    padding: '24px',
  },
  authCard: {
    backgroundColor: '#ffffff',
    padding: '36px',
    borderRadius: '20px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
    width: '100%',
    maxWidth: '420px',
  },
  authBrand: {
    textAlign: 'center',
    marginBottom: '24px',
  },
  authIconBox: {
    fontSize: '36px',
    marginBottom: '8px',
  },
  authTitle: {
    margin: 0,
    fontSize: '22px',
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: '-0.3px',
  },
  authSubtitle: {
    margin: '6px 0 0',
    fontSize: '13px',
    color: '#64748b',
  },
  authSwitch: {
    marginTop: '20px',
    textAlign: 'center',
    fontSize: '13px',
    color: '#64748b',
  },
  linkHighlight: {
    color: '#4f46e5',
    fontWeight: '700',
    cursor: 'pointer',
  },
};