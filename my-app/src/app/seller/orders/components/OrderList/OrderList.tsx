"use client";
import React from "react";
import { User, Phone, Calendar } from "lucide-react";
import StatusBadge from "../StatusBadge/StatusBadge";
import styles from "./OrderList.module.css";

// Use consistent interface
interface Product {
  name: string;
  quantity: number;
  unitPrice: number;
  unit: string;
}

interface Order {
  id: string;
  orderNumber?: string; // ✅ ADDED: Order number field
  buyerName: string;
  products: Product[];
  totalPrice: number;
  orderDate: string;
  status: string;
  contact: string;
  address: string;
  deliveryMethod: string;
  specialInstructions?: string;
}

interface OrderListProps {
  orders: Order[];
  onOrderSelect: (order: Order) => void;
}

export default function OrderList({ orders, onOrderSelect }: OrderListProps) {
  // Helper function to format date from Firebase
  const formatOrderDate = (dateString: string | any) => {
    if (typeof dateString === 'string') {
      return new Date(dateString);
    }
    // If it's a Firebase Timestamp object
    if (dateString && typeof dateString.toDate === 'function') {
      return dateString.toDate();
    }
    // If it's already a Date object or fallback
    return new Date(dateString);
  };

  // Helper function to format order number
  const formatOrderNumber = (order: Order) => {
    // If orderNumber exists and already starts with F2T, use it as is
    if (order.orderNumber && order.orderNumber.startsWith('F2T-')) {
      return order.orderNumber;
    }
    
    // If orderNumber exists but doesn't start with F2T, prepend it
    if (order.orderNumber && !order.orderNumber.startsWith('F2T-')) {
      return `F2T-${order.orderNumber}`;
    }
    
    // Fallback: Use the document ID to create an F2T order number
    return `F2T-${order.id.slice(-8).toUpperCase()}`;
  };

  if (orders.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No orders found</p>
        <span>Try changing your filters or search term</span>
      </div>
    );
  }

  return (
    <div className={styles.orderGrid}>
      {orders.map(order => (
        <div
          key={order.id}
          className={styles.orderCard}
          onClick={() => onOrderSelect(order)}
        >
          {/* Order Header with Status on Right */}
          <div className={styles.orderHeader}>
            <div className={styles.orderInfo}>
              {/* ✅ UPDATED: Use formatted order number instead of document ID */}
              <h3 className={styles.orderId}>Order #{formatOrderNumber(order)}</h3>
              <div className={styles.buyerContact}>
                <div className={styles.contactItem}>
                  <User size={14} />
                  <span>{order.buyerName}</span>
                </div>
                <div className={styles.contactItem}>
                  <Phone size={14} />
                  <span>{order.contact}</span>
                </div>
              </div>
            </div>
            <StatusBadge status={order.status} />
          </div>

          {/* Order Items Table with Scroll */}
          <div className={styles.tableContainer}>
            <div className={styles.orderTable}>
              <div className={styles.tableHeader}>
                <span>Product</span>
                <span>Qty</span>
                <span>Price</span>
                <span>Total</span>
              </div>
              <div className={styles.tableBody}>
                {order.products.map((product, index) => (
                  <div key={index} className={styles.tableRow}>
                    <span className={styles.productName}>{product.name}</span>
                    <span>{product.quantity} {product.unit}</span>
                    <span>₱{product.unitPrice}</span>
                    <span className={styles.rowTotal}>
                      ₱{product.quantity * product.unitPrice}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Order Footer - View Details on left, Date and Total on right */}
          <div className={styles.orderFooter}>
            {/* View Details Button on Left Side */}
            <div className={styles.actionContainer}>
              <button className={styles.viewDetailsBtn}>
                View Details
              </button>
            </div>
            
            {/* Date and Total on Right Side */}
            <div className={styles.dateTotalContainer}>
              <div className={styles.dateBox}>
                <Calendar size={14} />
                <span>{formatOrderDate(order.orderDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}</span>
              </div>
              <div className={styles.totalSection}>
                <span className={styles.totalLabel}>Total Amount:</span>
                <span className={styles.totalPrice}>₱{order.totalPrice}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}