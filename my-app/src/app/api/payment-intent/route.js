import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // Get order data from request
    const { amount, orderId, orderNumber, orderData } = await request.json();
    
    console.log('💰 Creating payment intent:', {
      orderId,
      orderNumber,
      amount,
      hasOrderData: !!orderData,
      timestamp: new Date().toISOString()
    });
    
    // Validate orderNumber
    let finalOrderNumber = orderNumber;
    if (!finalOrderNumber || !finalOrderNumber.startsWith('F2T')) {
      console.warn('⚠️ Order number is not F2T format:', finalOrderNumber);
      // Generate a proper one if missing
      const timestamp = Date.now();
      const random = Math.random().toString(36).substr(2, 6).toUpperCase();
      finalOrderNumber = `F2T-${timestamp}-${random}`;
      console.log('Generated new order number:', finalOrderNumber);
    }
    
    // Use TEST key for now (switch to LIVE when ready)
    const secretKey = process.env.PAYMONGO_TEST_SECRET_KEY;
    
    if (!secretKey) {
      throw new Error('Paymongo secret key is not configured');
    }
    
    // ✅ CRITICAL: Add timestamp to prevent ANY caching
    const timestamp = Date.now();
    const returnUrl = `https://farm2-table-final-ft-2.vercel.app/payment-success?t=${timestamp}&src=paymongo`;
    
    console.log('🚀 Using FRESH return URL:', returnUrl);
    
    // Prepare metadata with ALL order data
    const metadata = {
      order_id: orderId,
      order_number: finalOrderNumber,
      order_data: JSON.stringify(orderData || { 
        orderId, 
        orderNumber: finalOrderNumber, 
        amount,
        timestamp: new Date().toISOString()
      }),
      source: 'farm2table_v2',
      created_at: new Date().toISOString(),
      version: '2.0',
      return_url: returnUrl // Also store in metadata for debugging
    };
    
    const response = await fetch('https://api.paymongo.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(secretKey + ':').toString('base64'),
        'User-Agent': 'Farm2Table/1.0'
      },
      body: JSON.stringify({
        data: {
          attributes: {
            amount: Math.round(amount * 100), 
            currency: 'PHP',
            payment_method_allowed: ['gcash', 'paymaya', 'card'],
            capture_type: 'automatic',
            metadata: metadata,
            description: `Order ${finalOrderNumber} - Farm2Table`,
            // ✅ CRITICAL: Use timestamped URL to prevent caching
            return_url: returnUrl
          }
        }
      })
    });

    const responseText = await response.text();
    let data;
    
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse Paymongo response:', responseText);
      throw new Error('Invalid response from Paymongo API');
    }
    
    if (!response.ok) {
      console.error('❌ Paymongo API error:', {
        status: response.status,
        statusText: response.statusText,
        error: data.errors || responseText
      });
      
      // More specific error messages
      let errorMsg = 'Failed to create payment intent';
      if (data.errors && data.errors[0]) {
        errorMsg = `${data.errors[0].detail} (code: ${data.errors[0].code})`;
      } else if (response.status === 401) {
        errorMsg = 'Invalid Paymongo API credentials';
      }
      
      throw new Error(errorMsg);
    }

    console.log('✅ Payment intent created SUCCESSFULLY:', {
      paymentIntentId: data.data.id,
      orderNumber: finalOrderNumber,
      amount: amount,
      returnUrl: returnUrl,
      metadata: metadata,
      paymentIntent: data.data.attributes
    });

    return NextResponse.json({
      ...data,
      // Add debugging information
      _debug: {
        orderNumber: finalOrderNumber,
        returnUrl: returnUrl,
        timestamp: timestamp,
        metadataKeys: Object.keys(metadata),
        success: true
      }
    });
    
  } catch (error) {
    console.error('❌ Payment intent creation FAILED:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message,
        details: 'Check Paymongo configuration and network connection',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}