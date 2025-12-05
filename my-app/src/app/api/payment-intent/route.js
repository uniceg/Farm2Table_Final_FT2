import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // Get order data from request
    const { amount, orderId, orderNumber, orderData } = await request.json();
    
    console.log('💰 PAYMENT INTENT REQUEST:', {
      orderId,
      orderNumber,
      amount,
      hasOrderData: !!orderData,
      time: new Date().toISOString()
    });
    
    // Validate orderNumber
    let finalOrderNumber = orderNumber;
    if (!finalOrderNumber || !finalOrderNumber.startsWith('F2T')) {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substr(2, 6).toUpperCase();
      finalOrderNumber = `F2T-${timestamp}-${random}`;
      console.log('Generated order number:', finalOrderNumber);
    }
    
    // Get Paymongo key - FORCE TEST KEY FOR NOW
    const secretKey = process.env.PAYMONGO_TEST_SECRET_KEY;
    
    if (!secretKey) {
      console.error('❌ NO PAYMONGO TEST KEY FOUND!');
      return NextResponse.json(
        { error: 'Paymongo test key not configured. Set PAYMONGO_TEST_SECRET_KEY in Vercel.' },
        { status: 500 }
      );
    }
    
    console.log('✅ Using Paymongo TEST key');
    
    // ✅✅✅ HARDCODE VERCEL URL - NO LOCALHOST EVER! ✅✅✅
    const VERCEL_URL = 'https://farm2-table-final-ft-2.vercel.app';
    const timestamp = Date.now();
    const randomParam = Math.random().toString(36).substr(2, 8);
    const returnUrl = `${VERCEL_URL}/payment-success?t=${timestamp}&r=${randomParam}&src=vercel`;
    
    console.log('🚀 FORCED VERCEL RETURN URL:', returnUrl);
    
    // Prepare metadata with ALL data
    const metadata = {
      order_id: orderId,
      order_number: finalOrderNumber,
      order_data: JSON.stringify({
        orderId: orderId,
        orderNumber: finalOrderNumber,
        amount: amount,
        timestamp: new Date().toISOString(),
        items: orderData?.items || [],
        buyerInfo: orderData?.buyerInfo || {},
        shippingAddress: orderData?.shippingAddress || {}
      }),
      source: 'farm2table_production',
      created_at: new Date().toISOString(),
      version: '3.0',
      forced_redirect: 'vercel_only',
      environment: 'production'
    };
    
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
            metadata: metadata,
            description: `Farm2Table Order ${finalOrderNumber}`,
            // ✅✅✅ FORCE VERCEL URL - NO LOCALHOST
            return_url: returnUrl,
            statement_descriptor: 'FARM2TABLE'
          }
        }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ PAYMONGO ERROR:', {
        status: response.status,
        error: data.errors
      });
      throw new Error(data.errors?.[0]?.detail || 'Paymongo API error');
    }

    console.log('✅ PAYMENT INTENT CREATED:', {
      id: data.data.id,
      orderNumber: finalOrderNumber,
      amount: amount,
      returnUrl: returnUrl,
      checkoutUrl: data.data.attributes.next_action?.redirect?.url || 'No checkout URL'
    });

    return NextResponse.json({
      success: true,
      clientKey: data.data.attributes.client_key,
      id: data.data.id,
      amount: data.data.attributes.amount,
      returnUrl: returnUrl,
      orderNumber: finalOrderNumber,
      // For mobile/redirect
      checkoutUrl: data.data.attributes.next_action?.redirect?.url,
      _debug: {
        forcedVercelUrl: returnUrl,
        timestamp: timestamp
      }
    });
    
  } catch (error) {
    console.error('❌ PAYMENT INTENT CREATION FAILED:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message,
        message: 'Payment system error. Please try again or contact support.'
      },
      { status: 500 }
    );
  }
}