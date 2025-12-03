import express from 'express';
import { publishEvent } from '../queue/rabbit.js';

const router = express.Router();

// Webhook endpoint for payment events
router.post('/webhook', async (req, res) => {
  try {
    const eventData = req.body;
    
    console.log('💰 Payment webhook received - RAW data:', JSON.stringify(eventData, null, 2));

    // Validate required fields
    if (!eventData.eventType || !eventData.orderId || eventData.amount === undefined) {
      console.error('❌ Validation failed:', {
        eventType: eventData.eventType,
        orderId: eventData.orderId,
        amount: eventData.amount
      });
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields',
        details: {
          received: eventData
        }
      });
    }

    // Validate event type
    if (eventData.eventType !== 'payment.completed') {
      console.error('❌ Invalid event type:', eventData.eventType);
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid event type' 
      });
    }

    // Validate amount
    const amount = Number(eventData.amount);
    if (isNaN(amount) || amount <= 0) {
      console.error('❌ Invalid amount:', eventData.amount);
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid amount' 
      });
    }

    // Create standardized event payload (ONLY ONE DECLARATION)
    const eventPayload = {
      eventType: eventData.eventType,
      orderId: String(eventData.orderId),
      paymentIntentId: eventData.paymentIntentId || 'N/A',
      amount: amount,
      currency: eventData.currency || 'PHP',
      status: eventData.status || 'paid',
      customer: eventData.customer || { id: 'unknown' },
      items: eventData.items || [],
      timestamp: eventData.timestamp || new Date().toISOString(),
      source: eventData.source || 'unknown',
      hubReceivedAt: new Date().toISOString(),
      processed: false
    };

    console.log('📦 Prepared event payload:', JSON.stringify(eventPayload, null, 2));

    // Publish to RabbitMQ with detailed logging
    console.log('🔍 Calling publishEvent...');
    try {
      const published = await publishEvent('payment.completed', eventPayload);
      console.log('🔍 publishEvent result:', published);
      
      if (!published) {
        console.error('❌ publishEvent returned false');
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to publish event to RabbitMQ (returned false)' 
        });
      }
      
      console.log(`✅ Payment event published to RabbitMQ: ${eventData.orderId}`);
      
      // Successful response
      res.status(200).json({ 
        success: true, 
        message: 'Payment event received and published',
        data: {
          orderId: eventData.orderId,
          amount: eventData.amount,
          eventId: `payment_${Date.now()}`,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (publishError) {
      console.error('❌ publishEvent threw error:', publishError.message);
      console.error('Stack:', publishError.stack);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to publish event to RabbitMQ (exception)',
        details: publishError.message
      });
    }
    
  } catch (error) {
    console.error('❌ Payment webhook error:', error.message);
    console.error('Request body:', req.body);
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process payment event',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Health check endpoint for payment service
router.get('/health', (req, res) => {
  res.status(200).json({ 
    success: true,
    service: 'payment-webhook',
    status: 'operational',
    timestamp: new Date().toISOString(),
    rabbitmq: 'connected'
  });
});

// Test endpoint for manual testing
router.post('/test', async (req, res) => {
  try {
    const testData = req.body || {
      eventType: 'payment.completed',
      orderId: `test_order_${Date.now()}`,
      paymentIntentId: `test_pi_${Date.now()}`,
      amount: 1000,
      currency: 'PHP',
      status: 'paid',
      customer: {
        id: 'test_customer_123',
        email: 'test@example.com',
        name: 'Test Customer'
      },
      items: [
        {
          productId: 'test_product_1',
          name: 'Test Product',
          quantity: 2,
          price: 500
        }
      ],
      timestamp: new Date().toISOString(),
      source: 'test'
    };
    
    // Publish test event
    await publishEvent('payment.completed', {
      ...testData,
      hubReceivedAt: new Date().toISOString(),
      isTest: true
    });
    
    console.log('🧪 Test payment event published:', testData.orderId);
    
    res.status(200).json({
      success: true,
      message: 'Test payment event published',
      data: testData,
      rabbitmq: 'event_sent'
    });
    
  } catch (error) {
    console.error('❌ Test endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Test failed',
      details: error.message
    });
  }
});

export default router;