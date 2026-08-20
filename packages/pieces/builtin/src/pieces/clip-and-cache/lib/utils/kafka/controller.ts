import { KafkaClient } from "./kafka";

export const outBoundTopic = 'WORKFLOW.NEW_MESSAGE';

/**
 * Send a message to Kafka topic using a new client/producer instance per message.
 * This approach prevents "Closed connection" errors that occur with singleton patterns.
 */
export const outBound = async (topic: string, key: string, value: string) => {
	let kafkaClient: KafkaClient | null = null;
	
	try {
		console.log(`[Kafka] Creating new client instance for message to topic: ${topic}`);
		
		// Create a new Kafka client and producer for this message
		kafkaClient = new KafkaClient();
		
		// Connect the producer
		await kafkaClient.run();
		console.log('[Kafka] Producer connected successfully');
		
		// Send the message
		await kafkaClient.producer.send({
			topic,
			messages: [
				{
					headers: {},
					key,
					value,
				},
			],
		});
		
		console.log(`[Kafka] Message sent successfully to topic: ${topic}`);
		
	} catch (error) {
		console.error('[Kafka] Error sending message:', error);
		
		// If it's a rebalancing error, we can retry once after a brief delay
		if (error instanceof Error && error.message.includes('rebalancing')) {
			console.log('[Kafka] Detected rebalancing error, retrying with new client after delay...');
			await new Promise(resolve => setTimeout(resolve, 1000));
			
			try {
				// Disconnect the failed client first
				if (kafkaClient) {
					try {
						await kafkaClient.producer.disconnect();
					} catch (disconnectError) {
						console.warn('[Kafka] Error disconnecting failed client:', disconnectError);
					}
				}
				
				// Create a completely new client for retry
				kafkaClient = new KafkaClient();
				await kafkaClient.run();
				
				await kafkaClient.producer.send({
					topic,
					messages: [
						{
							headers: {},
							key,
							value,
						},
					],
				});
				console.log(`[Kafka] Retry successful for topic: ${topic}`);
				
			} catch (retryError) {
				console.error('[Kafka] Retry failed:', retryError);
				throw retryError;
			}
		} else {
			throw error;
		}
		
	} finally {
		// Always disconnect the producer to clean up resources
		if (kafkaClient) {
			try {
				await kafkaClient.producer.disconnect();
				console.log('[Kafka] Producer disconnected and cleaned up');
			} catch (disconnectError) {
				console.warn('[Kafka] Error during producer cleanup:', disconnectError);
			}
		}
	}
};

/**
 * Legacy compatibility function - now creates a new client for testing connectivity
 */
export const ensureConnection = async (): Promise<void> => {
	let testClient: KafkaClient | null = null;
	
	try {
		console.log('[Kafka] Testing connection with new client...');
		testClient = new KafkaClient();
		await testClient.run();
		console.log('[Kafka] Connection test successful');
	} catch (error) {
		console.error('[Kafka] Connection test failed:', error);
		
		// If the error is related to consumer groups, log additional info
		if (error instanceof Error && error.message.includes('rebalancing')) {
			console.warn('[Kafka] Connection failed due to rebalancing. This might indicate consumer group conflicts.');
		}
		
		throw error;
	} finally {
		// Clean up test client
		if (testClient) {
			try {
				await testClient.producer.disconnect();
			} catch (disconnectError) {
				console.warn('[Kafka] Error disconnecting test client:', disconnectError);
			}
		}
	}
};

/**
 * Legacy compatibility function
 */
export const run = async () => {
	return ensureConnection();
};

/**
 * Legacy compatibility function - no-op since we don't maintain persistent connections
 */
export const disconnect = async () => {
	console.log('[Kafka] disconnect() called - no persistent connections to clean up');
};