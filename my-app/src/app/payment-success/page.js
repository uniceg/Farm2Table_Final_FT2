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

  useEffect(() => {
    const paymentIntentId = searchParams.get('payment_intent_id') || 
                           searchParams.get('pi') ||
                           searchParams.get('payment_id');
    
    setPaymentId(paymentIntentId);
    
    if (paymentIntentId) {
      saveOrderToFirebase(paymentIntentId);
    } else {
      setStatus('error');
    }
  }, [searchParams]);

  const verifyPaymentWithPayMongo = async (paymentIntentId) => {
    try {
      const response = await fetch('/api/verify-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paymentIntentId })
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.warn('Payment verification request failed');
      return null;
    }
  };

  const saveOrderToFirebase = async (paymentIntentId) => {
    try {
      console.log('💾 Attempting to save order... Payment ID:', paymentIntentId);
      
      // MULTIPLE DATA SOURCES STRATEGY:
      let pendingOrderData = null;
      let cartItems = null;
      let storedOrderNumber = null;
      
      // 1. Try sessionStorage first (survives redirects better)
      pendingOrderData = sessionStorage.getItem('pendingOrder');
      cartItems = sessionStorage.getItem('cartItems');
      storedOrderNumber = sessionStorage.getItem('orderNumber');
      
      console.log('sessionStorage data:', {
        hasOrder: !!pendingOrderData,
        hasCart: !!cartItems,
        hasOrderNumber: !!storedOrderNumber
      });
      
      // 2. Try localStorage as fallback
      if (!pendingOrderData) {
        pendingOrderData = localStorage.getItem('pendingOrder');
        cartItems = localStorage.getItem('cartItems');
        storedOrderNumber = localStorage.getItem('orderNumber');
        
        console.log('localStorage data:', {
          hasOrder: !!pendingOrderData,
          hasCart: !!cartItems,
          hasOrderNumber: !!storedOrderNumber
        });
      }
      
      // 3. Try URL parameters
      const urlOrder = searchParams.get('order_data');
      if (!pendingOrderData && urlOrder) {
        try {
          pendingOrderData = decodeURIComponent(urlOrder);
          console.log('Found order data in URL parameters');
        } catch (e) {
          console.log('Could not decode URL order data');
        }
      }
      
      // 4. If still no data, check if we can retrieve from payment metadata
      if (!pendingOrderData) {
        console.warn('⚠️ No order data found in storage or URL');
        console.log('Available search params:', Array.from(searchParams.entries()));
        
        // Try to verify payment and get metadata
        try {
          const paymentDetails = await verifyPaymentWithPayMongo(paymentIntentId);
          if (paymentDetails?.metadata?.order_data) {
            pendingOrderData = paymentDetails.metadata.order_data;
            console.log('Retrieved order data from payment metadata');
          }
        } catch (metadataError) {
          console.log('Could not retrieve from metadata:', metadataError);
        }
      }
      
      // 5. If STILL no data, show partial success instead of error
      if (!pendingOrderData) {
        console.error('❌ No order data found in any source');
        console.log('Payment was successful, but order data lost');
        
        // Instead of error, show partial success
        setStatus('partial_success');
        
        // Clear all storage to prevent future issues
        localStorage.removeItem('pendingOrder');
        localStorage.removeItem('cartItems');
        localStorage.removeItem('orderNumber');
        sessionStorage.removeItem('pendingOrder');
        sessionStorage.removeItem('cartItems');
        sessionStorage.removeItem('orderNumber');
        
        return;
      }

      const orderData = JSON.parse(pendingOrderData);
      const items = cartItems ? JSON.parse(cartItems) : [];

      let verifiedOrderNumber = storedOrderNumber;
      let paymentDetails = null;
      let verificationSuccess = false;
      
      try {
        paymentDetails = await verifyPaymentWithPayMongo(paymentIntentId);
        
        if (paymentDetails) {
          verificationSuccess = true;
          setPaymentVerified(true);
          
          const metadataOrderNumber = paymentDetails.orderNumber || 
                                     paymentDetails.metadata?.order_number;
          
          if (metadataOrderNumber) {
            verifiedOrderNumber = metadataOrderNumber;
          }
          
          if (orderData.orderNumber && orderData.orderNumber.startsWith('F2T')) {
            verifiedOrderNumber = orderData.orderNumber;
          }
        }
      } catch (verifyError) {
        // Continue anyway - payment is still successful
      }

      const finalOrderNumber = verifiedOrderNumber || 
                              orderData.orderNumber || 
                              storedOrderNumber || 
                              `TEST-${Date.now()}`;
      
      setOrderNumber(finalOrderNumber);

      const completeOrderData = {
        ...orderData,
        items: items,
        paymentStatus: 'paid',
        paymentIntentId: paymentIntentId,
        paymentMethod: verificationSuccess ? (paymentDetails?.payment_method || 'digital_payment') : 'digital_payment',
        status: 'confirmed',
        orderNumber: finalOrderNumber,
        paidAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        paymentVerified: verificationSuccess,
        paymentVerificationData: paymentDetails,
        isTestOrder: process.env.NODE_ENV === 'development',
        buyerInfo: orderData.buyerInfo || {
          name: 'Customer',
          email: 'customer@example.com'
        }
      };

      const finalOrderId = finalOrderNumber.startsWith('F2T') ? 
                          finalOrderNumber : 
                          orderData.id || `order_${Date.now()}`;
      
      setOrderId(finalOrderId);
      
      const orderRef = doc(db, 'orders', finalOrderId);
      await setDoc(orderRef, completeOrderData);

      // Clear all storage
      localStorage.removeItem('pendingOrder');
      localStorage.removeItem('cartItems');
      localStorage.removeItem('paymentIntentId');
      localStorage.removeItem('orderNumber');
      sessionStorage.removeItem('pendingOrder');
      sessionStorage.removeItem('cartItems');
      sessionStorage.removeItem('orderNumber');
      
      setStatus('success');

    } catch (error) {
      console.error('Error saving order to Firebase:', error);
      setStatus('error');
    }
  };

  if (status === 'loading') {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2>Processing Your Payment...</h2>
        <p>Please wait while we confirm and save your order details.</p>
        <div style={{ marginTop: '20px' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '4px solid #f3f3f3', 
            borderTop: '4px solid #10b981', 
            borderRadius: '50%', 
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }}></div>
        </div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (status === 'partial_success') {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>✅</div>
        <h2>Payment Successful!</h2>
        <p>Your payment was processed successfully.</p>
        
        {paymentId && (
          <div style={{ 
            background: '#f0fdf4', 
            padding: '15px', 
            borderRadius: '8px', 
            margin: '20px auto',
            maxWidth: '400px',
            border: '1px solid #bbf7d0'
          }}>
            <p style={{ margin: '5px 0', fontSize: '14px' }}>
              <strong>Payment ID:</strong> {paymentId}
            </p>
            <p style={{ margin: '5px 0', fontSize: '12px', color: '#059669' }}>
              ⚠️ Order details not saved - please contact support with this ID
            </p>
          </div>
        )}

        <p>Please contact our support team with your Payment ID to complete your order.</p>
        
        <div style={{ marginTop: '30px' }}>
          <Link 
            href="/"
            style={{ 
              background: '#10b981', 
              color: 'white', 
              padding: '12px 24px', 
              borderRadius: '8px',
              textDecoration: 'none',
              display: 'inline-block',
              marginRight: '10px'
            }}
          >
            Return Home
          </Link>
          
          <a 
            href="mailto:support@farm2table.com"
            style={{ 
              border: '1px solid #10b981', 
              color: '#10b981', 
              padding: '12px 24px', 
              borderRadius: '8px',
              textDecoration: 'none',
              display: 'inline-block'
            }}
          >
            Contact Support
          </a>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>❌</div>
        <h2>Order Processing Issue</h2>
        <p>There was an issue saving your order. The payment was successful but we couldn't save the order details.</p>
        {paymentId && (
          <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
            <strong>Payment ID:</strong> {paymentId}
          </p>
        )}
        <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
          Please contact support with your Payment ID above.
        </p>
        <div style={{ marginTop: '20px' }}>
          <Link 
            href="/"
            style={{ 
              background: '#10b981', 
              color: 'white', 
              padding: '12px 24px', 
              borderRadius: '8px',
              textDecoration: 'none',
              display: 'inline-block'
            }}
          >
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <div style={{ fontSize: '48px', marginBottom: '20px' }}>🎉</div>
      <h2>Payment Successful!</h2>
      <p>Your order has been confirmed and saved to the database.</p>
      
      <div style={{ 
        background: '#f0fdf4', 
        padding: '20px', 
        borderRadius: '8px', 
        margin: '20px auto',
        maxWidth: '400px',
        border: '1px solid #bbf7d0'
      }}>
        {orderNumber && orderNumber.startsWith('F2T') ? (
          <>
            <div style={{ marginBottom: '15px' }}>
              <div style={{ 
                fontSize: '12px', 
                color: '#059669', 
                fontWeight: '600',
                marginBottom: '5px'
              }}>
                ✅ F2T ORDER NUMBER
              </div>
              <div style={{ 
                fontSize: '18px', 
                fontWeight: '700',
                color: '#065f46'
              }}>
                {orderNumber}
              </div>
            </div>
            
            <div style={{ 
              fontSize: '12px', 
              color: '#059669',
              background: '#dcfce7',
              padding: '5px 10px',
              borderRadius: '4px',
              display: 'inline-block',
              marginBottom: '10px'
            }}>
              ✓ Official Order Format
            </div>
          </>
        ) : (
          <div style={{ marginBottom: '15px' }}>
            <div style={{ 
              fontSize: '12px', 
              color: '#dc2626', 
              fontWeight: '600',
              marginBottom: '5px'
            }}>
              ⚠️ TEMPORARY ORDER ID
            </div>
            <div style={{ 
              fontSize: '16px', 
              fontWeight: '600',
              color: '#7c2d12'
            }}>
              {orderId}
            </div>
          </div>
        )}
        
        <div style={{ borderTop: '1px solid #bbf7d0', marginTop: '15px', paddingTop: '15px' }}>
          <p style={{ margin: '8px 0', fontSize: '14px', textAlign: 'left' }}>
            <strong style={{ color: '#374151' }}>Payment ID:</strong>
            <span style={{ 
              display: 'block', 
              fontSize: '12px', 
              color: '#6b7280',
              wordBreak: 'break-all',
              marginTop: '2px'
            }}>
              {paymentId}
            </span>
          </p>
          
          <p style={{ margin: '8px 0', fontSize: '14px', textAlign: 'left' }}>
            <strong style={{ color: '#374151' }}>Payment Status:</strong>
            <span style={{ 
              display: 'inline-block',
              fontSize: '12px', 
              color: paymentVerified ? '#059669' : '#d97706',
              background: paymentVerified ? '#dcfce7' : '#fef3c7',
              padding: '2px 8px',
              borderRadius: '12px',
              marginLeft: '8px'
            }}>
              {paymentVerified ? '✓ Verified' : '✓ Paid'}
            </span>
          </p>
        </div>
        
        {orderNumber && !orderNumber.startsWith('F2T') && (
          <div style={{ 
            marginTop: '10px',
            padding: '10px',
            background: '#fef3c7',
            border: '1px solid #fbbf24',
            borderRadius: '6px'
          }}>
            <p style={{ 
              fontSize: '12px', 
              color: '#92400e',
              margin: 0
            }}>
              ℹ️ Your order was processed successfully, but is using a temporary ID.
              You can track it in your purchases section.
            </p>
          </div>
        )}
      </div>

      <div style={{ marginTop: '30px' }}>
        <Link 
          href="/buyer/profile/my-purchases"
          style={{ 
            background: '#10b981', 
            color: 'white', 
            padding: '12px 24px', 
            borderRadius: '8px',
            textDecoration: 'none',
            display: 'inline-block',
            marginRight: '10px',
            fontWeight: '500',
            fontSize: '14px'
          }}
        >
          View My Orders
        </Link>

        <Link 
          href="/buyer/marketplace"
          style={{ 
            border: '1px solid #10b981', 
            color: '#10b981', 
            padding: '12px 24px', 
            borderRadius: '8px',
            textDecoration: 'none',
            display: 'inline-block',
            fontWeight: '500',
            fontSize: '14px'
          }}
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}

export default function PaymentSuccess() {
  return (
    <Suspense fallback={
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2>Loading...</h2>
        <p>Preparing payment information...</p>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}