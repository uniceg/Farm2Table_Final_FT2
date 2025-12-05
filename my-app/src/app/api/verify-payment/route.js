import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { paymentIntentId } = await request.json();

    if (!paymentIntentId) {
      console.error('❌ No paymentIntentId provided');
      return NextResponse.json(
        { 
          success: false,
          error: 'Payment intent ID is required',
          verified: false 
        },
        { status: 400 }
      );
    }

    console.log('🔍 VERIFYING PAYMENT:', paymentIntentId);
    
    // Get Paymongo key - USE TEST KEY
    const secretKey = process.env.PAYMONGO_TEST_SECRET_KEY;
    
    if (!secretKey) {
      console.error('❌ NO PAYMONGO KEY IN VERIFY-PAYMENT!');
      return NextResponse.json(
        { 
          success: false,
          error: 'Payment system configuration error',
          verified: false 
        },
        { status: 500 }
      );
    }

    // Create auth
    const authString = `${secretKey}:`;
    const base64Auth = Buffer.from(authString).toString('base64');

    // Call Paymongo API
    const response = await fetch(
      `https://api.paymongo.com/v1/payment_intents/${paymentIntentId}`,
      {
        headers: {
          'Authorization': `Basic ${base64Auth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        cache: 'no-store'
      }
    );

    if (!response.ok) {
      console.error('❌ PAYMONGO VERIFICATION FAILED:', {
        status: response.status,
        statusText: response.statusText
      });
      
      // Return partial data even if verification fails
      return NextResponse.json({
        success: false,
        verified: false,
        paymentIntentId: paymentIntentId,
        error: `Verification failed (${response.status})`,
        status: 'unverified'
      });
    }

    const paymentData = await response.json();
    
    console.log('✅ PAYMENT VERIFIED:', {
      id: paymentData.data.id,
      status: paymentData.data.attributes.status,
      amount: paymentData.data.attributes.amount
    });
    
    // Extract data
    const metadata = paymentData.data.attributes.metadata || {};
    let orderData = {};
    
    try {
      if (metadata.order_data) {
        orderData = JSON.parse(metadata.order_data);
      }
    } catch (e) {
      console.log('Could not parse order_data from metadata');
    }
    
    return NextResponse.json({
      success: true,
      verified: true,
      paymentIntentId: paymentIntentId,
      status: paymentData.data.attributes.status,
      amount: paymentData.data.attributes.amount,
      currency: paymentData.data.attributes.currency,
      orderNumber: metadata.order_number || paymentData.data.attributes.metadata?.order_number,
      metadata: metadata,
      orderData: orderData,
      paymentMethod: paymentData.data.attributes.payment_method_allowed?.[0] || 'unknown',
      lastPaymentError: paymentData.data.attributes.last_payment_error,
      livemode: paymentData.data.attributes.livemode,
      created: paymentData.data.attributes.created_at
    });

  } catch (error) {
    console.error('❌ PAYMENT VERIFICATION ERROR:', error);
    return NextResponse.json(
      { 
        success: false,
        verified: false,
        error: error.message,
        message: 'Payment verification failed'
      },
      { status: 500 }
    );
  }
}