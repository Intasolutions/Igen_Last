// src/modules/Dashboard/Dashboard.js
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import API from '../../api/axios';
import { Line, Pie /*, Bar*/ } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  ArcElement,
  Filler,
  BarElement,
} from 'chart.js';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaUsers, FaBuilding, FaProjectDiagram, FaHome, FaCubes, FaAddressBook,
  FaDollarSign, FaUniversity, FaStore, FaTags, FaSyncAlt, FaExclamationTriangle, FaTimes
} from 'react-icons/fa';
import ReactTooltip from 'react-tooltip';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, ArcElement, Filler, BarElement, Tooltip, Legend);

// ---- helpers ----
const tid = (s) => String(s || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '');
const getUserRole = () => {
  const r = localStorage.getItem('role');
  if (r) return r;
  const token = localStorage.getItem('access');
  if (token && token.split('.').length === 3) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.role || '';
    } catch {}
  }
  return '';
};

function Dashboard() {
  const role = getUserRole();

  const [stats, setStats] = useState({});
  const [trend, setTrend] = useState([]);
  const [spendData, setSpendData] = useState([]);
  const [vendorData, setVendorData] = useState([]);
  const [costCentres, setCostCentres] = useState([]);
  const [financialMetrics, setFinancialMetrics] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    budgetUtilization: 0,
  });
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [costCentreFilter, setCostCentreFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ---- role-based visibility map ----
  const visibleStatKeys = useMemo(() => {
    switch (role) {
      case 'SUPER_USER':
        return ['Users','Companies','Projects','Properties','Assets','Contacts','Cost Centres','Banks','Vendors','Transaction Types'];
      case 'CENTER_HEAD':
        return ['Projects','Properties','Assets','Contacts','Cost Centres','Banks','Vendors','Transaction Types'];
      case 'ACCOUNTANT':
        return ['Projects','Properties','Contacts','Cost Centres','Banks','Vendors','Transaction Types','Assets'];
      case 'PROPERTY_MANAGER':
        return ['Projects','Properties','Contacts','Vendors','Assets'];
      default:
        return [];
    }
  }, [role]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statsRes = await API.get('dashboard-stats/');
      setStats(statsRes.data);
      setTrend(Array.isArray(statsRes.data.trend_data) ? statsRes.data.trend_data : []);
      setFinancialMetrics({
        totalRevenue: statsRes.data.total_revenue || 0,
        totalExpenses: statsRes.data.total_expenses || 0,
        budgetUtilization: statsRes.data.budget_utilization || 0,
      });

      const spendRes = await API.get('spend-by-cost-centre/');
      const spendArr = Array.isArray(spendRes.data) ? spendRes.data : [];
      setSpendData(spendArr);
      setCostCentres(spendArr.map(item => item.cost_centre).filter(Boolean));

      const vendorRes = await API.get('top-vendors-by-spend/');
      setVendorData(Array.isArray(vendorRes.data) ? vendorRes.data : []);
    } catch (err) {
      console.error('Dashboard error:', err);
      setError('Failed to load dashboard data. Please try again.');
      setTrend([]);
      setSpendData([]);
      setVendorData([]);
      setFinancialMetrics({ totalRevenue: 0, totalExpenses: 0, budgetUtilization: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetFilters = () => {
    setSearch('');
    setCostCentreFilter('');
    setDateRange({ from: null, to: null });
  };

  const filteredTrend = trend.filter(item => {
    const itemDate = item.date || '';
    const matchesSearch = !search || itemDate.toLowerCase().includes(search.toLowerCase());
    const dateObj = new Date(itemDate);
    const inDateRange = (!dateRange.from || dateObj >= new Date(dateRange.from)) &&
                        (!dateRange.to || dateObj <= new Date(dateRange.to));
    return matchesSearch && inDateRange;
  });

  const filteredSpendData = spendData.filter(item =>
    !costCentreFilter || (item.cost_centre || '').toLowerCase().includes(costCentreFilter.toLowerCase())
  );

  const chartData = {
    labels: filteredTrend.length > 0 ? filteredTrend.map(item => item.date || 'Unknown') : ['No Data'],
    datasets: [{
      label: 'Classified Transactions',
      data: filteredTrend.length > 0 ? filteredTrend.map(item => item.classified_count || 0) : [0],
      borderColor: '#4F46E5',
      backgroundColor: (context) => {
        const ctx = context.chart.ctx;
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(79, 70, 229, 0.3)');
        gradient.addColorStop(1, 'rgba(79, 70, 229, 0.05)');
        return gradient;
      },
      fill: true,
      tension: 0.4,
      pointRadius: 4,
      pointHoverRadius: 6,
      pointBackgroundColor: '#ffffff',
      pointBorderColor: '#4F46E5',
      pointBorderWidth: 2,
    }],
  };

  const pieData = {
    labels: filteredSpendData.length > 0 ? filteredSpendData.map(item => item.cost_centre || 'Unknown') : ['No Data'],
    datasets: [{
      label: 'Spend by Cost Centre',
      data: filteredSpendData.length > 0 ? filteredSpendData.map(item => item.total || 0) : [0],
      backgroundColor: ['#4F46E5', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#F43F5E', '#06B6D4'],
      borderColor: '#ffffff',
      borderWidth: 2,
      hoverOffset: 20,
    }],
  };

  const chartOptions = {
    plugins: {
      legend: { position: 'bottom', labels: { font: { size: 13, family: 'Inter', weight: '500' }, padding: 20, color: '#1F2937', usePointStyle: true } },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        titleFont: { size: 14, family: 'Inter', weight: '600' },
        bodyFont: { size: 13, family: 'Inter' },
        padding: 12, cornerRadius: 8, boxPadding: 6, borderWidth: 1, borderColor: 'rgba(79, 70, 229, 0.2)',
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#6B7280', font: { family: 'Inter', size: 12 }, padding: 10, maxTicksLimit: 10 } },
      y: {
        grid: { color: 'rgba(209, 213, 219, 0.3)', borderDash: [4, 4], drawBorder: false },
        ticks: { color: '#6B7280', font: { family: 'Inter', size: 12 }, padding: 10, beginAtZero: true },
      },
    },
    elements: { line: { borderWidth: 3 }, point: { hitRadius: 8 } },
    interaction: { mode: 'index', intersect: false },
    maintainAspectRatio: false, responsive: true,
  };

  const pieOptions = {
    plugins: {
      legend: { position: 'bottom', labels: { font: { size: 13, family: 'Inter', weight: '500' }, padding: 20, color: '#1F2937', usePointStyle: true, boxWidth: 8, boxHeight: 8 } },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        titleFont: { size: 14, family: 'Inter', weight: '600' },
        bodyFont: { size: 13, family: 'Inter' },
        padding: 12, cornerRadius: 8, boxPadding: 6,
        callbacks: {
          label: context => {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((acc, val) => acc + val, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%';
            return `${label}: $${value.toLocaleString()} (${percentage})`;
          },
        },
      },
    },
    elements: { arc: { borderWidth: 2, borderRadius: 6 } },
    cutout: '70%', maintainAspectRatio: false, responsive: true,
  };

  const statIcons = {
    Users: <FaUsers />,
    Companies: <FaBuilding />,
    Projects: <FaProjectDiagram />,
    Properties: <FaHome />,
    Assets: <FaCubes />,
    Contacts: <FaAddressBook />,
    'Cost Centres': <FaDollarSign />,
    Banks: <FaUniversity />,
    Vendors: <FaStore />,
    'Transaction Types': <FaTags />,
  };

  // Build the source set of all stats, then filter by visibleStatKeys (role)
  const allStats = useMemo(() => ({
    Users: stats.total_users,
    Companies: stats.total_companies,
    Projects: stats.total_projects,
    Properties: stats.total_properties,
    Assets: stats.total_assets,
    Contacts: stats.total_contacts,
    'Cost Centres': stats.total_cost_centres,
    Banks: stats.total_banks,
    Vendors: stats.total_vendors,
    'Transaction Types': stats.total_transaction_types,
  }), [stats]);

  const roleStats = useMemo(() => {
    const out = {};
    for (const k of visibleStatKeys) out[k] = allStats[k] ?? 0;
    return out;
  }, [visibleStatKeys, allStats]);

  const maxStatValue = Math.max(...Object.values(roleStats).map(v => v || 0), 100);

  const RadialProgress = ({ value, label, icon }) => {
    const percentage = Math.min((value / maxStatValue) * 100, 100);
    const id = `tile-${tid(label)}`;
    return (
      <>
        <motion.div
          data-tip={`${label}: ${value ?? 0}`}
          data-for={id}
          whileHover={{ scale: 1.03, boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white rounded-xl p-6 flex flex-col items-center relative shadow-sm border border-gray-100"
          aria-label={`${label}: ${value ?? 0}`}
        >
          <div className="relative w-20 h-20">
            <svg className="w-full h-full" viewBox="0 0 100 100">
              <circle className="text-gray-200" strokeWidth="6" stroke="currentColor" fill="transparent" r="44" cx="50" cy="50" />
              <circle
                className="text-indigo-600"
                strokeWidth="6"
                strokeDasharray={`${percentage * 2.76}, 276.48`}
                strokeDashoffset="0"
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
                r="44"
                cx="50"
                cy="50"
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-xl text-indigo-600">{icon}</div>
          </div>
          <p className="mt-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="text-lg font-semibold text-gray-900">{value ?? 0}</p>
        </motion.div>
        <ReactTooltip id={id} place="top" effect="solid" />
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8 font-inter">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
        <motion.h1 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="text-3xl lg:text-4xl font-bold text-gray-800">
          Financial Analytics Dashboard
        </motion.h1>
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <input
            type="text"
            placeholder="Search by date (YYYY-MM-DD)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full sm:w-64 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
            aria-label="Search transactions by date"
          />
          <select
            value={costCentreFilter}
            onChange={e => setCostCentreFilter(e.target.value)}
            className="w-full sm:w-64 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
            aria-label="Filter by cost centre"
          >
            <option value="">All Cost Centres</option>
            {costCentres.map(centre => (
              <option key={centre} value={centre}>{centre}</option>
            ))}
          </select>
          <div className="flex gap-3">
            <DatePicker
              selected={dateRange.from}
              onChange={date => setDateRange({ ...dateRange, from: date })}
              placeholderText="From date"
              className="w-full sm:w-40 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
              aria-label="Select start date"
            />
            <DatePicker
              selected={dateRange.to}
              onChange={date => setDateRange({ ...dateRange, to: date })}
              placeholderText="To date"
              className="w-full sm:w-40 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
              aria-label="Select end date"
            />
          </div>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={fetchData} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 disabled:bg-indigo-400 transition"
            aria-label={loading ? 'Loading data' : 'Refresh data'}>
            <FaSyncAlt className={loading ? 'animate-spin' : ''} />
            {loading ? 'Loading...' : 'Refresh'}
          </motion.button>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={resetFilters}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg shadow-sm hover:bg-gray-300 transition"
            aria-label="Reset filters">
            <FaTimes /> Reset
          </motion.button>
        </div>
      </header>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2" role="alert">
            <FaExclamationTriangle /> {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Simple financial KPIs — keep visible for all roles */}
      <motion.section
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, staggerChildren: 0.1 }}
      >
        {[
          { label: 'Total Revenue', value: financialMetrics.totalRevenue, color: 'bg-green-50 text-green-700' },
          // If you want to expose more KPIs per role, add role checks here
        ].map(metric => {
          const id = `metric-${tid(metric.label)}`;
          const display = `$${(metric.value || 0).toLocaleString()}`;
          return (
            <React.Fragment key={metric.label}>
              <motion.div
                data-tip={`${metric.label}: ${display}`} data-for={id}
                whileHover={{ scale: 1.03, boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className={`p-6 ${metric.color || ''} rounded-xl shadow-sm border border-gray-100 flex flex-col`}
                aria-label={`${metric.label}: ${display}`}
              >
                <p className="text-sm font-medium uppercase tracking-wide text-gray-600">{metric.label}</p>
                <p className="text-2xl font-bold">{display}</p>
              </motion.div>
              <ReactTooltip id={id} place="top" effect="solid" />
            </React.Fragment>
          );
        })}
      </motion.section>

      {/* Role-based tiles */}
      <motion.section
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, staggerChildren: 0.1 }}
      >
        {Object.entries(roleStats).map(([label, value]) => (
          <RadialProgress key={label} value={value ?? 0} label={label} icon={statIcons[label]} />
        ))}
      </motion.section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
          initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Transaction Classification Trends</h2>
          <div className="h-80">
            {loading ? (
              <div className="h-full flex items-center justify-center text-gray-500">
                <FaSyncAlt className="animate-spin text-3xl" aria-hidden="true" />
                <span className="sr-only">Loading...</span>
              </div>
            ) : filteredTrend.length > 0 ? (
              <Line data={chartData} options={chartOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500 text-base">
                No transaction data available for the selected filters.
              </div>
            )}
          </div>
        </motion.div>

        <motion.div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Spend by Cost Centre</h2>
          <div className="h-80 relative">
            {loading ? (
              <div className="h-full flex items-center justify-center text-gray-500">
                <FaSyncAlt className="animate-spin text-3xl" aria-hidden="true" />
                <span className="sr-only">Loading...</span>
              </div>
            ) : filteredSpendData.length > 0 && filteredSpendData.some(item => item.total > 0) ? (
              <>
                <Pie data={pieData} options={pieOptions} />
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                  <p className="text-2xl font-bold text-gray-800">
                    ${filteredSpendData.reduce((acc, item) => acc + (item.total || 0), 0).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500">Total Spend</p>
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500 text-base">No spend data available.</div>
            )}
          </div>
        </motion.div>
      </section>
    </div>
  );
}

export default Dashboard;
