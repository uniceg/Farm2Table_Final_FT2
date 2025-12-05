import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // ✅ FIXED: Get orderNumber from request
    const { amount, orderId, orderNumber } = await request.json();
    
    console.log('💰 Creating payment intent:', {
      orderId,
      orderNumber,
      amount
    });
    
    // ✅ ADDED: Validate orderNumber
    if (!orderNumber || !orderNumber.startsWith('F2T')) {
      console.warn('⚠️ Order number is not F2T format:', orderNumber);
      // Still proceed, but this should be fixed upstream
    }
    
    // Use TEST key for now (switch to LIVE when ready)
    const secretKey = process.env.PAYMONGO_TEST_SECRET_KEY;
    
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
            // ✅ FIXED: Store BOTH orderId and orderNumber in metadata
            metadata: {
              order_id: orderId,
              order_number: orderNumber, // ← ADD THIS LINE
              source: 'farm2table'
            },
            // ✅ ADDED: Description with orderNumber
            description: `Order ${orderNumber || orderId} - Farm2Table`
          }
        }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.errors?.[0]?.detail || 'Failed to create payment intent');
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Payment intent error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}