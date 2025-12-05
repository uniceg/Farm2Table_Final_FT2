import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // Get order data from request
    const { amount, orderId, orderNumber, orderData } = await request.json();
    
    console.log('💰 Creating payment intent:', {
      orderId,
      orderNumber,
      amount,
      hasOrderData: !!orderData
    });
    
    // Validate orderNumber
    if (!orderNumber || !orderNumber.startsWith('F2T')) {
      console.warn('⚠️ Order number is not F2T format:', orderNumber);
      // Generate a proper one if missing
      const timestamp = Date.now();
      const random = Math.random().toString(36).substr(2, 6).toUpperCase();
      orderNumber = `F2T-${timestamp}-${random}`;
      console.log('Generated new order number:', orderNumber);
    }
    
    // Use TEST key for now (switch to LIVE when ready)
    const secretKey = process.env.PAYMONGO_TEST_SECRET_KEY;
    
    // ✅ CRITICAL FIX: Use your Vercel URL instead of localhost
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                   (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    
    // For now, hardcode your Vercel URL to ensure it works
    const returnUrl = 'https://farm2-table-final-ft-2.vercel.app/payment-success';
    
    console.log('Using return URL:', returnUrl);
    
    const response = await fetch('https://api.paymongo.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(secretKey + ':').toString('base64'),
      },
      body: JSON.stringify({
        data: {
          attributes: {
            amount: Math.round(amount * 100), 
            currency: 'PHP',
            payment_method_allowed: ['gcash', 'paymaya', 'card'],
            capture_type: 'automatic',
            // ✅ FIXED: Store COMPLETE order data in metadata
            metadata: {
              order_id: orderId,
              order_number: orderNumber,
              order_data: JSON.stringify(orderData || { orderId, orderNumber, amount }),
              source: 'farm2table',
              created_at: new Date().toISOString()
            },
            // ✅ ADDED: Description with orderNumber
            description: `Order ${orderNumber} - Farm2Table`,
            // ✅ CRITICAL: Use your Vercel URL for redirection
            return_url: returnUrl
          }
        }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Paymongo API error:', {
        status: response.status,
        data: data
      });
      throw new Error(data.errors?.[0]?.detail || 'Failed to create payment intent');
    }

    console.log('✅ Payment intent created successfully:', {
      paymentIntentId: data.data.id,
      orderNumber: orderNumber,
      amount: amount,
      returnUrl: returnUrl
    });

    return NextResponse.json({
      ...data,
      // Add extra info for debugging
      _debug: {
        orderNumber: orderNumber,
        returnUrl: returnUrl,
        baseUrl: baseUrl
      }
    });
    
  } catch (error) {
    console.error('Payment intent error:', error);
    return NextResponse.json(
      { 
        error: error.message,
        details: 'Check if Paymongo keys are set and return URL is correct'
      },
      { status: 500 }
    );
  }
}