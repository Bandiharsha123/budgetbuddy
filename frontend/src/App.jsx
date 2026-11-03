import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = 'http://127.0.0.1:8000/api';

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

  // --- Active Tab ---
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

  useEffect(() => {
    if (token) {
      fetchExpenses();
      fetchIncomes();
      fetchBudgets();
    }
  }, [token]);

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
    } catch (err) {
      const errData = err.response?.data;
      if (errData?.non_field_errors) {
        setBudgetError(`Constraint Error: ${errData.non_field_errors[0]}`);
      } else {
        setBudgetError(JSON.stringify(errData || 'Failed to save budget target.'));
      }
    }
  };

  const handleDeleteBudget = async (id) => {
    try {
      await axios.delete(`${API_BASE}/budgets/${id}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchBudgets();
    } catch (err) {
      console.error('Failed to delete budget:', err);
    }
  };

  // ----------------------------------------------------
  // Metrics & Timeline
  // ----------------------------------------------------
  const totalExpenseAmount = expenses.reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
  const totalIncomeAmount = incomes.reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
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

  const recentTransactions = unifiedTransactions.slice(0, 10);

  // ----------------------------------------------------
  // Auth Screen
  // ----------------------------------------------------
  if (!token) {
    return (
      <div style={ui.authPage}>
        <div style={ui.authCard}>
          <div style={ui.authBrand}>
            <div style={ui.authIconBox}>💳</div>
            <h2 style={ui.authTitle}>{isLogin ? 'Welcome Back' : 'Create an Account'}</h2>
            <p style={ui.authSubtitle}>
              {isLogin ? 'Sign in to access your BudgetBuddy workspace' : 'Join BudgetBuddy to manage your personal finances'}
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
                    <option value="STUDENT">Student</option>
                    <option value="PREMIUM">Premium User</option>
                    <option value="ADMIN">Admin</option>
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
  // Dashboard UI
  // ----------------------------------------------------
  return (
    <div style={ui.pageWrapper}>
      {/* Navigation Header */}
      <header style={ui.topNav}>
        <div style={ui.navContent}>
          <div style={ui.brandGroup}>
            <div style={ui.brandLogo}>₹</div>
            <span style={ui.brandName}>BudgetBuddy</span>
          </div>

          <button style={ui.btnOutlineDanger} onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </header>

      <main style={ui.mainContainer}>
        {/* Metric Cards Row */}
        <section style={ui.metricGrid}>
          <div style={ui.statCard}>
            <div style={ui.statHeader}>
              <span style={ui.statTitle}>Total Incomes</span>
              <span style={ui.statIconGreen}>↗</span>
            </div>
            <div style={{ ...ui.statAmount, color: '#059669' }}>
              +₹{totalIncomeAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span style={ui.statSub}>Total deposits recorded</span>
          </div>

          <div style={ui.statCard}>
            <div style={ui.statHeader}>
              <span style={ui.statTitle}>Total Expenses</span>
              <span style={ui.statIconRed}>↘</span>
            </div>
            <div style={{ ...ui.statAmount, color: '#dc2626' }}>
              -₹{totalExpenseAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
                color: netBalance >= 0 ? '#2563eb' : '#dc2626',
              }}
            >
              ₹{netBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span style={ui.statSub}>Current financial runway</span>
          </div>
        </section>

        {/* Tab Navigation */}
        <nav style={ui.tabBar}>
          {[
            { id: 'overview', label: 'Overview & Activity' },
            { id: 'expenses', label: 'Expenses' },
            { id: 'incomes', label: 'Incomes' },
            { id: 'budgets', label: 'Budget Planning' },
          ].map((tab) => (
            <button
              key={tab.id}
              style={activeTab === tab.id ? ui.activeTabItem : ui.tabItem}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* ==================================================== */}
        {/* TAB 0: OVERVIEW FEED                                 */}
        {/* ==================================================== */}
        {activeTab === 'overview' && (
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
                            {isIncome ? `+₹${tx.numericAmount.toFixed(2)}` : `-₹${tx.numericAmount.toFixed(2)}`}
                          </td>
                          <td style={ui.tdRight}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                style={ui.btnSmallEdit}
                                onClick={() =>
                                  isIncome ? handleStartEditIncome(tx) : handleStartEditExpense(tx)
                                }
                              >
                                Edit
                              </button>
                              <button
                                style={ui.btnSmallDelete}
                                onClick={() =>
                                  isIncome ? handleDeleteIncome(tx.id) : handleDeleteExpense(tx.id)
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
        )}

        {/* ==================================================== */}
        {/* TAB 1: EXPENSES                                      */}
        {/* ==================================================== */}
        {activeTab === 'expenses' && (
          <div style={ui.splitGrid}>
            {/* Form Column */}
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

            {/* Table Column */}
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
        {/* TAB 2: INCOMES                                       */}
        {/* ==================================================== */}
        {activeTab === 'incomes' && (
          <div style={ui.splitGrid}>
            {/* Form Column */}
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

            {/* Table Column */}
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
        {/* TAB 3: BUDGET PLANNING                               */}
        {/* ==================================================== */}
        {activeTab === 'budgets' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Create Budget Target */}
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

            {/* Target Cards */}
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
                          <span style={ui.badgeSlate}>{b.month}/{b.year}</span>
                        </div>

                        <div style={ui.budgetSplitRow}>
                          <div>
                            <span style={ui.microLabel}>Spent / Limit</span>
                            <div style={ui.budgetMainFigures}>
                              ₹{parseFloat(b.spent_amount).toFixed(2)} / ₹{parseFloat(b.monthly_limit).toFixed(2)}
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

                        {/* Progress Bar Container */}
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
      </main>
    </div>
  );
}

// ----------------------------------------------------
// Modern Fintech Design Tokens
// ----------------------------------------------------
const ui = {
  // Page Scaffolding
  pageWrapper: {
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  topNav: {
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    position: 'sticky',
    top: 0,
    zIndex: 30,
  },
  navContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '14px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  brandLogo: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '800',
    fontSize: '18px',
  },
  brandName: {
    fontWeight: '700',
    fontSize: '19px',
    letterSpacing: '-0.3px',
    color: '#0f172a',
  },
  proBadge: {
    backgroundColor: '#eff6ff',
    color: '#2563eb',
    fontSize: '10px',
    fontWeight: '700',
    padding: '2px 6px',
    borderRadius: '4px',
    letterSpacing: '0.5px',
  },

  // Main Dashboard Container
  mainContainer: {
    maxWidth: '1200px',
    margin: '32px auto',
    padding: '0 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },

  // Metric Cards
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px',
  },
  statCard: {
    backgroundColor: '#ffffff',
    padding: '22px',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
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
    fontSize: '13px',
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
    color: '#2563eb',
    backgroundColor: '#eff6ff',
    padding: '4px 8px',
    borderRadius: '6px',
  },
  statAmount: {
    fontSize: '28px',
    fontWeight: '800',
    letterSpacing: '-0.5px',
    margin: '4px 0 0',
  },
  statSub: {
    fontSize: '12px',
    color: '#94a3b8',
  },

  // Tab Strip
  tabBar: {
    display: 'flex',
    gap: '8px',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '2px',
  },
  tabItem: {
    padding: '10px 18px',
    borderRadius: '8px 8px 0 0',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#64748b',
    fontWeight: '600',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  activeTabItem: {
    padding: '10px 18px',
    borderRadius: '8px 8px 0 0',
    border: 'none',
    backgroundColor: '#ffffff',
    color: '#2563eb',
    fontWeight: '700',
    fontSize: '14px',
    borderBottom: '2px solid #2563eb',
    boxShadow: '0 -2px 6px rgba(0,0,0,0.02)',
    cursor: 'pointer',
  },

  // Panels & Cards
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    padding: '24px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
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

  // Split Layout for Expenses & Incomes
  splitGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(300px, 380px) 1fr',
    gap: '24px',
    alignItems: 'start',
  },

  // Form Controls
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

  // Buttons
  btnPrimaryFull: {
    backgroundColor: '#2563eb',
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
    padding: '11px 16px',
    fontWeight: '600',
    fontSize: '14px',
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
  btnOutlineDanger: {
    backgroundColor: 'transparent',
    color: '#dc2626',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    padding: '7px 14px',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
  },
  btnSmallEdit: {
    backgroundColor: '#eff6ff',
    color: '#2563eb',
    border: '1px solid #bfdbfe',
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

  // Tables
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

  // Badges & Pills
  badgeSlate: {
    backgroundColor: '#f1f5f9',
    color: '#475569',
    fontSize: '12px',
    fontWeight: '600',
    padding: '4px 8px',
    borderRadius: '6px',
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

  // Budgets Cards
  budgetGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
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

  // States & Banners
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

  // Auth Screen
  authPage: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    padding: '24px',
  },
  authCard: {
    backgroundColor: '#ffffff',
    padding: '36px',
    borderRadius: '20px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
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
    color: '#2563eb',
    fontWeight: '700',
    cursor: 'pointer',
  },
};