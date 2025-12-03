"use client";
import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, orderBy, Timestamp, doc, updateDoc, deleteDoc, getDoc } from "firebase/firestore";
import { db, auth } from "@/utils/lib/firebase";
import styles from "./notification.module.css";
import NotificationSubmenu from "../../../components/buyer-submenus/NotificationSubmenu";
import { usePathname, useRouter } from "next/navigation";
import { Package, Users, Clock, Bell, ShoppingCart, Star, Calendar, AlertTriangle, Sparkles, Trash2 } from "lucide-react";
import DeleteConfirmationModal from "../../../components/auth/modals/DeleteConfirmationModal/DeleteConfirmationModal";

interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'order' | 'system' | 'promotion';
  category?: 'orderStatus' | 'socialUpdates' | 'reminders';
  read: boolean;
  createdAt: Timestamp;
  orderId?: string; // This is the Firestore document ID
  orderNumber?: string; // This should be the F2T number
  amount?: string;
  itemCount?: number;
  buyerName?: string;
  sellerName?: string;
  productId?: string;
  sellerId?: string;
}

interface OrderNumberCache {
  [orderId: string]: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'earlier' | 'all'>('all');
  const [orderNumberCache, setOrderNumberCache] = useState<OrderNumberCache>({});
  const pathname = usePathname();
  const router = useRouter();

  // Determine current category from URL
  const getCurrentCategory = () => {
    if (pathname?.includes('/orderStatus')) return 'orderStatus';
    if (pathname?.includes('/socialUpdates')) return 'socialUpdates';
    if (pathname?.includes('/reminders')) return 'reminders';
    return 'all';
  };

  const currentCategory = getCurrentCategory();

  // ✅ ADDED: Fetch order number from Firestore
  const fetchOrderNumberFromFirestore = async (orderId: string): Promise<string> => {
    if (!orderId) return '';
    
    // Check cache first
    if (orderNumberCache[orderId]) {
      return orderNumberCache[orderId];
    }
    
    try {
      const orderRef = doc(db, "orders", orderId);
      const orderDoc = await getDoc(orderRef);
      
      if (orderDoc.exists()) {
        const orderData = orderDoc.data();
        const orderNumber = orderData.orderNumber || orderId;
        
        // Update cache
        setOrderNumberCache(prev => ({
          ...prev,
          [orderId]: orderNumber
        }));
        
        return orderNumber;
      }
    } catch (error) {
      console.error(`Error fetching order ${orderId}:`, error);
    }
    
    return orderId; // Fallback to order ID
  };

  // Firebase real-time listener
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const notificationsQuery = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      notificationsQuery, 
      async (snapshot) => {
        const notificationsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Notification[];
        
        console.log("📦 Notifications loaded:", notificationsData.length);
        console.log("Sample notification:", notificationsData[0] ? {
          orderId: notificationsData[0].orderId,
          orderNumber: notificationsData[0].orderNumber,
          title: notificationsData[0].title
        } : 'No notifications');
        
        // ✅ Fetch order numbers for notifications that don't have them
        const notificationsWithOrderNumbers = await Promise.all(
          notificationsData.map(async (notification) => {
            if (notification.orderId && !notification.orderNumber && notification.category === 'orderStatus') {
              try {
                const orderNumber = await fetchOrderNumberFromFirestore(notification.orderId);
                return {
                  ...notification,
                  orderNumber: orderNumber
                };
              } catch (error) {
                console.error(`Failed to fetch order number for ${notification.orderId}:`, error);
                return notification;
              }
            }
            return notification;
          })
        );
        
        setNotifications(notificationsWithOrderNumbers);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching notifications:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Filter notifications based on category and time
  useEffect(() => {
    let filtered = notifications;
    
    // Filter by category
    switch (currentCategory) {
      case 'orderStatus':
        filtered = notifications.filter(notif => 
          notif.category === 'orderStatus' || notif.type === 'order'
        );
        break;
      case 'socialUpdates':
        filtered = notifications.filter(notif => 
          notif.category === 'socialUpdates' || 
          (notif.type === 'promotion' || notif.type === 'system')
        );
        break;
      case 'reminders':
        filtered = notifications.filter(notif => notif.category === 'reminders');
        break;
      case 'all':
      default:
        filtered = notifications;
        break;
    }

    // Then filter by time
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
  }, [notifications, currentCategory, timeFilter]);

  // ✅ UPDATED: Get order display - check multiple sources
  const getOrderDisplay = (notification: Notification): string => {
    // Priority 1: Use orderNumber from notification (already fetched from Firestore)
    if (notification.orderNumber) {
      return notification.orderNumber;
    }
    
    // Priority 2: Check cache for this orderId
    if (notification.orderId && orderNumberCache[notification.orderId]) {
      return orderNumberCache[notification.orderId];
    }
    
    // Priority 3: Use orderId as is
    if (notification.orderId) {
      return notification.orderId;
    }
    
    return '';
  };

  // ✅ UPDATED: Format the order display nicely
  const formatOrderDisplay = (orderDisplay: string): string => {
    if (!orderDisplay) return '';
    
    // If it's already an F2T number, return it as is
    if (orderDisplay.startsWith('F2T-')) {
      return orderDisplay;
    }
    
    // If it's a Firestore document ID, extract the last part
    if (orderDisplay.includes('ORD-')) {
      const parts = orderDisplay.split('-');
      if (parts.length >= 2) {
        return `ORD${parts[parts.length - 1].toUpperCase()}`;
      }
    }
    
    // Otherwise return as is
    return orderDisplay;
  };

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read first
    if (!notification.read) {
      markAsRead(notification.id);
    }

    // Handle redirects
    if (notification.category === 'orderStatus' || notification.type === 'order') {
      if (notification.orderId) {
        router.push(`/buyer/profile/my-purchases?orderId=${notification.orderId}`);
      } else {
        router.push('/buyer/profile/my-purchases');
      }
    } else if (notification.category === 'reminders') {
      if (notification.message.toLowerCase().includes('review') || 
          notification.message.toLowerCase().includes('rate')) {
        if (notification.orderId) {
          router.push(`/buyer/profile/my-purchases?orderId=${notification.orderId}&tab=to-review`);
        } else {
          router.push('/buyer/profile/my-purchases?tab=to-review');
        }
      } else {
        router.push('/buyer/profile/my-purchases');
      }
    } else if (notification.category === 'socialUpdates') {
      if (notification.message.toLowerCase().includes('new product') || 
          notification.message.toLowerCase().includes('posted')) {
        if (notification.sellerId) {
          router.push(`/buyer/marketplace?sellerId=${notification.sellerId}`);
        } else {
          router.push('/buyer/marketplace');
        }
      } else if (notification.productId) {
        router.push(`/buyer/marketplace/product/${notification.productId}`);
      } else {
        router.push('/buyer/marketplace');
      }
    } else {
      router.push('/buyer/profile/my-purchases');
    }
  };

  const getNotificationIcon = (category?: string, type?: string, message?: string) => {
    if (category === 'orderStatus') {
      return <Package size={20} />;
    }
    if (category === 'socialUpdates') {
      if (message?.includes('new') || message?.includes('posted')) return <Sparkles size={20} />;
      if (message?.includes('seasonal')) return <Calendar size={20} />;
      if (message?.includes('limited')) return <AlertTriangle size={20} />;
      return <Package size={20} />;
    }
    if (category === 'reminders') {
      if (message?.includes('review')) return <Star size={20} />;
      if (message?.includes('cart')) return <ShoppingCart size={20} />;
      if (message?.includes('subscription')) return <Calendar size={20} />;
      return <Clock size={20} />;
    }
    
    switch (type) {
      case 'order':
        return <Package size={20} />;
      case 'system':
        return <Bell size={20} />;
      case 'promotion':
        return <Users size={20} />;
      default:
        return <Bell size={20} />;
    }
  };

  const getNotificationIconClass = (category?: string, type?: string) => {
    if (category === 'orderStatus') {
      return `${styles.notificationIcon} ${styles.orderStatus}`;
    }
    if (category === 'socialUpdates') {
      return `${styles.notificationIcon} ${styles.socialUpdates}`;
    }
    if (category === 'reminders') {
      return `${styles.notificationIcon} ${styles.reminders}`;
    }
    
    switch (type) {
      case 'order':
        return `${styles.notificationIcon} ${styles.orderStatus}`;
      case 'system':
        return `${styles.notificationIcon} ${styles.system}`;
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
      const notificationRef = doc(db, "notifications", notificationId);
      await updateDoc(notificationRef, { read: true });
      
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
    const unreadNotifications = notifications.filter(notif => !notif.read);
    
    try {
      const updatePromises = unreadNotifications.map(notif =>
        updateDoc(doc(db, "notifications", notif.id), { read: true })
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
        deleteDoc(doc(db, "notifications", id))
      );
      await Promise.all(deletePromises);
      
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
        <div className={styles.submenuContainer}>
          <NotificationSubmenu />
        </div>
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
      <div className={styles.submenuContainer}>
        <NotificationSubmenu />
      </div>
      
      <div className={styles.mainContent}>
        <div className={styles.container}>
          {/* Action Bar with Category Buttons on left and Action Buttons on right */}
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
                    ? "Your notifications will appear here" 
                    : `You're all caught up for this time period`
                  }
                </span>
              </div>
            ) : (
              filteredNotifications.map((notification) => {
                const orderDisplay = getOrderDisplay(notification);
                const formattedOrderDisplay = formatOrderDisplay(orderDisplay);
                
                return (
                  <div 
                    key={notification.id}
                    className={`${styles.notificationItem} ${notification.read ? styles.read : styles.unread}`}
                    onClick={() => {
                      if (!isDeleteMode) {
                        handleNotificationClick(notification);
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
                    
                    <div className={getNotificationIconClass(notification.category, notification.type)}>
                      {getNotificationIcon(notification.category, notification.type, notification.message)}
                    </div>
                    
                    <div className={styles.notificationContent}>
                      <div className={styles.notificationHeader}>
                        <h3 className={styles.notificationTitle}>{notification.title}</h3>
                        <span className={styles.notificationTime}>
                          {formatTime(notification.createdAt)}
                        </span>
                      </div>
                      
                      <p className={styles.notificationMessage}>{notification.message}</p>
                      
                      {notification.orderId && (
                        <div className={styles.orderDetails}>
                          {/* ✅ DISPLAY F2T ORDER NUMBER */}
                          <span className={styles.orderId}>
                            Order #{formattedOrderDisplay}
                          </span>
                          {notification.amount && (
                            <span className={styles.orderAmount}>₱{notification.amount}</span>
                          )}
                          {notification.itemCount && (
                            <span className={styles.itemCount}>{notification.itemCount} item(s)</span>
                          )}
                        </div>
                      )}
                      
                      {/* Additional context for social updates */}
                      {notification.category === 'socialUpdates' && notification.sellerName && (
                        <div className={styles.sellerDetails}>
                          <span className={styles.sellerName}>From: {notification.sellerName}</span>
                        </div>
                      )}
                    </div>
                    
                    {!notification.read && !isDeleteMode && (
                      <div className={styles.unreadIndicator}></div>
                    )}
                  </div>
                );
              })
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