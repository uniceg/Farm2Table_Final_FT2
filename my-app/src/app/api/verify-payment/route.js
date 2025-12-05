import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { paymentIntentId } = await request.json();

    // ✅ FIXED: Correct authentication format
    const authString = `${process.env.PAYMONGO_SECRET_KEY}:`;
    const base64Auth = Buffer.from(authString).toString('base64');

    // Verify payment with Paymongo
    const response = await fetch(
      `https://api.paymongo.com/v1/payment_intents/${paymentIntentId}`,
      {
        headers: {
          'Authorization': `Basic ${base64Auth}`, // ✅ FIXED
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      // Get more details about the error
      const errorText = await response.text();
      console.error('PayMongo API error:', response.status, errorText);
      throw new Error(`PayMongo API error: ${response.status} - ${errorText}`);
    }

    const paymentData = await response.json();
    
    console.log('✅ Payment verification successful:', {
      paymentIntentId,
      status: paymentData.data.attributes.status,
      hasMetadata: !!paymentData.data.attributes.metadata
    });
    
    // ✅ ADDED: Extract orderNumber from metadata
    const metadata = paymentData.data.attributes.metadata || {};
    const orderNumber = metadata.order_number;
    
    return NextResponse.json({
      status: paymentData.data.attributes.status,
      payment_method: paymentData.data.attributes.payment_method_allowed?.[0] || 'card',
      amount: paymentData.data.attributes.amount,
      currency: paymentData.data.attributes.currency,
      // ✅ ADDED: Return orderNumber from metadata
      orderNumber: orderNumber,
      metadata: metadata
    });

  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify payment' },
      { status: 500 }
    );
  }
}