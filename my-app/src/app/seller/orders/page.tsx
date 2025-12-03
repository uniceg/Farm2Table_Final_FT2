"use client";
import React, { useState, useEffect } from "react";
import OrderList from "./components/OrderList/OrderList";
import OrderDetails from "./components/OrderDetails/OrderDetails";
import GenerateReportModal from "./components/GenerateReportModal/GenerateReportModal";
import styles from "./orders.module.css";
// Firebase imports
import { collection, getDocs, orderBy, query, doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "../../../utils/lib/firebase";
import { useAuth } from "../../context/AuthContext";
import { useCategory } from "../../context/CategoryContext";
// Lucide React icons
import { Search, Eye } from "lucide-react";
// Interfaces
interface Product {
  name: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  sellerId?: string;
  productId?: string;
  image?: string;
  notes?: string;
}

interface SellerInfo {
  sellerId: string;
  sellerName: string;
  items: Product[];
  subtotal: number;
}

interface PaymentInfo {
  method: string;
  status: string;
  transactionId?: string;
  paidAt?: string;
}

interface DeliveryInfo {
  method: string;
  time: string;
  estimatedDelivery?: string;
  courier?: string;
  trackingNumber?: string;
}

interface Order {
  id: string;
  orderNumber: string; // ✅ ADDED: Custom order number field
  buyerName: string;
  products: Product[];
  totalPrice: number;
  orderDate: string;
  status: string;
  contact: string;
  address: string;
  deliveryMethod: string;
  specialInstructions?: string;
  sellers?: SellerInfo[];
  isForCurrentSeller: boolean;
  currentSellerItems?: Product[];
  currentSellerSubtotal?: number;
  
  // Add new fields
  payment?: PaymentInfo;
  delivery?: DeliveryInfo;
  deliveryTime?: string;
}

// Report interfaces
interface ReportFilters {
  startDate: string;
  endDate: string;
  status: string;
  reportType: "sales" | "orders" | "products";
}

interface SalesReport {
  totalOrders: number;
  totalRevenue: number;
  completedOrders: number;
  pendingOrders: number;
  canceledOrders: number;
  averageOrderValue: number;
  topProducts: { name: string; quantity: number; revenue: number }[];
}

// Order Status Badge Component
const OrderStatusBadge = ({ status }: { status: string }) => {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return { color: '#f59e0b', bgColor: '#fffbeb', text: 'Pending' };
      case 'confirmed':
        return { color: '#3b82f6', bgColor: '#eff6ff', text: 'Confirmed' };
      case 'shipped':
        return { color: '#8b5cf6', bgColor: '#faf5ff', text: 'Shipped' };
      case 'delivered':
        return { color: '#10b981', bgColor: '#ecfdf5', text: 'Delivered' };
      case 'cancelled':
        return { color: '#ef4444', bgColor: '#fef2f2', text: 'Cancelled' };
      default:
        return { color: '#6b7280', bgColor: '#f9fafb', text: status };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span 
      className={styles.statusBadge}
      style={{ 
        color: config.color, 
        backgroundColor: config.bgColor,
        border: `1px solid ${config.color}20`
      }}
    >
      {config.text}
    </span>
  );
};

export default function OrdersPage() {
  // Use category context instead of local state
  const { selectedCategory, setSelectedCategory } = useCategory();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Report generation states
  const [showReportModal, setShowReportModal] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportData, setReportData] = useState<SalesReport | null>(null);
  
  // Get current user/seller info
  const { user, loading: authLoading } = useAuth();
  const currentSellerId = user?.uid;

  // Fetch orders from Firebase and filter by current seller
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        setError(null);
        
        if (!currentSellerId) {
          console.log("No seller ID found, cannot fetch orders");
          setLoading(false);
          return;
        }
        console.log("🔍 Fetching orders for seller:", currentSellerId);
        
        const ordersQuery = query(
          collection(db, "orders"),
          orderBy("createdAt", "desc")
        );
        
        const querySnapshot = await getDocs(ordersQuery);
        const ordersData: Order[] = [];
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          console.log("📦 Processing order:", doc.id, "Order number:", data.orderNumber);
          
          // Check if this order contains items for the current seller
          const hasSellerItems = checkIfOrderHasSellerItems(data, currentSellerId);
          
          if (!hasSellerItems) {
            console.log("❌ Order not for current seller, skipping");
            return;
          }
          
          console.log("✅ Order contains items for current seller");
          
          // Extract products for current seller only
          const { products, subtotal } = extractSellerProducts(data, currentSellerId);
          
          if (products.length === 0) {
            console.log("⚠️ No products found for current seller after extraction");
            return;
          }
          
          const buyerName = data.buyerInfo?.name || data.buyerName || "Unknown Buyer";
          const contact = data.buyerInfo?.contact || data.contact || data.phone || "No contact";
          const address = data.buyerInfo?.address || data.address || data.deliveryAddress || "No address";
          
          // ✅ IMPORTANT: Use orderNumber field from Firestore data
          // If orderNumber doesn't exist, create a fallback from the document ID
          let orderNumber = data.orderNumber || `F2T-${doc.id.slice(-8).toUpperCase()}`;
          
          // Format the order number for display
          // If it already starts with F2T, keep it as is, otherwise prepend F2T-
          if (!orderNumber.startsWith('F2T-')) {
            orderNumber = `F2T-${orderNumber}`;
          }
          
          const order: Order = {
            id: doc.id,
            orderNumber: orderNumber, // ✅ Store the custom order number
            buyerName: buyerName,
            products: products,
            totalPrice: subtotal || data.totalPrice || 0,
            orderDate: data.createdAt?.toDate?.()?.toISOString() || 
                      data.orderDate || 
                      new Date().toISOString(),
            status: data.status || "pending",
            contact: contact,
            address: address,
            deliveryMethod: data.deliveryMethod || data.shippingMethod || "Standard Delivery",
            specialInstructions: data.specialInstructions || data.notes || "",
            sellers: data.sellers,
            isForCurrentSeller: true,
            currentSellerItems: products,
            currentSellerSubtotal: subtotal,
            
            // Add new fields with fallbacks
            payment: data.payment || {
              method: data.paymentMethod || "Cash on Delivery",
              status: data.paymentStatus || "pending"
            },
            delivery: data.delivery || {
              method: data.deliveryMethod || "Standard Delivery",
              time: data.deliveryTime || "Within 3-5 business days",
              estimatedDelivery: data.estimatedDelivery,
              trackingNumber: data.trackingNumber
            }
          };
          
          ordersData.push(order);
        });
        
        setOrders(ordersData);
        console.log("✅ Final processed orders for current seller:", ordersData.length);
        console.log("📊 Sample order numbers:", ordersData.slice(0, 3).map(o => o.orderNumber));
        
      } catch (err) {
        console.error("Error fetching orders from Firebase:", err);
        setError("Failed to load orders from server. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    
    if (!authLoading && currentSellerId) {
      fetchOrders();
    } else if (!authLoading && !currentSellerId) {
      setLoading(false);
    }
  }, [currentSellerId, authLoading]);

  // Helper function to check if order has items for current seller
  const checkIfOrderHasSellerItems = (orderData: any, sellerId: string): boolean => {
    if (orderData.sellers && Array.isArray(orderData.sellers)) {
      const sellerOrder = orderData.sellers.find((seller: any) => 
        seller.sellerId === sellerId
      );
      return !!sellerOrder && sellerOrder.items && sellerOrder.items.length > 0;
    }
    
    if (orderData.products && Array.isArray(orderData.products)) {
      return orderData.products.some((product: any) => product.sellerId === sellerId);
    }
    
    return false;
  };

  // Helper function to extract products for current seller only
  const extractSellerProducts = (orderData: any, sellerId: string): { products: Product[], subtotal: number } => {
    let products: Product[] = [];
    let subtotal = 0;
    
    if (orderData.sellers && Array.isArray(orderData.sellers)) {
      const sellerOrder = orderData.sellers.find((seller: any) => 
        seller.sellerId === sellerId
      );
      
      if (sellerOrder && sellerOrder.items && Array.isArray(sellerOrder.items)) {
        products = sellerOrder.items.map((item: any) => ({
          name: item.name || "Unknown Product",
          quantity: item.quantity || 1,
          unitPrice: item.price || item.unitPrice || 0,
          unit: item.unit || "pc",
          sellerId: item.sellerId,
          productId: item.productId,
          image: item.image,
          notes: item.notes
        }));
        subtotal = sellerOrder.subtotal || 0;
      }
    }
    
    if (products.length === 0 && orderData.products && Array.isArray(orderData.products)) {
      const sellerProducts = orderData.products.filter((product: any) => 
        product.sellerId === sellerId
      );
      products = sellerProducts.map((item: any) => ({
        name: item.name || "Unknown Product",
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || item.price || 0,
        unit: item.unit || "pc",
        sellerId: item.sellerId
      }));
    }
    
    return { products, subtotal };
  };

  // Generate sales report
  const generateSalesReport = async (filters: ReportFilters) => {
    try {
      setGeneratingReport(true);
      
      // Filter orders based on report criteria
      const filteredOrders = orders.filter(order => {
        const orderDate = new Date(order.orderDate);
        const startDate = new Date(filters.startDate);
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999); // End of day
        
        const matchesDate = orderDate >= startDate && orderDate <= endDate;
        const matchesStatus = filters.status === "all" || order.status === filters.status;
        
        return matchesDate && matchesStatus;
      });
      
      // Calculate report data
      const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.totalPrice, 0);
      const completedOrders = filteredOrders.filter(order => order.status === "completed").length;
      const pendingOrders = filteredOrders.filter(order => order.status === "pending").length;
      const canceledOrders = filteredOrders.filter(order => order.status === "canceled").length;
      const averageOrderValue = filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0;
      
      // Calculate top products
      const productSales: { [key: string]: { name: string; quantity: number; revenue: number } } = {};
      
      filteredOrders.forEach(order => {
        order.products.forEach(product => {
          if (!productSales[product.name]) {
            productSales[product.name] = {
              name: product.name,
              quantity: 0,
              revenue: 0
            };
          }
          productSales[product.name].quantity += product.quantity;
          productSales[product.name].revenue += product.quantity * product.unitPrice;
        });
      });
      
      const topProducts = Object.values(productSales)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10); // Top 10 products
      
      const report: SalesReport = {
        totalOrders: filteredOrders.length,
        totalRevenue,
        completedOrders,
        pendingOrders,
        canceledOrders,
        averageOrderValue,
        topProducts
      };
      
      setReportData(report);
      return report;
      
    } catch (error) {
      console.error("Error generating report:", error);
      throw new Error("Failed to generate report");
    } finally {
      setGeneratingReport(false);
    }
  };

  // Export report to CSV
  const exportToCSV = (report: SalesReport, filters: ReportFilters) => {
    const headers = ["Metric", "Value"];
    const data = [
      ["Report Period", `${filters.startDate} to ${filters.endDate}`],
      ["Total Orders", report.totalOrders.toString()],
      ["Total Revenue", `₱${report.totalRevenue.toFixed(2)}`],
      ["Completed Orders", report.completedOrders.toString()],
      ["Pending Orders", report.pendingOrders.toString()],
      ["Canceled Orders", report.canceledOrders.toString()],
      ["Average Order Value", `₱${report.averageOrderValue.toFixed(2)}`],
      [],
      ["Top Products", "Quantity", "Revenue"]
    ];
    
    report.topProducts.forEach(product => {
      data.push([product.name, product.quantity.toString(), `₱${product.revenue.toFixed(2)}`]);
    });
    
    const csvContent = data.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sales-report-${filters.startDate}-to-${filters.endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ✅ FIXED: Filter orders for display - Show all orders immediately
  const filteredOrders = React.useMemo(() => {
    console.log("🔄 Filtering orders...");
    console.log("📦 Total orders:", orders.length);
    console.log("🔍 Selected category:", selectedCategory);
    console.log("🔎 Search term:", searchTerm);
    
    // If no category selected or "all", show all orders immediately
    if (!selectedCategory || selectedCategory === "all" || selectedCategory === "All Orders") {
      console.log("✅ Showing ALL orders");
      const allOrders = orders.filter(order => {
        const buyerName = order.buyerName || "";
        const orderNumber = order.orderNumber || ""; // ✅ Use orderNumber for search
        const orderId = order.id || "";
        
        const matchesSearch = 
          buyerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          orderId.toLowerCase().includes(searchTerm.toLowerCase());
        
        return matchesSearch;
      });
      
      console.log(`🔍 Search result: ${allOrders.length} orders found`);
      return allOrders;
    }
    
    // Only filter by status if a specific category is selected
    const filtered = orders.filter(order => {
      const matchesTab = order.status === selectedCategory;
      const buyerName = order.buyerName || "";
      const orderNumber = order.orderNumber || ""; // ✅ Use orderNumber for search
      const orderId = order.id || "";
      
      const matchesSearch = 
        buyerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        orderId.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesTab && matchesSearch;
    });
    
    console.log(`🔍 Filter result: ${filtered.length} orders found in "${selectedCategory}"`);
    return filtered;
  }, [orders, selectedCategory, searchTerm]);

  // Handle status updates
  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      if (!currentSellerId) {
        alert("Cannot update order: No seller ID found");
        return;
      }
      
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, {
        status: newStatus,
        updatedAt: Timestamp.now()
      });
      
      setOrders(prev => prev.map(order => 
        order.id === orderId ? { ...order, status: newStatus } : order
      ));
      
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
      }
      
      if (newStatus === "completed" || newStatus === "canceled") {
        setSelectedOrder(null);
      }
    } catch (error) {
      console.error("Error updating order status:", error);
      alert("Failed to update order status");
    }
  };

  if (authLoading) {
    return (
      <div className={styles.ordersPage}>
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.ordersPage}>
      <div className={styles.ordersContent}>
        <div className={styles.header}>
          <div className={styles.headerTop}>
            {/* Search Container with Icon */}
            <div className={styles.searchContainer}>
              <Search size={20} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search orders by buyer, order number, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles.searchInput}
              />
            </div>
            
            {/* Generate Report Button - Updated to match fresh arrivals design */}
            <button 
              className={styles.reportButton}
              onClick={() => setShowReportModal(true)}
            >
              Generate Report
            </button>
          </div>
          
          {/* Stats Overview with colored borders and white background */}
          <div className={styles.statsOverview}>
            <div className={`${styles.statCard} ${styles.totalOrdersCard}`}>
              <span className={styles.statNumber}>{orders.length}</span>
              <span className={styles.statLabel}>Total Orders</span>
            </div>
            <div className={`${styles.statCard} ${styles.totalRevenueCard}`}>
              <span className={styles.statNumber}>
                ₱{orders.reduce((sum, order) => sum + order.totalPrice, 0).toFixed(2)}
              </span>
              <span className={styles.statLabel}>Total Revenue</span>
            </div>
            <div className={`${styles.statCard} ${styles.completedCard}`}>
              <span className={styles.statNumber}>
                {orders.filter(order => order.status === "completed").length}
              </span>
              <span className={styles.statLabel}>Completed</span>
            </div>
            <div className={`${styles.statCard} ${styles.pendingCard}`}>
              <span className={styles.statNumber}>
                {orders.filter(order => order.status === "pending").length}
              </span>
              <span className={styles.statLabel}>Pending</span>
            </div>
          </div>
          
          {/* Seller info */}
          {currentSellerId && (
            <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
              Showing orders for your store only
            </div>
          )}
          
          {/* Error Banner */}
          {error && (
            <div className={styles.errorBanner}>
              {error}
            </div>
          )}
        </div>
        
        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.loadingSpinner}></div>
            <p>Loading your orders...</p>
          </div>
        ) : !currentSellerId ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🔒</div>
            <h3>Seller Not Logged In</h3>
            <p>Please log in to view your orders.</p>
          </div>
        ) : (
          <>
            {/* ✅ UPDATED: Simple Orders Table with Order Number (ID removed) */}
            <div className={styles.tableContainer}>
              <table className={styles.ordersTable}>
                <thead>
                  <tr>
                    <th>Order Number</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.length > 0 ? (
                    filteredOrders.map(order => (
                      <tr key={order.id}>
                        {/* ✅ Display the custom order number without ID */}
                        <td className={styles.orderNumber}>
                          <strong>{order.orderNumber}</strong>
                        </td>
                        <td>
                          <div className={styles.customerInfo}>
                            <strong>{order.buyerName || 'Customer'}</strong>
                            <span>{order.contact || 'No contact'}</span>
                          </div>
                        </td>
                        <td>
                          <OrderStatusBadge status={order.status} />
                        </td>
                        <td>
                          <div className={styles.actions}>
                            <button 
                              className={styles.viewBtn}
                              onClick={() => setSelectedOrder(order)}
                              title="View Order Details"
                            >
                              <Eye size={16} />
                              View Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className={styles.noOrders}>
                        <div className={styles.emptyState}>
                          <p>No orders found</p>
                          <span>
                            {searchTerm || selectedCategory !== "all" 
                              ? "Try adjusting your search or filter criteria" 
                              : "You don't have any orders yet. Orders will appear here when customers purchase your products."}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* KEEP EXISTING OrderList COMPONENT */}
            {filteredOrders.length === 0 && !error ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>📦</div>
                <h3>No orders found</h3>
                <p>
                  {searchTerm || selectedCategory !== "all" 
                    ? "Try adjusting your search or filter criteria" 
                    : "You don't have any orders yet. Orders will appear here when customers purchase your products."}
                </p>
              </div>
            ) : (
              <OrderList
                orders={filteredOrders}
                onOrderSelect={setSelectedOrder}
              />
            )}
          </>
        )}
      </div>
      
      {selectedOrder && (
        <OrderDetails
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onStatusUpdate={handleStatusUpdate}
        />
      )}
      
      {showReportModal && (
        <GenerateReportModal
          onClose={() => {
            setShowReportModal(false);
            setReportData(null);
          }}
          onGenerateReport={generateSalesReport}
          onExportCSV={exportToCSV}
          generatingReport={generatingReport}
          reportData={reportData}
        />
      )}
    </div>
  );
}