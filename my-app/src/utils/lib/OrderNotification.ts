import { doc, setDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore";
import { db, auth } from "./firebase";

export interface OrderNotificationData {
  orderId: string;
  orderNumber: string; // ✅ ADDED: F2T order number
  amount: string;
  items: any[];
  sellerId?: string;
  buyerName?: string;
  buyerId?: string; // ✅ ADDED: Buyer's user ID (for seller notifications)
}

/**
 * Creates a notification when an order is successfully placed
 */
export const createOrderNotification = async (orderData: OrderNotificationData): Promise<void> => {
  const user = auth.currentUser;
  if (!user) {
    console.error("No user logged in");
    return;
  }

  try {
    // Create a reference to a new document in the notifications collection
    const notificationRef = doc(collection(db, "notifications"));
    
    const notification = {
      id: notificationRef.id,
      userId: user.uid, // Buyer's user ID
      title: "Order Confirmed! 🎉",
      message: `Your order has been placed successfully. We'll notify you when it's ready for pickup.`,
      type: "order",
      category: "orderStatus", // ✅ ADDED for filtering
      read: false,
      createdAt: serverTimestamp(),
      orderId: orderData.orderId, // Firestore document ID
      orderNumber: orderData.orderNumber, // ✅ ADDED: F2T order number
      amount: orderData.amount,
      itemCount: orderData.items.length,
      buyerName: orderData.buyerName || user.displayName || "Customer",
      // Optional: Include seller ID if you want seller notifications too
      sellerId: orderData.sellerId || null,
      // Add timestamp for ordering
      timestamp: serverTimestamp()
    };

    await setDoc(notificationRef, notification);
    
    console.log("🎊 Order notification created successfully:", {
      notificationId: notificationRef.id,
      orderId: orderData.orderId,
      orderNumber: orderData.orderNumber, // ✅ Log the F2T number
      amount: orderData.amount,
      items: orderData.items.length,
      userId: user.uid
    });
  } catch (error) {
    console.error("❌ Error creating order notification:", error);
    throw new Error("Failed to create order notification");
  }
};

/**
 * Creates a notification for order status updates
 */
export const createOrderStatusNotification = async (
  userId: string,
  orderData: {
    orderId: string;
    orderNumber?: string; // ✅ ADDED optional parameter
    status: 'pending' | 'preparing' | 'ready' | 'shipped' | 'completed' | 'cancelled';
    message: string;
    sellerName?: string;
  }
): Promise<void> => {
  try {
    const notificationRef = doc(collection(db, "notifications"));
    
    const statusTitles = {
      pending: "⏳ Order Pending",
      preparing: "👨‍🍳 Order Being Prepared",
      ready: "✅ Order Ready for Pickup!",
      shipped: "🚚 Order Shipped",
      completed: "🎊 Order Completed",
      cancelled: "❌ Order Cancelled"
    };

    const notification = {
      id: notificationRef.id,
      userId: userId,
      title: statusTitles[orderData.status] || "Order Update",
      message: orderData.message,
      type: "order",
      category: "orderStatus", // ✅ ADDED
      read: false,
      createdAt: serverTimestamp(),
      orderId: orderData.orderId,
      orderNumber: orderData.orderNumber || null, // ✅ ADDED
      sellerName: orderData.sellerName || null,
      // Add timestamp for ordering
      timestamp: serverTimestamp()
    };

    await setDoc(notificationRef, notification);
    
    console.log(`📦 Order status notification created: ${orderData.status}`, {
      orderId: orderData.orderId,
      orderNumber: orderData.orderNumber,
      userId: userId
    });
  } catch (error) {
    console.error("❌ Error creating order status notification:", error);
    throw error;
  }
};

/**
 * Creates seller notifications for new orders
 */
export const createSellerOrderNotification = async (
  sellerId: string,
  orderData: {
    orderId: string;
    orderNumber: string;
    amount: string;
    items: any[];
    buyerName: string;
    productNames?: string;
    itemCount?: number;
  }
): Promise<void> => {
  try {
    const notificationRef = doc(collection(db, "notifications"));
    
    const notification = {
      id: notificationRef.id,
      userId: sellerId,
      title: 'New Order Received! 🎉',
      message: `${orderData.buyerName} placed an order for ${orderData.productNames || 'products'}. Total: ₱${orderData.amount}`,
      type: 'order',
      category: 'orderStatus',
      read: false,
      createdAt: serverTimestamp(),
      orderId: orderData.orderId,
      orderNumber: orderData.orderNumber, // ✅ ADDED
      amount: orderData.amount,
      itemCount: orderData.itemCount || orderData.items.length,
      buyerName: orderData.buyerName,
      productName: orderData.productNames,
      // Add timestamp for ordering
      timestamp: serverTimestamp()
    };

    await setDoc(notificationRef, notification);
    
    console.log("🛍️ Seller notification created:", {
      sellerId: sellerId,
      orderId: orderData.orderId,
      orderNumber: orderData.orderNumber
    });
  } catch (error) {
    console.error("❌ Error creating seller notification:", error);
    throw error;
  }
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  try {
    const notificationRef = doc(db, "notifications", notificationId);
    await setDoc(notificationRef, { read: true }, { merge: true });
    console.log("📖 Notification marked as read:", notificationId);
  } catch (error) {
    console.error("❌ Error marking notification as read:", error);
    throw error;
  }
};

/**
 * Mark all notifications as read for a user
 */
export const markAllNotificationsAsRead = async (userId: string): Promise<void> => {
  try {
    // Note: This requires a query and batch update
    // For simplicity, you might want to handle this in the component
    console.log("Mark all as read for user:", userId);
    // Implementation depends on your specific requirements
  } catch (error) {
    console.error("❌ Error marking all notifications as read:", error);
    throw error;
  }
};