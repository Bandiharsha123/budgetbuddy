import api from './api';

// Common configuration for authenticated requests
const getConfig = (token) => ({
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

// 1. Dashboard Analytics
export const getDashboardAnalytics = async (token) => {
  const response = await api.get(
    '/analytics/dashboard/',
    getConfig(token)
  );
  return response.data;
};

// 2. Monthly Analytics
export const getMonthlyAnalytics = async (token) => {
  const response = await api.get(
    '/analytics/monthly/',
    getConfig(token)
  );
  return response.data;
};

// 3. Category Analytics
export const getCategoryAnalytics = async (token) => {
  const response = await api.get(
    '/analytics/categories/',
    getConfig(token)
  );
  return response.data;
};

// 4. Budget Analytics
export const getBudgetAnalytics = async (token) => {
  const response = await api.get(
    '/analytics/budgets/',
    getConfig(token)
  );
  return response.data;
};

// 5. Savings Analytics
export const getSavingsAnalytics = async (token) => {
  const response = await api.get(
    '/analytics/savings/',
    getConfig(token)
  );
  return response.data;
};

// 6. Income vs Expense Trends
export const getTrendsAnalytics = async (token) => {
  const response = await api.get(
    '/analytics/trends/',
    getConfig(token)
  );
  return response.data;
};

// 7. Financial Reports
export const getFinancialReports = async (token, params = {}) => {
  const response = await api.get(
    '/analytics/reports/',
    {
      ...getConfig(token),
      params,
    }
  );
  return response.data;
};