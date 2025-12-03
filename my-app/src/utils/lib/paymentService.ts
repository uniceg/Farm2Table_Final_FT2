// Payment service for PayMongo integration

// Use TEST key for now (switch to LIVE when ready)
const PAYMONGO_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYMONGO_TEST_PUBLIC_KEY;

// Create payment method (frontend - safe to use public key)
export async function createPaymentMethod(paymentType: string, buyerDetails: {
  name: string;
  email: string;
  phone?: string;
}): Promise<string> {
  try {
    const response = await fetch('https://api.paymongo.com/v1/payment_methods', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + btoa(PAYMONGO_PUBLIC_KEY + ':'),
      },
      body: JSON.stringify({
        data: {
          attributes: {
            type: paymentType, // 'gcash', 'paymaya', or 'card'
            billing: {
              name: buyerDetails.name,
              email: buyerDetails.email,
              phone: buyerDetails.phone,
            }
          }
        }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.errors?.[0]?.detail || 'Failed to create payment method');
    }

    return data.data.id; // payment_method_id
  } catch (error) {
    console.error('Create payment method error:', error);
    throw error;
  }
}

// Create payment intent (through our backend)
export async function createPaymentIntent(
  amount: number, 
  orderId: string, 
  orderNumber: string
): Promise<any> {
  try {
    const response = await fetch('/api/payment-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amount,
        orderId: orderId,
        orderNumber: orderNumber
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to create payment intent');
    }

    return data.data; // payment intent data
  } catch (error) {
    console.error('Create payment intent error:', error);
    throw error;
  }
}

// Attach payment method to intent (through our backend)
export async function attachPaymentMethod(paymentIntentId: string, paymentMethodId: string): Promise<any> {
  try {
    const response = await fetch('/api/attach-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentIntentId: paymentIntentId,
        paymentMethodId: paymentMethodId
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to attach payment');
    }

    return data.data;
  } catch (error) {
    console.error('Attach payment error:', error);
    throw error;
  }
}

// Main payment handler
export async function processPayment(paymentData: {
  amount: number;
  orderId: string;
  orderNumber: string;
  paymentMethod: string;
  buyerDetails: {
    name: string;
    email: string;
    phone?: string;
  };
}): Promise<{
  success: boolean;
  redirectUrl?: string;
  paymentIntentId?: string;
  orderNumber?: string;
  error?: string;
}> {
  const { amount, orderId, orderNumber, paymentMethod, buyerDetails } = paymentData;

  try {
    console.log('🔄 Starting payment process...');
    console.log('📦 Processing payment for order number:', orderNumber);
    
    // 1. Create payment intent
    const paymentIntent = await createPaymentIntent(amount, orderId, orderNumber);
    console.log('✅ Payment intent created:', paymentIntent.id);

    // 2. Create payment method
    const paymentMethodId = await createPaymentMethod(paymentMethod, buyerDetails);
    console.log('✅ Payment method created:', paymentMethodId);

    // 3. Attach payment method to intent
    const attachedPayment = await attachPaymentMethod(paymentIntent.id, paymentMethodId);
    console.log('✅ Payment attached, redirect URL:', attachedPayment.attributes.next_action?.redirect?.url);

    return {
      success: true,
      redirectUrl: attachedPayment.attributes.next_action?.redirect?.url,
      paymentIntentId: paymentIntent.id,
      orderNumber: orderNumber
    };
  } catch (error: any) {
    console.error('❌ Payment processing failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ✅ ADDED: Event publishing function for Hub Service
export async function publishPaymentCompletedEvent(paymentData: {
  orderId: string;
  paymentIntentId: string;
  amount: number;
  customer: {
    id: string;
    email?: string;
    name?: string;
  };
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    price: number;
  }>;
  timestamp: string;
}): Promise<void> {
  try {
    const eventPayload = {
      eventType: 'payment.completed',
      orderId: paymentData.orderId,
      paymentIntentId: paymentData.paymentIntentId,
      amount: paymentData.amount,
      currency: 'PHP',
      status: 'paid',
      customer: paymentData.customer,
      items: paymentData.items,
      timestamp: paymentData.timestamp,
      source: 'farm2table'
    };

    console.log('📤 Publishing payment.completed event:', eventPayload);

    // Send to hub service
    const response = await fetch('http://localhost:4001/payments/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventPayload)
    });

    if (response.ok) {
      console.log('✅ Payment completed event published to hub service');
    } else {
      console.log('⚠️ Hub service unavailable, payment still successful');
    }
  } catch (error) {
    console.error('❌ Failed to publish payment event (non-critical):', error);
    // Don't throw - payment should still succeed even if event fails
  }
}

// ✅ ADDED: Helper function to call from payment verification
export async function handlePaymentVerificationSuccess(verificationData: {
  orderId: string;
  paymentIntentId: string;
  amount: number;
  customer: {
    id: string;
    email?: string;
    name?: string;
  };
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    price: number;
  }>;
}): Promise<void> {
  try {
    await publishPaymentCompletedEvent({
      ...verificationData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error in payment verification handler:', error);
  }
}