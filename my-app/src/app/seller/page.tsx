"use client";
import { TrendingUp, Clock, CheckCircle, AlertCircle, Calendar } from "lucide-react"; // Removed DollarSign
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { useState, useMemo, useEffect } from 'react';
import styles from "./seller.module.css";
// Firebase imports
import { doc, getDoc, collection, query, where, getDocs, orderBy, startAt, endAt, Timestamp } from 'firebase/firestore';
import { auth, db } from '../../utils/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement
);
// Weekly Chart Options
const weeklyChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      titleColor: '#273F4F',
      bodyColor: '#273F4F',
      borderColor: '#FFC93C',
      borderWidth: 1,
      cornerRadius: 8,
      displayColors: false,
      callbacks: {
        label: function(context: any) {
          return `₱${context.parsed.y.toLocaleString()}`;
        },
        title: function(tooltipItems: any) {
          return tooltipItems[0].label;
        }
      }
    },
    title: {
      display: false,
    },
  },
  scales: {
    x: {
      grid: {
        display: false,
        drawBorder: false,
      },
      ticks: {
        color: '#273F4F',
        font: {
          size: 11,
          weight: '500' as const,
        },
        maxRotation: 0,
      },
    },
    y: {
      beginAtZero: true,
      grid: {
        color: 'rgba(39, 63, 79, 0.05)',
        drawBorder: false,
      },
      ticks: {
        color: '#273F4F',
        font: {
          size: 11,
        },
        callback: function(value: any) {
          return '₱' + value.toLocaleString();
        },
        maxTicksLimit: 6,
      },
      border: {
        dash: [4, 4],
      },
    },
  },
  interaction: {
    intersect: false,
    mode: 'index' as const,
  },
  animation: {
    duration: 1000,
    easing: 'easeOutQuart' as const,
  },
};
// Monthly Chart Options
const monthlyChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      titleColor: '#273F4F',
      bodyColor: '#273F4F',
      borderColor: '#FFC93C',
      borderWidth: 1,
      cornerRadius: 8,
      displayColors: false,
      callbacks: {
        label: function(context: any) {
          return `₱${context.parsed.y.toLocaleString()}`;
        },
        title: function(tooltipItems: any) {
          return tooltipItems[0].label;
        }
      }
    },
    title: {
      display: false,
    },
  },
  scales: {
    x: {
      grid: {
        display: false,
        drawBorder: false,
      },
      ticks: {
        color: '#273F4F',
        font: {
          size: 10,
          weight: '500' as const,
        },
        maxRotation: 45,
      },
    },
    y: {
      beginAtZero: true,
      grid: {
        color: 'rgba(39, 63, 79, 0.05)',
        drawBorder: false,
      },
      ticks: {
        color: '#273F4F',
        font: {
          size: 10,
        },
        callback: function(value: any) {
          return '₱' + (value / 1000) + 'k';
        },
        maxTicksLimit: 8,
      },
      border: {
        dash: [4, 4],
      },
    },
  },
  interaction: {
    intersect: false,
    mode: 'index' as const,
  },
  animation: {
    duration: 1000,
    easing: 'easeOutQuart' as const,
  },
};
export default function SellerDashboard() {
  const [revenueView, setRevenueView] = useState<"week" | "month">("week");
  // State for backend data
  const [farmName, setFarmName] = useState("Your Farm");
  const [loading, setLoading] = useState(true);
  const [statsData, setStatsData] = useState({
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
    pendingOrders: 0,
    todayRevenue: 0,
    weekRevenue: 0,
    monthRevenue: 0,
    revenueTrend: "+0%",
    lowStockItems: 0,
    outOfStockItems: 0,
    todaysDeliveries: 0,
    completedDeliveries: 0
  });
  const [weeklyRevenueData, setWeeklyRevenueData] = useState({
    labels: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    datasets: [
      {
        label: 'Revenue',
        data: [0, 0, 0, 0, 0, 0, 0],
        backgroundColor: [
          'rgba(255, 201, 60, 0.8)',
          'rgba(255, 201, 60, 0.7)',
          'rgba(255, 201, 60, 0.9)',
          'rgba(255, 201, 60, 0.7)',
          'rgba(255, 201, 60, 1.0)',
          'rgba(255, 201, 60, 0.9)',
          'rgba(255, 201, 60, 0.6)'
        ],
        borderColor: [
          '#FFC93C',
          '#FFC93C',
          '#FFC93C',
          '#FFC93C',
          '#FFC93C',
          '#FFC93C',
          '#FFC93C'
        ],
        borderWidth: 2,
        borderRadius: 12,
        borderSkipped: false,
        barPercentage: 0.6,
        categoryPercentage: 0.7,
      }
    ]
  });
  const [monthlyRevenueData, setMonthlyRevenueData] = useState({
    labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    datasets: [
      {
        label: 'Revenue',
        data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        backgroundColor: [
          'rgba(255, 201, 60, 0.8)',
          'rgba(255, 201, 60, 0.7)',
          'rgba(255, 201, 60, 0.9)',
          'rgba(255, 201, 60, 0.8)',
          'rgba(255, 201, 60, 0.7)',
          'rgba(255, 201, 60, 0.9)',
          'rgba(255, 201, 60, 0.8)',
          'rgba(255, 201, 60, 0.7)',
          'rgba(255, 201, 60, 0.9)',
          'rgba(255, 201, 60, 0.8)',
          'rgba(255, 201, 60, 0.7)',
          'rgba(255, 201, 60, 0.6)'
        ],
        borderColor: [
          '#FFC93C',
          '#FFC93C',
          '#FFC93C',
          '#FFC93C',
          '#FFC93C',
          '#FFC93C',
          '#FFC93C',
          '#FFC93C',
          '#FFC93C',
          '#FFC93C',
          '#FFC93C',
          '#FFC93C'
        ],
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
        barPercentage: 0.7,
        categoryPercentage: 0.8,
      }
    ]
  });
  // Fetch farm name from Firebase
  const fetchFarmName = async (user: any) => {
    try {
      const sellerDoc = await getDoc(doc(db, 'sellers', user.uid));
      
      if (sellerDoc.exists()) {
        const firestoreData = sellerDoc.data();
        const farmName = firestoreData.farmName || firestoreData.farm?.farmName || 'Your Farm';
        console.log('🏪 Farm name fetched:', farmName);
        setFarmName(farmName);
        return farmName;
      } else {
        console.log('❌ No seller profile found');
        setFarmName('Your Farm');
        return 'Your Farm';
      }
    } catch (err) {
      console.error('Error fetching farm name:', err);
      setFarmName('Your Farm');
      return 'Your Farm';
    }
  };
  // Get today's date range
  const getTodayDateRange = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { start: today, end: tomorrow };
  };
  // Get this week's date range
  const getThisWeekDateRange = () => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);
    return { start: startOfWeek, end: endOfWeek };
  };
  // Get this month's date range
  const getThisMonthDateRange = () => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);
    return { start: startOfMonth, end: endOfMonth };
  };
  // Fetch orders data - Using your existing order structure
  const fetchOrdersData = async (userId: string) => {
    try {
      const ordersRef = collection(db, 'orders');
      
      // Get date ranges
      const todayRange = getTodayDateRange();
      const weekRange = getThisWeekDateRange();
      const monthRange = getThisMonthDateRange();
      // Fetch all orders and filter in JavaScript to avoid index issues
      const querySnapshot = await getDocs(ordersRef);
      
      let todayOrders = 0;
      let weekOrders = 0;
      let monthOrders = 0;
      let pendingOrders = 0;
      let todayRevenue = 0;
      let weekRevenue = 0;
      let monthRevenue = 0;
      querySnapshot.forEach((doc) => {
        const order = doc.data();
        
        // Check if this order belongs to the current seller
        const sellerOrders = order.sellers || [];
        const isSellerOrder = sellerOrders.some((seller: any) => seller.sellerId === userId);
        
        if (!isSellerOrder) return;
        const orderDate = order.createdAt ? new Date(order.createdAt) : new Date();
        const orderTotal = order.totalPrice || 0;
        const status = order.status || 'pending';
        // Filter dates in JavaScript
        // Today's orders
        if (orderDate >= todayRange.start && orderDate < todayRange.end) {
          todayOrders++;
          todayRevenue += orderTotal;
        }
        // This week's orders
        if (orderDate >= weekRange.start && orderDate < weekRange.end) {
          weekOrders++;
          weekRevenue += orderTotal;
        }
        // This month's orders
        if (orderDate >= monthRange.start && orderDate < monthRange.end) {
          monthOrders++;
          monthRevenue += orderTotal;
        }
        // Count pending orders
        if (status === 'pending') {
          pendingOrders++;
        }
      });
      // Update stats data
      setStatsData(prev => ({
        ...prev,
        today: todayOrders,
        thisWeek: weekOrders,
        thisMonth: monthOrders,
        pendingOrders: pendingOrders,
        todayRevenue: todayRevenue,
        weekRevenue: weekRevenue,
        monthRevenue: monthRevenue
      }));
    } catch (error) {
      console.error('Error fetching orders data:', error);
    }
  };
  // Fetch revenue chart data
  const fetchRevenueData = async (userId: string) => {
    try {
      const ordersRef = collection(db, 'orders');
      const querySnapshot = await getDocs(ordersRef);
      
      // Initialize weekly data
      const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const weeklyRevenue = [0, 0, 0, 0, 0, 0, 0];
      
      // Initialize monthly data
      const monthlyRevenue = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      querySnapshot.forEach((doc) => {
        const order = doc.data();
        
        // Check if this order belongs to the current seller
        const sellerOrders = order.sellers || [];
        const isSellerOrder = sellerOrders.some((seller: any) => seller.sellerId === userId);
        
        if (!isSellerOrder) return;
        const orderDate = order.createdAt ? new Date(order.createdAt) : new Date();
        const sellerInfo = sellerOrders.find((seller: any) => seller.sellerId === userId);
        const orderTotal = sellerInfo?.subtotal || 0;
        if (orderDate) {
          // Weekly data
          const dayOfWeek = (orderDate.getDay() + 6) % 7; // Convert to Monday-start week
          weeklyRevenue[dayOfWeek] += orderTotal;
          // Monthly data
          const month = orderDate.getMonth();
          monthlyRevenue[month] += orderTotal;
        }
      });
      setWeeklyRevenueData(prev => ({
        ...prev,
        datasets: [{
          ...prev.datasets[0],
          data: weeklyRevenue
        }]
      }));
      setMonthlyRevenueData(prev => ({
        ...prev,
        datasets: [{
          ...prev.datasets[0],
          data: monthlyRevenue
        }]
      }));
    } catch (error) {
      console.error('Error fetching revenue data:', error);
    }
  };
  // Main data fetching function
  const fetchDashboardData = async (user: any) => {
    try {
      setLoading(true);
      await fetchFarmName(user);
      await fetchOrdersData(user.uid);
      await fetchRevenueData(user.uid);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };
  // Fetch data on component mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await fetchDashboardData(user);
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);
  // Revenue metrics calculation
  const weeklyMetrics = useMemo(() => {
    const weekData = weeklyRevenueData.datasets[0].data;
    const total = weekData.reduce((sum, val) => sum + val, 0);
    const averageDaily = total / weekData.length;
    const highestAmount = Math.max(...weekData);
    const highestDayIndex = weekData.indexOf(highestAmount);
    const highestDay = weeklyRevenueData.labels[highestDayIndex];
    return {
      averageDaily,
      highestDay,
      highestAmount,
      growth: "+15%",
      trend: 'up' as const,
      total,
      currentMonth: new Date().toLocaleString('default', { month: 'long' }),
      currentMonthRevenue: statsData.monthRevenue
    };
  }, [weeklyRevenueData, statsData.monthRevenue]);
  const monthlyMetrics = useMemo(() => {
    const monthData = monthlyRevenueData.datasets[0].data;
    const total = monthData.reduce((sum, val) => sum + val, 0);
    const averageMonthly = total / monthData.length;
    const highestAmount = Math.max(...monthData);
    const highestMonthIndex = monthData.indexOf(highestAmount);
    const highestMonth = monthlyRevenueData.labels[highestMonthIndex];
    return {
      averageMonthly,
      highestMonth,
      highestAmount,
      growth: "+12%",
      trend: 'up' as const,
      total,
      currentMonth: new Date().toLocaleString('default', { month: 'long' }),
      currentMonthRevenue: statsData.monthRevenue,
      averageDaily: statsData.todayRevenue,
      highestDay: 'Today'
    };
  }, [monthlyRevenueData, statsData.monthRevenue, statsData.todayRevenue]);
  if (loading) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.loading}>Loading dashboard...</div>
      </div>
    );
  }
  const currentData = revenueView === "week" ? weeklyRevenueData : monthlyRevenueData;
  const currentMetrics = revenueView === "week" ? weeklyMetrics : monthlyMetrics;
  const currentOptions = revenueView === "week" ? weeklyChartOptions : monthlyChartOptions;
  const isWeekly = revenueView === "week";
  return (
    <div className={styles.dashboard}>
      {/* Header Section - Updated to match buyer design */}
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <div className={styles.titleSection}>
            <h1 className={styles.title}>
              WELCOME BACK, {farmName.toUpperCase()}!
            </h1>
            <p className={styles.subtitle}>Here&apos;s your farm&apos;s performance overview</p>
          </div>
          <div className={styles.dateSection}>
            <div className={styles.dateCard}>
              <Calendar size={16} />
              <span className={styles.date}>
                {new Date().toLocaleDateString('en-PH', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content Container */}
      <div className={styles.mainContent}>
        
        {/* Stats Cards Section - Updated to match buyer design */}
        <div className={styles.statsSection}>
          <div className={styles.statsGrid}>
            {/* Today's Orders */}
            <div className={`${styles.statCard} ${styles.statCard0}`}>
              <div className={styles.statCard3d}>
                <div className={styles.statInfo}>
                  <h3 className={styles.statTitle}>Today&apos;s Orders</h3>
                  <p className={styles.statDescription}>Live orders tracking</p>
                  <span className={styles.statValue}>{statsData.today}</span>
                </div>
              </div>
            </div>
            
            {/* This Week's Orders */}
            <div className={`${styles.statCard} ${styles.statCard1}`}>
              <div className={styles.statCard3d}>
                <div className={styles.statInfo}>
                  <h3 className={styles.statTitle}>Weekly Orders</h3>
                  <p className={styles.statDescription}>This week&apos;s performance</p>
                  <span className={styles.statValue}>{statsData.thisWeek}</span>
                </div>
              </div>
            </div>
            
            {/* Revenue Summary */}
            <div className={`${styles.statCard} ${styles.statCard2}`}>
              <div className={styles.statCard3d}>
                <div className={styles.statInfo}>
                  <h3 className={styles.statTitle}>Today&apos;s Revenue</h3>
                  <p className={styles.statDescription}>Total earnings</p>
                  <span className={styles.statValue}>₱{statsData.todayRevenue.toLocaleString()}</span>
                </div>
              </div>
            </div>
            
            {/* Pending Actions */}
            <div className={`${styles.statCard} ${styles.statCard3}`}>
              <div className={styles.statCard3d}>
                <div className={styles.statInfo}>
                  <h3 className={styles.statTitle}>Pending Orders</h3>
                  <p className={styles.statDescription}>Need attention</p>
                  <span className={styles.statValue}>{statsData.pendingOrders}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Revenue Chart Section - Only Revenue chart since we have submenus now */}
        <div className={styles.chartsSection}>
          <div className={`${styles.chartCard} ${styles.revenueChartCard}`}>
            <div className={styles.chartHeader}>
              <div className={styles.chartTitleSection}>
                <TrendingUp size={24} /> {/* Changed from DollarSign to TrendingUp */}
                <div>
                  <h3>{revenueView === "week" ? "Weekly Revenue Trend" : "Monthly Revenue Overview"}</h3>
                  <div className={styles.revenueStats}>
                    <span className={styles.revenueStat}>
                      {isWeekly ? "Avg Daily:" : "Avg Monthly:"} <strong>₱{isWeekly ? currentMetrics.averageDaily.toLocaleString() : currentMetrics.averageMonthly.toLocaleString()}</strong>
                    </span>
                    <span className={styles.revenueStat}>
                      Growth: <strong className={styles.growthPositive}>{currentMetrics.growth}</strong>
                    </span>
                  </div>
                </div>
              </div>
              <div className={styles.revenueViewSelector}>
                <button
                  className={`${styles.viewButton} ${revenueView === "week" ? styles.active : ""}`}
                  onClick={() => setRevenueView("week")}
                >
                  This Week
                </button>
                <button
                  className={`${styles.viewButton} ${revenueView === "month" ? styles.active : ""}`}
                  onClick={() => setRevenueView("month")}
                >
                  This Year
                </button>
              </div>
            </div>
            
            <div className={styles.chartContainer}>
              <Bar data={currentData} options={currentOptions} />
            </div>
            
            <div className={styles.chartFooter}>
              <div className={styles.footerStats}>
                <div className={`${styles.footerStat} ${styles.blueOutline}`}>
                  <span className={styles.statLabel}>
                    {isWeekly ? "Peak Day" : "Peak Month"}
                  </span>
                  <span className={styles.statValue}>{isWeekly ? currentMetrics.highestDay : currentMetrics.highestMonth}</span>
                </div>
                <div className={`${styles.footerStat} ${styles.blueOutline}`}>
                  <span className={styles.statLabel}>Peak Revenue</span>
                  <span className={styles.statValue}>₱{currentMetrics.highestAmount.toLocaleString()}</span>
                </div>
                <div className={`${styles.footerStat} ${styles.blueOutline}`}>
                  <span className={styles.statLabel}>
                    {isWeekly ? "Week Total" : "Year Total"}
                  </span>
                  <span className={styles.statValue}>₱{currentMetrics.total.toLocaleString()}</span>
                </div>
              </div>
              {!isWeekly && (
                <div className={styles.currentMonthInfo}>
                  <Calendar size={16} />
                  <span>Current Month ({monthlyMetrics.currentMonth}): ₱{monthlyMetrics.currentMonthRevenue.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}