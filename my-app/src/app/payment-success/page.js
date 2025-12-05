"use client";
import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../utils/lib/firebase';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('loading');
  const [orderId, setOrderId] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [paymentId, setPaymentId] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    console.log('=== PAYMENT SUCCESS PAGE LOADED ===');
    
    // ✅✅✅ FORCE CHECK FOR LOCALHOST - AUTO REDIRECT ✅✅✅
    if (typeof window !== 'undefined') {
      const currentUrl = window.location.href;
      const isLocalhost = currentUrl.includes('localhost') || 
                         currentUrl.includes('127.0.0.1') || 
                         currentUrl.includes('://localhost');
      
      if (isLocalhost) {
        console.log('🚨 LOCALHOST DETECTED! Redirecting to Vercel...');
        
        // Get payment ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const paymentIntentId = urlParams.get('payment_intent_id') || 
                               urlParams.get('pi') ||
                               urlParams.get('payment_id');
        
        if (paymentIntentId) {
          const vercelUrl = `https://farm2-table-final-ft-2.vercel.app/payment-success?payment_intent_id=${paymentIntentId}&redirected=1`;
          console.log('🔀 Redirecting to:', vercelUrl);
          window.location.href = vercelUrl;
          return; // Stop execution
        }
      }
    }

    // Get payment intent ID from URL
    const paymentIntentId = searchParams.get('payment_intent_id') || 
                           searchParams.get('pi') ||
                           searchParams.get('payment_id') ||
                           searchParams.get('payment_intent');
    
    console.log('Payment ID from URL:', paymentIntentId);
    console.log('All URL params:', Array.from(searchParams.entries()));
    
    if (!paymentIntentId) {
      console.error('❌ NO PAYMENT ID IN URL');
      setMessage('No payment information found. Please check your payment confirmation.');
      setStatus('error');
      return;
    }
    
    setPaymentId(paymentIntentId);
    saveOrderToFirebase(paymentIntentId);
    
  }, [searchParams]);

  const verifyPaymentWithPayMongo = async (paymentIntentId) => {
    try {
      console.log('🔍 Verifying payment:', paymentIntentId);
      
      const response = await fetch('/api/verify-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paymentIntentId })
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.warn('Verification API error:', data);
        return null;
      }

      console.log('✅ Verification response:', data);
      return data;
      
    } catch (error) {
      console.warn('Verification request failed:', error);
      return null;
    }
  };

  const generateOrderNumber = () => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `F2T-${timestamp}-${random}`;
  };

  const saveOrderToFirebase = async (paymentIntentId) => {
    try {
      console.log('💾 SAVING ORDER TO FIREBASE...');
      
      // Step 1: Verify payment with Paymongo
      let paymentDetails = null;
      let metadataOrderData = null;
      
      try {
        paymentDetails = await verifyPaymentWithPayMongo(paymentIntentId);
        
        if (paymentDetails?.verified) {
          setPaymentVerified(true);
          console.log('✅ Payment verified by Paymongo');
          
          // Try to get order data from metadata
          if (paymentDetails.metadata?.order_data) {
            try {
              metadataOrderData = JSON.parse(paymentDetails.metadata.order_data);
              console.log('✅ Found order data in payment metadata');
            } catch (e) {
              console.log('Could not parse metadata order_data');
            }
          }
        } else {
          console.log('⚠️ Payment not verified by Paymongo, but proceeding...');
        }
      } catch (verifyError) {
        console.log('Verification failed, continuing:', verifyError);
      }

      // Step 2: Try to get order data from browser storage
      let storageOrderData = null;
      let cartItems = [];
      
      // Try sessionStorage first
      const sessionOrder = sessionStorage.getItem('pendingOrder');
      const sessionCart = sessionStorage.getItem('cartItems');
      
      // Try localStorage second
      const localOrder = localStorage.getItem('pendingOrder');
      const localCart = localStorage.getItem('cartItems');
      
      if (sessionOrder) {
        try {
          storageOrderData = JSON.parse(sessionOrder);
          cartItems = sessionCart ? JSON.parse(sessionCart) : [];
          console.log('✅ Found order in sessionStorage');
        } catch (e) {
          console.error('Failed to parse sessionStorage data');
        }
      } else if (localOrder) {
        try {
          storageOrderData = JSON.parse(localOrder);
          cartItems = localCart ? JSON.parse(localCart) : [];
          console.log('✅ Found order in localStorage');
        } catch (e) {
          console.error('Failed to parse localStorage data');
        }
      }
      
      // Step 3: Determine final order data
      let finalOrderData = metadataOrderData || storageOrderData;
      
      if (!finalOrderData) {
        console.error('❌ NO ORDER DATA FOUND ANYWHERE');
        setMessage('Payment successful but order details missing. Please contact support with your Payment ID.');
        setStatus('partial_success');
        return;
      }
      
      // Step 4: Generate order number
      const finalOrderNumber = paymentDetails?.orderNumber || 
                              paymentDetails?.metadata?.order_number ||
                              finalOrderData.orderNumber ||
                              generateOrderNumber();
      
      setOrderNumber(finalOrderNumber);
      console.log('📝 Order Number:', finalOrderNumber);

      // Step 5: Prepare complete order document
      const completeOrderData = {
        // Base order data
        ...finalOrderData,
        // Items
        items: cartItems.length > 0 ? cartItems : finalOrderData.items || [],
        // Payment info
        paymentStatus: 'paid',
        paymentIntentId: paymentIntentId,
        paymentMethod: paymentDetails?.paymentMethod || 'digital_payment',
        paymentAmount: paymentDetails?.amount ? paymentDetails.amount / 100 : finalOrderData.totalAmount || 0,
        // Order info
        status: 'confirmed',
        orderNumber: finalOrderNumber,
        // Timestamps
        paidAt: serverTimestamp(),
        confirmedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        // Verification info
        paymentVerified: !!paymentDetails?.verified,
        paymentVerificationData: paymentDetails,
        // Buyer info
        buyerInfo: finalOrderData.buyerInfo || {
          name: 'Customer',
          email: 'customer@example.com'
        },
        // Shipping
        shippingAddress: finalOrderData.shippingAddress || finalOrderData.address || {},
        // System info
        isTestOrder: !paymentDetails?.livemode,
        environment: 'production',
        source: 'vercel_payment_success'
      };

      // Step 6: Save to Firebase
      const finalOrderId = finalOrderNumber;
      setOrderId(finalOrderId);
      
      console.log('🔥 Saving to Firebase:', {
        orderId: finalOrderId,
        orderNumber: finalOrderNumber,
        itemsCount: completeOrderData.items.length
      });
      
      const orderRef = doc(db, 'orders', finalOrderId);
      await setDoc(orderRef, completeOrderData);
      
      console.log('✅ ORDER SAVED TO FIREBASE SUCCESSFULLY!');

      // Step 7: Clear storage
      localStorage.removeItem('pendingOrder');
      localStorage.removeItem('cartItems');
      localStorage.removeItem('orderNumber');
      sessionStorage.removeItem('pendingOrder');
      sessionStorage.removeItem('cartItems');
      sessionStorage.removeItem('orderNumber');
      
      // Step 8: Update UI
      setStatus('success');
      setMessage('Order confirmed and saved successfully!');

    } catch (error) {
      console.error('❌ FIREBASE SAVE ERROR:', error);
      setMessage('Error saving order: ' + error.message);
      setStatus('error');
    }
  };

  // ========== RENDER FUNCTIONS ==========

  if (status === 'loading') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h2 style={styles.title}>Processing Payment...</h2>
          <p style={styles.text}>Please wait while we confirm your payment and save your order.</p>
          <div style={styles.spinner}></div>
          {paymentId && (
            <div style={styles.paymentIdBox}>
              <small>Payment ID: {paymentId}</small>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (status === 'partial_success') {
    return (
      <div style={styles.container}>
        <div style={{...styles.card, borderColor: '#fbbf24'}}>
          <div style={styles.icon}>⚠️</div>
          <h2 style={styles.title}>Payment Successful!</h2>
          <p style={styles.text}>Your payment was processed, but we need more information.</p>
          
          {paymentId && (
            <div style={styles.infoBox}>
              <div style={styles.infoItem}>
                <strong>Payment ID:</strong>
                <code style={styles.code}>{paymentId}</code>
              </div>
              <div style={styles.warningBox}>
                ⚠️ Please save this Payment ID and contact support
              </div>
            </div>
          )}

          <p style={styles.text}>{message}</p>
          
          <div style={styles.buttonGroup}>
            <Link href="/" style={styles.primaryButton}>
              Return Home
            </Link>
            <a href="mailto:support@farm2table.com" style={styles.secondaryButton}>
              Contact Support
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={styles.container}>
        <div style={{...styles.card, borderColor: '#ef4444'}}>
          <div style={styles.icon}>❌</div>
          <h2 style={styles.title}>Processing Issue</h2>
          <p style={styles.text}>{message || 'There was an issue processing your order.'}</p>
          
          {paymentId && (
            <div style={styles.infoBox}>
              <div style={styles.infoItem}>
                <strong>Payment ID:</strong>
                <code style={styles.code}>{paymentId}</code>
              </div>
              <p style={{...styles.text, fontSize: '14px', marginTop: '10px'}}>
                Please contact support with this ID.
              </p>
            </div>
          )}
          
          <div style={styles.buttonGroup}>
            <Link href="/" style={styles.primaryButton}>
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // SUCCESS STATE
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.icon}>🎉</div>
        <h2 style={styles.title}>Payment Successful!</h2>
        <p style={styles.text}>Your order has been confirmed and saved.</p>
        
        <div style={styles.orderBox}>
          {orderNumber && orderNumber.startsWith('F2T') ? (
            <>
              <div style={styles.orderNumberSection}>
                <div style={styles.orderLabel}>✅ F2T ORDER NUMBER</div>
                <div style={styles.orderNumber}>{orderNumber}</div>
                <div style={styles.badge}>✓ Official Order</div>
              </div>
            </>
          ) : (
            <div style={styles.orderNumberSection}>
              <div style={{...styles.orderLabel, color: '#dc2626'}}>⚠️ TEMPORARY ORDER ID</div>
              <div style={{...styles.orderNumber, color: '#7c2d12', fontSize: '18px'}}>{orderId}</div>
            </div>
          )}
          
          <div style={styles.paymentDetails}>
            <div style={styles.detailRow}>
              <strong>Payment ID:</strong>
              <code style={{...styles.code, marginLeft: '10px'}}>{paymentId}</code>
            </div>
            <div style={styles.detailRow}>
              <strong>Status:</strong>
              <span style={{
                ...styles.statusBadge,
                backgroundColor: paymentVerified ? '#dcfce7' : '#fef3c7',
                color: paymentVerified ? '#059669' : '#d97706'
              }}>
                {paymentVerified ? '✓ Verified' : '✓ Paid'}
              </span>
            </div>
          </div>
          
          {orderNumber && !orderNumber.startsWith('F2T') && (
            <div style={styles.noteBox}>
              ℹ️ Using temporary ID. Track in your purchases section.
            </div>
          )}
        </div>

        <div style={styles.buttonGroup}>
          <Link href="/buyer/profile/my-purchases" style={styles.primaryButton}>
            View My Orders
          </Link>
          <Link href="/buyer/marketplace" style={styles.secondaryButton}>
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}

// Styles
const styles = {
  container: {
    padding: '40px 20px',
    textAlign: 'center',
    maxWidth: '600px',
    margin: '0 auto',
    minHeight: '70vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  card: {
    width: '100%',
    background: 'white',
    padding: '40px',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
    border: '2px solid #10b981'
  },
  icon: {
    fontSize: '48px',
    marginBottom: '20px'
  },
  title: {
    color: '#1f2937',
    marginBottom: '10px',
    fontSize: '28px'
  },
  text: {
    color: '#6b7280',
    marginBottom: '30px',
    fontSize: '16px',
    lineHeight: '1.5'
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #10b981',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '20px auto'
  },
  paymentIdBox: {
    marginTop: '20px',
    padding: '10px',
    background: '#f8f9fa',
    borderRadius: '6px',
    fontFamily: 'monospace',
    fontSize: '12px',
    wordBreak: 'break-all'
  },
  infoBox: {
    background: '#f0fdf4',
    padding: '20px',
    borderRadius: '8px',
    margin: '20px auto',
    border: '1px solid #bbf7d0',
    textAlign: 'left'
  },
  infoItem: {
    margin: '10px 0'
  },
  code: {
    display: 'block',
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#6b7280',
    wordBreak: 'break-all',
    background: '#f8f9fa',
    padding: '8px',
    borderRadius: '4px',
    marginTop: '5px'
  },
  warningBox: {
    color: '#92400e',
    fontSize: '12px',
    marginTop: '10px',
    padding: '8px',
    background: '#fef3c7',
    borderRadius: '4px',
    border: '1px solid #fbbf24'
  },
  orderBox: {
    background: '#f0fdf4',
    padding: '20px',
    borderRadius: '8px',
    margin: '20px auto',
    border: '1px solid #bbf7d0'
  },
  orderNumberSection: {
    marginBottom: '20px'
  },
  orderLabel: {
    fontSize: '12px',
    color: '#059669',
    fontWeight: '600',
    marginBottom: '5px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  orderNumber: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#065f46',
    margin: '10px 0'
  },
  badge: {
    display: 'inline-block',
    fontSize: '12px',
    color: '#059669',
    background: '#dcfce7',
    padding: '4px 12px',
    borderRadius: '20px',
    marginTop: '5px'
  },
  paymentDetails: {
    borderTop: '1px solid #bbf7d0',
    marginTop: '20px',
    paddingTop: '20px'
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    margin: '12px 0',
    flexWrap: 'wrap'
  },
  statusBadge: {
    display: 'inline-block',
    fontSize: '12px',
    padding: '4px 12px',
    borderRadius: '20px',
    marginLeft: '10px'
  },
  noteBox: {
    marginTop: '15px',
    padding: '12px',
    background: '#fef3c7',
    border: '1px solid #fbbf24',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#92400e'
  },
  buttonGroup: {
    display: 'flex',
    gap: '15px',
    justifyContent: 'center',
    marginTop: '30px',
    flexWrap: 'wrap'
  },
  primaryButton: {
    display: 'inline-block',
    padding: '14px 28px',
    borderRadius: '8px',
    textDecoration: 'none',
    fontWeight: '500',
    fontSize: '14px',
    background: '#10b981',
    color: 'white',
    border: '2px solid #10b981',
    transition: 'all 0.3s ease',
    cursor: 'pointer'
  },
  secondaryButton: {
    display: 'inline-block',
    padding: '14px 28px',
    borderRadius: '8px',
    textDecoration: 'none',
    fontWeight: '500',
    fontSize: '14px',
    background: 'white',
    color: '#10b981',
    border: '2px solid #10b981',
    transition: 'all 0.3s ease',
    cursor: 'pointer'
  }
};

// Add CSS for spinner animation
const spinnerStyle = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

export default function PaymentSuccess() {
  return (
    <>
      <style>{spinnerStyle}</style>
      <Suspense fallback={
        <div style={styles.container}>
          <div style={styles.card}>
            <h2 style={styles.title}>Loading...</h2>
            <p style={styles.text}>Preparing payment information...</p>
          </div>
        </div>
      }>
        <PaymentSuccessContent />
      </Suspense>
    </>
  );
}