"use client";
import React from "react";
import styles from "./StatusBadge.module.css";

interface StatusBadgeProps {
  status: string;
}

const statusConfig = {
  pending: {
    label: "Pending",
    color: "#F59E0B",
    bgColor: "#FEF3C7",
    borderColor: "#D97706"
  },
  processing: {
    label: "Processing",
    color: "#3B82F6",
    bgColor: "#DBEAFE",
    borderColor: "#1D4ED8"
  },
  ready_for_pickup: {
    label: "Ready for Pickup",
    color: "#8B5CF6",
    bgColor: "#EDE9FE",
    borderColor: "#7C3AED"
  },
  shipped: {
    label: "Shipped",
    color: "#06B6D4",
    bgColor: "#CFFAFE",
    borderColor: "#0891B2"
  },
  completed: {
    label: "Completed",
    color: "#10B981",
    bgColor: "#D1FAE5",
    borderColor: "#047857"
  },
  canceled: {
    label: "Canceled",
    color: "#EF4444",
    bgColor: "#FEE2E2",
    borderColor: "#DC2626"
  }
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
  
  return (
    <span
      className={styles.statusBadge}
      style={{
        color: config.color,
        backgroundColor: config.bgColor,
        borderColor: config.borderColor
      }}
    >
      {config.label}
    </span>
  );
}