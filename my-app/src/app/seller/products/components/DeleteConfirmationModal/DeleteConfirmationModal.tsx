"use client";
import React from "react";
import { Trash2, X, AlertTriangle } from "lucide-react";
import styles from "./DeleteConfirmationModal.module.css";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  productName: string;
  isLoading?: boolean;
}

export default function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  productName,
  isLoading = false
}: DeleteConfirmationModalProps) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        {/* Warning Icon */}
        <div className={styles.iconContainer}>
          <AlertTriangle size={48} className={styles.warningIcon} />
        </div>

        {/* Header */}
        <div className={styles.modalHeader}>
          <h2 className={styles.title}>Delete Product</h2>
          <p className={styles.subtitle}>
            Are you sure you want to delete <strong>"{productName}"</strong>? This action cannot be undone.
          </p>
        </div>

        {/* Action Buttons */}
        <div className={styles.modalActions}>
          <button
            className={styles.cancelButton}
            onClick={onClose}
            disabled={isLoading}
          >
            <X size={18} />
            Cancel
          </button>
          <button
            className={styles.deleteButton}
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className={styles.spinner}></div>
                Deleting...
              </>
            ) : (
              <>
                <Trash2 size={18} />
                Delete
              </>
            )}
          </button>
        </div>

        {/* Close Button */}
        <button 
          className={styles.closeButton}
          onClick={onClose}
          disabled={isLoading}
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
}