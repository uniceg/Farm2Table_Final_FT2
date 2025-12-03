"use client";
import React, { useRef } from "react";
import { X, Receipt, Download } from "lucide-react"; // Removed Printer import
import styles from "./GenerateReceiptModal.module.css";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface Product {
  name: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  notes?: string;
}

interface GenerateReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: {
    id: string;
    orderNumber?: string;
    orderDate: string;
    status: string;
    totalPrice: number;
  };
  sellerName: string;
  sellerContact?: string;
  sellerAddress?: string;
  buyerInfo: {
    name: string;
    contact: string;
    address: string;
    email?: string;
  };
  deliveryMethod: string;
  products: Product[];
  specialInstructions: string;
  
  // Add new props
  paymentInfo?: {
    method: string;
    status: string;
    transactionId?: string;
  };
  deliveryInfo?: {
    method?: string;
    time: string;
    estimatedDelivery?: string;
    trackingNumber?: string;
    courier?: string;
  };
}

export default function GenerateReceiptModal({
  isOpen,
  onClose,
  order,
  sellerName,
  sellerContact = "Not provided",
  sellerAddress = "Not provided",
  buyerInfo,
  deliveryMethod,
  products,
  specialInstructions,
  paymentInfo,
  deliveryInfo
}: GenerateReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  // Format order number
  const formatOrderNumber = () => {
    if (order.orderNumber && order.orderNumber.startsWith("F2T-")) {
      return order.orderNumber;
    }
    if (order.orderNumber && !order.orderNumber.startsWith("F2T-")) {
      return `F2T-${order.orderNumber}`;
    }
    return `F2T-${order.id.slice(-8).toUpperCase()}`;
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Generate professional PDF
  const generatePDF = async () => {
    if (!receiptRef.current) return;

    try {
      // Create canvas from receipt content
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgWidth = 190;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      const pageHeight = pdf.internal.pageSize.getHeight();
      let heightLeft = imgHeight;
      let position = 10;

      // Add image to PDF
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add additional pages if needed
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Save PDF
      const fileName = `Waybill_${formatOrderNumber()}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

    } catch (error) {
      console.error('Error generating PDF:', error);
      // Fallback to text download if PDF generation fails
      downloadAsText();
    }
  };

  // Fallback text download
  const downloadAsText = () => {
    const receiptContent = `
FARM TO TABLE - OFFICIAL WAYBILL
=================================

WAYBILL INFORMATION:
--------------------
Waybill Number: ${formatOrderNumber()}
Order Date: ${formatDate(order.orderDate)}
Generated: ${new Date().toLocaleString()}

SELLER INFORMATION:
------------------
Business Name: ${sellerName}
Contact: ${sellerContact}
Address: ${sellerAddress}

BUYER INFORMATION:
-----------------
Name: ${buyerInfo.name}
Contact: ${buyerInfo.contact}
Address: ${buyerInfo.address}
${buyerInfo.email ? `Email: ${buyerInfo.email}` : ''}

DELIVERY & PAYMENT INFORMATION:
------------------------------
Delivery Method: ${deliveryInfo?.method || deliveryMethod}
Courier: ${deliveryInfo?.courier || 'Standard Delivery'}
Delivery Time: ${deliveryInfo?.time || 'Within 3-5 business days'}
${deliveryInfo?.estimatedDelivery ? `Estimated Delivery: ${new Date(deliveryInfo.estimatedDelivery).toLocaleDateString()}` : ''}
${deliveryInfo?.trackingNumber ? `Tracking Number: ${deliveryInfo.trackingNumber}` : ''}
Payment Method: ${paymentInfo?.method || 'Cash on Delivery'}
Payment Status: ${paymentInfo?.status || 'Pending'}
${paymentInfo?.transactionId ? `Transaction ID: ${paymentInfo.transactionId}` : ''}

ORDER ITEMS:
-----------
${products.map((product, index) => 
  `${index + 1}. ${product.name}
   Quantity: ${product.quantity} ${product.unit}
   Unit Price: ₱${product.unitPrice.toFixed(2)}
   Subtotal: ₱${(product.quantity * product.unitPrice).toFixed(2)}`
).join('\n\n')}

TOTAL AMOUNT: ₱${order.totalPrice.toFixed(2)}

${specialInstructions && specialInstructions !== 'No special instructions provided' ? 
  `SPECIAL INSTRUCTIONS:
  ${specialInstructions}` : ''
}

--- END OF WAYBILL ---
    `.trim();

    const blob = new Blob([receiptContent], { type: 'text/plain' });
    const element = document.createElement('a');
    element.href = URL.createObjectURL(blob);
    element.download = `Waybill_${formatOrderNumber()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (!isOpen) return null;

  return (
    <div className={styles.receiptOverlay}>
      <div className={styles.receiptModal}>
        <div className={styles.receiptHeader}>
          <div className={styles.headerContent}>
            <Receipt size={24} />
            <div>
              <h2>Delivery Waybill</h2>
              <p className={styles.orderNumber}>Order: {formatOrderNumber()}</p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <div className={styles.receiptContent} ref={receiptRef}>
          {/* Waybill Content - This will be captured for PDF */}
          <div className={styles.waybillContainer}>
            {/* Header */}
            <div className={styles.waybillHeader}>
              <div className={styles.companyInfo}>
                <h1 className={styles.companyName}>FARM TO TABLE</h1>
                <p className={styles.companyTagline}>Fresh Produce Delivery Service</p>
              </div>
              <div className={styles.waybillTitle}>
                <h2>DELIVERY WAYBILL</h2>
                <div className={styles.waybillMeta}>
                  <div className={styles.metaItem}>
                    <span>Waybill No:</span>
                    <strong>{formatOrderNumber()}</strong>
                  </div>
                  <div className={styles.metaItem}>
                    <span>Date:</span>
                    <strong>{formatDate(order.orderDate)}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Sender & Receiver Info */}
            <div className={styles.partiesGrid}>
              {/* Sender Column */}
              <div className={styles.partyColumn}>
                <div className={styles.partyHeader}>
                  <div className={styles.partyIcon}>🚚</div>
                  <h3>SENDER</h3>
                </div>
                <div className={styles.partyDetails}>
                  <div className={styles.detailRow}>
                    <span>Business:</span>
                    <strong>{sellerName}</strong>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Contact:</span>
                    <strong>{sellerContact}</strong>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Address:</span>
                    <strong>{sellerAddress}</strong>
                  </div>
                </div>
              </div>

              {/* Receiver Column */}
              <div className={styles.partyColumn}>
                <div className={styles.partyHeader}>
                  <div className={styles.partyIcon}>🏠</div>
                  <h3>RECEIVER</h3>
                </div>
                <div className={styles.partyDetails}>
                  <div className={styles.detailRow}>
                    <span>Name:</span>
                    <strong>{buyerInfo.name}</strong>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Contact:</span>
                    <strong>{buyerInfo.contact}</strong>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Address:</span>
                    <strong>{buyerInfo.address}</strong>
                  </div>
                  {buyerInfo.email && (
                    <div className={styles.detailRow}>
                      <span>Email:</span>
                      <strong>{buyerInfo.email}</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Delivery & Payment Info */}
            <div className={styles.infoGrid}>
              <div className={styles.infoColumn}>
                <h4>DELIVERY INFORMATION</h4>
                <div className={styles.infoDetails}>
                  <div className={styles.infoRow}>
                    <span>Method:</span>
                    <strong>{deliveryInfo?.method || deliveryMethod}</strong>
                  </div>
                  <div className={styles.infoRow}>
                    <span>Courier:</span>
                    <strong>{deliveryInfo?.courier || 'Farm to Table Logistics'}</strong>
                  </div>
                  <div className={styles.infoRow}>
                    <span>Timeframe:</span>
                    <strong>{deliveryInfo?.time || 'Within 3-5 business days'}</strong>
                  </div>
                  {deliveryInfo?.estimatedDelivery && (
                    <div className={styles.infoRow}>
                      <span>Est. Delivery:</span>
                      <strong>{new Date(deliveryInfo.estimatedDelivery).toLocaleDateString()}</strong>
                    </div>
                  )}
                  {deliveryInfo?.trackingNumber && (
                    <div className={styles.infoRow}>
                      <span>Tracking No:</span>
                      <strong className={styles.trackingNumber}>{deliveryInfo.trackingNumber}</strong>
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.infoColumn}>
                <h4>PAYMENT INFORMATION</h4>
                <div className={styles.infoDetails}>
                  <div className={styles.infoRow}>
                    <span>Method:</span>
                    <strong>{paymentInfo?.method || 'Cash on Delivery'}</strong>
                  </div>
                  <div className={styles.infoRow}>
                    <span>Status:</span>
                    <strong className={`
                      ${styles.statusBadge} 
                      ${paymentInfo?.status === 'paid' ? styles.paid : ''}
                      ${paymentInfo?.status === 'pending' ? styles.pending : ''}
                    `}>
                      {paymentInfo?.status?.toUpperCase() || 'PENDING'}
                    </strong>
                  </div>
                  {paymentInfo?.transactionId && (
                    <div className={styles.infoRow}>
                      <span>Transaction ID:</span>
                      <strong className={styles.transactionId}>{paymentInfo.transactionId}</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Order Items Table */}
            <div className={styles.itemsSection}>
              <h4>ORDER ITEMS</h4>
              <table className={styles.itemsTable}>
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Item Description</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product, index) => (
                    <tr key={index}>
                      <td className={styles.numberCell}>{index + 1}</td>
                      <td className={styles.descriptionCell}>{product.name}</td>
                      <td className={styles.quantityCell}>{product.quantity} {product.unit}</td>
                      <td className={styles.priceCell}>₱{product.unitPrice.toFixed(2)}</td>
                      <td className={styles.amountCell}>₱{(product.quantity * product.unitPrice).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className={styles.totalRow}>
                    <td colSpan={4} className={styles.totalLabel}>TOTAL AMOUNT</td>
                    <td className={styles.totalAmount}>₱{order.totalPrice.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Special Instructions */}
            {specialInstructions && specialInstructions !== 'No special instructions provided' && (
              <div className={styles.instructionsSection}>
                <h4>SPECIAL INSTRUCTIONS</h4>
                <div className={styles.instructionsBox}>
                  <p>{specialInstructions}</p>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className={styles.waybillFooter}>
              {/* Terms & Conditions */}
              <div className={styles.termsSection}>
                <h5>TERMS & CONDITIONS:</h5>
                <ul className={styles.termsList}>
                  <li>Goods sold are non-returnable unless defective</li>
                  <li>Please inspect items upon delivery</li>
                  <li>Report discrepancies within 24 hours</li>
                  <li>Payment must be settled upon delivery</li>
                  <li>Keep this waybill for reference</li>
                </ul>
              </div>

              {/* Signatures */}
              <div className={styles.signaturesSection}>
                <div className={styles.signatureBox}>
                  <div className={styles.signatureLine}></div>
                  <p>Sender's Signature</p>
                </div>
                <div className={styles.signatureBox}>
                  <div className={styles.signatureLine}></div>
                  <p>Receiver's Signature</p>
                </div>
                <div className={styles.signatureBox}>
                  <div className={styles.signatureLine}></div>
                  <p>Date Received</p>
                </div>
              </div>

              {/* Footer Note */}
              <div className={styles.footerNote}>
                <p>This is an official delivery waybill. Please keep for your records.</p>
                <p className={styles.printNote}>Generated on: {new Date().toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button - Only Download PDF */}
        <div className={styles.actionButtons}>
          <button onClick={generatePDF} className={styles.downloadBtn}>
            <Download size={18} />
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}