import amqp from 'amqplib';

async function testPublish() {
  console.log('🧪 Testing RabbitMQ publish...');
  
  try {
    // 1. Connect
    console.log('1. Connecting to RabbitMQ...');
    const connection = await amqp.connect('amqp://localhost:5672');
    console.log('✅ Connected');
    
    // 2. Create channel
    const channel = await connection.createChannel();
    console.log('✅ Channel created');
    
    // 3. Create queue
    const queueName = 'test.debug.queue';
    await channel.assertQueue(queueName, { durable: true });
    console.log(`✅ Queue "${queueName}" created`);
    
    // 4. Publish test message
    const testMessage = {
      test: true,
      message: 'Hello RabbitMQ!',
      timestamp: new Date().toISOString()
    };
    
    console.log('4. Publishing message...');
    const sent = channel.sendToQueue(
      queueName,
      Buffer.from(JSON.stringify(testMessage)),
      { persistent: true }
    );
    
    if (sent) {
      console.log('✅ Message sent successfully!');
      console.log('Check RabbitMQ dashboard:');
      console.log('  http://localhost:15672');
      console.log('  Look for queue: test.debug.queue');
    } else {
      console.log('❌ sendToQueue returned false');
    }
    
    // 5. Close connections
    await channel.close();
    await connection.close();
    console.log('✅ Connections closed');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  }
}

testPublish();