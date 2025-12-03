"use client";
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { publishPaymentCompletedEvent } from '@/utils/lib/paymentEventService';

export default function PaymentSuccess() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('loading');
  const [orderData, setOrderData] = useState(null);

  useEffect(() => {
    const verifyPayment = async () => {
      const paymentIntentId = searchParams.get('payment_intent_id');
      
      if (!paymentIntentId) {
        setStatus('error');
        return;
      }

      try {
        console.log('🔄 Verifying payment with intent ID:', paymentIntentId);
        
        // Get pending order data from localStorage
        const pendingOrder = localStorage.getItem('pendingOrder');
        if (!pendingOrder) {
          console.error('❌ No pending order found in localStorage');
          setStatus('error');
          return;
        }

        const orderData = JSON.parse(pendingOrder);
        setOrderData(orderData);
        
        // Verify payment with your backend
        const response = await fetch('/api/verify-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentIntentId,
            orderData
          })
        });

        const result = await response.json();
        
        if (!response.ok || !result.success) {
          console.error('❌ Payment verification failed:', result.error);
          setStatus('error');
          return;
        }

        console.log('✅ Payment verified successfully:', result);
        
        // ✅ PUBLISH PAYMENT EVENT TO HUB SERVICE
        try {
          // Get cart items from localStorage
          const cartItems = JSON.parse(localStorage.getItem('cartItems') || '[]');
          
          await publishPaymentCompletedEvent({
            orderId: orderData.orderId || result.orderId,
            paymentIntentId,
            amount: orderData.totalAmount,
            customer: {
              id: orderData.buyerId,
              email: orderData.buyerEmail,
              name: orderData.buyerName
            },
            items: cartItems.map((item) => ({
              productId: item.product.id,
              name: item.product.name,
              quantity: item.quantity,
              price: item.product.price
            })),
            timestamp: new Date().toISOString()
          });
          
          console.log('📤 Payment event published to hub service');
        } catch (eventError) {
          console.error('⚠️ Failed to publish payment event (non-critical):', eventError);
          // Don't fail the payment if event publishing fails
        }

        // Clear localStorage
        localStorage.removeItem('pendingOrder');
        localStorage.removeItem('paymentIntentId');
        localStorage.removeItem('cartItems'); // Clear cart after successful payment
        
        // Trigger order success callback if needed
        if (orderData.callback) {
          try {
            // Simulate callback to parent component
            const event = new CustomEvent('orderSuccess', { 
              detail: { 
                orderId: orderData.orderId,
                paymentIntentId,
                ...result 
              } 
            });
            window.dispatchEvent(event);
          } catch (callbackError) {
            console.error('⚠️ Callback error:', callbackError);
          }
        }
        
        setStatus('success');
        
      } catch (error) {
        console.error('❌ Payment verification error:', error);
        setStatus('error');
      }
    };

    verifyPayment();
  }, [searchParams]);

  if (status === 'loading') {
    return (
      <div style={{ padding: '40px', textAlign: 'center', minHeight: '60vh' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold mb-2">Processing your payment...</h2>
        <p className="text-gray-600">Please wait while we confirm your payment with PayMongo.</p>
        <p className="text-sm text-gray-500 mt-2">This may take a few seconds.</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={{ padding: '40px', textAlign: 'center', minHeight: '60vh' }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>❌</div>
        <h2 className="text-xl font-semibold mb-2">Payment Issue</h2>
        <p className="text-gray-600 mb-4">There was an issue processing your payment. Please try again.</p>
        <p className="text-sm text-gray-500 mb-6">
          If the amount was deducted, contact support with your payment intent ID.
        </p>
        <Link 
          href="/cart" 
          style={{ 
            background: '#ef4444', 
            color: 'white', 
            padding: '12px 24px', 
            borderRadius: '8px',
            textDecoration: 'none',
            display: 'inline-block',
            marginRight: '10px'
          }}
        >
          Return to Cart
        </Link>
        <Link 
          href="/" 
          style={{ 
            border: '1px solid #d1d5db', 
            color: '#374151', 
            padding: '12px 24px', 
            borderRadius: '8px',
            textDecoration: 'none',
            display: 'inline-block'
          }}
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div style={{ padding: '40px', textAlign: 'center', minHeight: '60vh' }}>
      <div style={{ fontSize: '48px', marginBottom: '20px' }}>🎉</div>
      <h2 className="text-2xl font-bold mb-2">Payment Successful!</h2>
      <p className="text-gray-600 mb-2">Your order has been confirmed and payment was successful.</p>
      <p className="text-gray-600 mb-4">You will receive an order confirmation email shortly.</p>
      
      {orderData && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 max-w-md mx-auto mb-6">
          <h3 className="font-semibold mb-2">Order Details:</h3>
          <p className="text-sm">
            <span className="font-medium">Order ID:</span> {orderData.orderId || 'N/A'}<br/>
            <span className="font-medium">Amount:</span> ₱{orderData.totalAmount?.toLocaleString()}<br/>
            <span className="font-medium">Items:</span> {orderData.cartItems?.length || 0} item(s)
          </p>
        </div>
      )}
      
      <div style={{ marginTop: '30px' }}>
        <Link 
          href="/orders" 
          style={{ 
            background: '#10b981', 
            color: 'white', 
            padding: '12px 24px', 
            borderRadius: '8px',
            textDecoration: 'none',
            display: 'inline-block',
            marginRight: '10px',
            fontWeight: '500'
          }}
        >
          View Your Orders
        </Link>
        <Link 
          href="/" 
          style={{ 
            border: '1px solid #10b981', 
            color: '#10b981', 
            padding: '12px 24px', 
            borderRadius: '8px',
            textDecoration: 'none',
            display: 'inline-block',
            fontWeight: '500'
          }}
        >
          Continue Shopping
        </Link>
      </div>
      
      <div className="mt-8 text-sm text-gray-500">
        <p>Need help? Contact support at support@farm2table.com</p>
      </div>
    </div>
  );
}