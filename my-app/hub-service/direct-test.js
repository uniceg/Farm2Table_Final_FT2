import { publishEvent } from './queue/rabbit.js';

async function testDirect() {
  console.log('🎯 Direct test of publishEvent function');
  
  const testData = {
    eventType: 'payment.completed',
    orderId: 'direct_test_' + Date.now(),
    amount: 999,
    test: true
  };
  
  console.log('Test data:', testData);
  
  try {
    const result = await publishEvent('payment.completed', testData);
    console.log('Result:', result);
    
    if (result) {
      console.log('✅ SUCCESS! Check RabbitMQ for queue: payment.completed');
    } else {
      console.log('❌ FAILED: publishEvent returned false');
    }
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  }
}

testDirect();