"use client";
import { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  Timestamp, 
  doc, 
  updateDoc, 
  deleteDoc,
  getDocs,
  DocumentData
} from "firebase/firestore";
import { db, auth } from "@/utils/lib/firebase";
import styles from "./notification.module.css";
import { usePathname } from "next/navigation";
import { 
  Package, 
  Users, 
  Clock, 
  Bell, 
  ShoppingCart, 
  Star, 
  Calendar, 
  AlertTriangle, 
  Sparkles, 
  Trash2, 
  DollarSign, 
  Truck, 
  UserCheck, 
  AlertCircle,
  Heart,
  UserPlus,
  UserMinus
} from "lucide-react";
import DeleteConfirmationModal from "../../../../components/auth/modals/DeleteConfirmationModal/DeleteConfirmationModal";
import { onAuthStateChanged } from "firebase/auth";

interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'order' | 'system' | 'promotion' | 'delivery' | 'follower';
  read: boolean;
  createdAt: Timestamp;
  orderId?: string;
  amount?: string;
  itemCount?: number;
  buyerName?: string;
  sellerName?: string;
  followerName?: string;
  productName?: string;
}

export default function SellerNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'earlier' | 'all'>('all');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUserId(user.uid);
        setupRealTimeListeners(user.uid);
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Real-time listeners for seller notifications
  const setupRealTimeListeners = (sellerId: string) => {
    setLoading(true);
    
    // Listen to seller notifications collection
    const notificationsQuery = query(
      collection(db, "sellerNotifications"),
      where("userId", "==", sellerId),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      notificationsQuery, 
      (snapshot) => {
        const notificationsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Notification[];
        
        console.log("🛍️ Seller notifications loaded:", notificationsData.map(n => ({
          id: n.id,
          orderId: n.orderId,
          title: n.title,
          type: n.type
        })));
        
        setNotifications(notificationsData);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching seller notifications:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  };

  // Function to create seller notification when buyer places order
  const createSellerOrderNotification = async (orderData: any, orderId: string, sellerId: string, sellerOrder: any) => {
    try {
      const buyerName = orderData.buyerInfo?.name || orderData.buyerName || "Customer";
      const items = sellerOrder.items || [];
      const totalAmount = sellerOrder.subtotal || 0;
      const itemCount = items.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
      const productNames = items.map((item: any) => item.name).slice(0, 2).join(", ");
      
      let title = "";
      let message = "";
      let type: 'order' | 'delivery' = 'order';

      switch (orderData.status) {
        case 'pending':
          title = 'New Order Received! 🎉';
          message = `${buyerName} placed an order for ${productNames}. Total: ₱${totalAmount}`;
          type = 'order';
          break;
        case 'confirmed':
          title = 'Order Confirmed';
          message = `Order #${orderId.slice(-6)} has been confirmed.`;
          type = 'order';
          break;
        case 'shipped':
          title = 'Order Shipped';
          message = `Your products for Order #${orderId.slice(-6)} are on the way.`;
          type = 'delivery';
          break;
        case 'delivered':
          title = 'Delivery Completed ✅';
          message = `Order #${orderId.slice(-6)} delivered to ${buyerName}.`;
          type = 'delivery';
          break;
        case 'cancelled':
          title = 'Order Cancelled';
          message = `Order #${orderId.slice(-6)} was cancelled.`;
          type = 'order';
          break;
        default:
          return;
      }

      // Create notification in sellerNotifications collection
      const notificationRef = doc(collection(db, "sellerNotifications"));
      const notificationData = {
        id: notificationRef.id,
        userId: sellerId,
        title,
        message,
        type,
        read: false,
        createdAt: Timestamp.now(),
        orderId,
        amount: totalAmount.toString(),
        itemCount,
        buyerName,
        productName: productNames
      };

      // You would typically save this to Firestore
      // For now, we'll just update local state
      setNotifications(prev => [notificationData, ...prev]);
      
    } catch (error) {
      console.error("Error creating seller notification:", error);
    }
  };

  // Filter notifications based on time
  useEffect(() => {
    let filtered = notifications;

    // Filter by time
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    switch (timeFilter) {
      case 'today':
        filtered = filtered.filter(notif => {
          const notificationDate = notif.createdAt.toDate();
          return notificationDate >= today;
        });
        break;
      case 'week':
        filtered = filtered.filter(notif => {
          const notificationDate = notif.createdAt.toDate();
          return notificationDate >= weekAgo && notificationDate < today;
        });
        break;
      case 'earlier':
        filtered = filtered.filter(notif => {
          const notificationDate = notif.createdAt.toDate();
          return notificationDate < weekAgo;
        });
        break;
      case 'all':
      default:
        // No time filtering
        break;
    }
    
    setFilteredNotifications(filtered);
  }, [notifications, timeFilter]);

  const getNotificationIcon = (type: string, message?: string) => {
    switch (type) {
      case 'order':
        if (message?.includes('cancelled')) return <AlertCircle size={20} />;
        return <Package size={20} />;
      case 'delivery':
        if (message?.includes('scheduled')) return <Truck size={20} />;
        if (message?.includes('completed')) return <UserCheck size={20} />;
        return <Truck size={20} />;
      case 'system':
        if (message?.includes('stock')) return <AlertCircle size={20} />;
        if (message?.includes('payment')) return <DollarSign size={20} />;
        return <Bell size={20} />;
      case 'follower':
        return <UserPlus size={20} />;
      case 'promotion':
        return <Users size={20} />;
      default:
        return <Bell size={20} />;
    }
  };

  const getNotificationIconClass = (type: string) => {
    switch (type) {
      case 'order':
        return `${styles.notificationIcon} ${styles.orderStatus}`;
      case 'delivery':
        return `${styles.notificationIcon} ${styles.socialUpdates}`;
      case 'system':
        return `${styles.notificationIcon} ${styles.reminders}`;
      case 'follower':
        return `${styles.notificationIcon} ${styles.promotion}`;
      case 'promotion':
        return `${styles.notificationIcon} ${styles.promotion}`;
      default:
        return `${styles.notificationIcon} ${styles.system}`;
    }
  };

  const formatTime = (timestamp: Timestamp) => {
    if (!timestamp) return 'Recently';
    
    const date = timestamp.toDate();
    const now = new Date();
    const diffInMinutes = (now.getTime() - date.getTime()) / (1000 * 60);
    const diffInHours = diffInMinutes / 60;
    
    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${Math.floor(diffInMinutes)}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      // Update in Firestore
      const notificationRef = doc(db, "sellerNotifications", notificationId);
      await updateDoc(notificationRef, { read: true });
      
      // Update local state
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId ? { ...notif, read: true } : notif
        )
      );
      
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(notif => !notif.read);
      const updatePromises = unreadNotifications.map(notif =>
        updateDoc(doc(db, "sellerNotifications", notif.id), { read: true })
      );
      
      await Promise.all(updatePromises);
      
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, read: true }))
      );
      
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const toggleDeleteMode = () => {
    setIsDeleteMode(!isDeleteMode);
    setSelectedNotifications([]);
  };

  const toggleNotificationSelection = (notificationId: string) => {
    setSelectedNotifications(prev =>
      prev.includes(notificationId)
        ? prev.filter(id => id !== notificationId)
        : [...prev, notificationId]
    );
  };

  const handleDeleteClick = () => {
    if (selectedNotifications.length > 0) {
      setIsDeleteModalOpen(true);
    }
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    
    try {
      const deletePromises = selectedNotifications.map(id =>
        deleteDoc(doc(db, "sellerNotifications", id))
      );
      await Promise.all(deletePromises);
      
      // Local state will be updated automatically via the Firestore listener
      setSelectedNotifications([]);
      setIsDeleteMode(false);
      
    } catch (error) {
      console.error("Error deleting notifications:", error);
    }
    
    setIsDeleteModalOpen(false);
    setIsDeleting(false);
  };

  const handleDeleteCancel = () => {
    setIsDeleteModalOpen(false);
  };

  if (loading) {
    return (
      <div className={styles.pageLayout}>
        <div className={styles.mainContent}>
          <div className={styles.container}>
            <div className={styles.loadingState}>
              <div className={styles.spinner}></div>
              <p>Loading notifications...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageLayout}>
      <div className={styles.mainContent}>
        <div className={styles.container}>
          {/* Action Bar with Time Filter Buttons on left and Action Buttons on right */}
          <div className={styles.actionBar}>
            <div className={styles.categoryButtons}>
              <button 
                className={`${styles.categoryButton} ${timeFilter === 'today' ? styles.active : ''}`}
                onClick={() => setTimeFilter('today')}
              >
                Today
              </button>
              <button 
                className={`${styles.categoryButton} ${timeFilter === 'week' ? styles.active : ''}`}
                onClick={() => setTimeFilter('week')}
              >
                This Week
              </button>
              <button 
                className={`${styles.categoryButton} ${timeFilter === 'earlier' ? styles.active : ''}`}
                onClick={() => setTimeFilter('earlier')}
              >
                Earlier
              </button>
              <button 
                className={`${styles.categoryButton} ${timeFilter === 'all' ? styles.active : ''}`}
                onClick={() => setTimeFilter('all')}
              >
                All
              </button>
            </div>
            <div className={styles.actionButtons}>
              <button 
                className={`${styles.deleteBtn} ${isDeleteMode ? styles.active : ''}`}
                onClick={isDeleteMode ? handleDeleteClick : toggleDeleteMode}
                disabled={isDeleteMode && selectedNotifications.length === 0}
              >
                <Trash2 size={18} />
                {isDeleteMode ? 'Delete Selected' : 'Delete'}
              </button>
              
              {isDeleteMode && (
                <button 
                  className={styles.markAllReadBtn}
                  onClick={toggleDeleteMode}
                >
                  Cancel
                </button>
              )}
              
              {!isDeleteMode && filteredNotifications.length > 0 && filteredNotifications.some(n => !n.read) && (
                <button 
                  className={styles.markAllReadBtn}
                  onClick={markAllAsRead}
                >
                  Mark all as read
                </button>
              )}
            </div>
          </div>
          
          {/* Notification Container */}
          <div className={styles.notificationContainer}>
            {filteredNotifications.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>🔔</div>
                <p>
                  {notifications.length === 0 
                    ? "No notifications yet" 
                    : `No notifications in ${timeFilter}`
                  }
                </p>
                <span>
                  {notifications.length === 0 
                    ? "Your notifications will appear here when you receive orders or new followers" 
                    : `You're all caught up for this time period`
                  }
                </span>
              </div>
            ) : (
              filteredNotifications.map((notification) => (
                <div 
                  key={notification.id}
                  className={`${styles.notificationItem} ${notification.read ? styles.read : styles.unread}`}
                  onClick={() => {
                    if (!isDeleteMode && !notification.read) {
                      markAsRead(notification.id);
                    }
                  }}
                >
                  {/* Checkbox for delete mode */}
                  {isDeleteMode && (
                    <div className={styles.notificationCheckbox}>
                      <input
                        type="checkbox"
                        checked={selectedNotifications.includes(notification.id)}
                        onChange={() => toggleNotificationSelection(notification.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}
                  
                  <div className={getNotificationIconClass(notification.type)}>
                    {getNotificationIcon(notification.type, notification.message)}
                  </div>
                  
                  <div className={styles.notificationContent}>
                    <div className={styles.notificationHeader}>
                      <h3 className={styles.notificationTitle}>{notification.title}</h3>
                      <span className={styles.notificationTime}>
                        {formatTime(notification.createdAt)}
                      </span>
                    </div>
                    
                    <p className={styles.notificationMessage}>{notification.message}</p>
                    
                    {(notification.amount || notification.followerName) && (
                      <div className={styles.orderDetails}>
                        {notification.amount && (
                          <span className={styles.totalPrice}>₱{notification.amount}</span>
                        )}
                        {notification.itemCount && (
                          <span className={styles.quantity}>{notification.itemCount} items</span>
                        )}
                        {notification.buyerName && (
                          <span className={styles.quantity}>Buyer: {notification.buyerName}</span>
                        )}
                        {notification.followerName && (
                          <span className={styles.quantity}>Follower: {notification.followerName}</span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {!notification.read && !isDeleteMode && (
                    <div className={styles.unreadIndicator}></div>
                  )}
                </div>
              ))
            )}
          </div>
          
          {/* Delete Confirmation Modal */}
          <DeleteConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={handleDeleteCancel}
            onConfirm={handleDeleteConfirm}
            selectedCount={selectedNotifications.length}
            isLoading={isDeleting}
          />
        </div>
      </div>
    </div>
  );
}