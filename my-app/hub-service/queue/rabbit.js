import amqplib from "amqplib";

const RABBITMQ_URL = 'amqp://localhost:5672';

let connection = null;
let channel = null;

export const connectRabbit = async () => {
  try {
    console.log('🔄 Connecting to RabbitMQ...');
    connection = await amqplib.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    
    // Test connection
    await channel.assertQueue('connection_test', { durable: false });
    await channel.deleteQueue('connection_test');
    
    console.log("✅ Connected to RabbitMQ");
    return true;
  } catch (error) {
    console.error("❌ Failed to connect to RabbitMQ:", error.message);
    return false;
  }
};

export const publishEvent = async (queueName, data) => {
  try {
    console.log(`📤 Publishing to ${queueName}...`);
    
    // Create fresh connection each time (most reliable)
    const connection = await amqplib.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    
    // Ensure queue exists
    await channel.assertQueue(queueName, { 
      durable: true 
    });
    
    // Create message with metadata
    const message = {
      ...data,
      _eventId: `${queueName}_${Date.now()}`,
      _publishedAt: new Date().toISOString(),
      _source: 'hub-service'
    };
    
    // Send to queue
    const sent = channel.sendToQueue(
      queueName,
      Buffer.from(JSON.stringify(message)),
      { 
        persistent: true,
        contentType: 'application/json'
      }
    );
    
    if (sent) {
      console.log(`✅ Event published to ${queueName}:`, {
        orderId: data.orderId || 'N/A',
        eventId: message._eventId,
        timestamp: message._publishedAt
      });
      
      // Close connection after short delay
      setTimeout(() => {
        channel.close();
        connection.close();
      }, 100);
      
      return true;
    } else {
      console.error(`❌ sendToQueue returned false for ${queueName}`);
      return false;
    }
    
  } catch (error) {
    console.error(`❌ Error publishing to ${queueName}:`, error.message);
    console.error('Error stack:', error.stack);
    return false;
  }
};

// Helper to check RabbitMQ status
export const checkRabbitMQ = async () => {
  try {
    const testConn = await amqplib.connect(RABBITMQ_URL);
    await testConn.close();
    console.log('✅ RabbitMQ is healthy');
    return true;
  } catch (error) {
    console.error('❌ RabbitMQ check failed:', error.message);
    return false;
  }
};