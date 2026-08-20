import { KafkaClient } from "./kafka";

export const outBoundTopic = 'WORKFLOW.NEW_MESSAGE';

// Singleton instance to prevent multiple connections
let kafkaInstance: KafkaClient | null = null;

const getKafkaInstance = (): KafkaClient => {
	if (!kafkaInstance) {
		console.log('[Kafka] Creating new KafkaClient instance');
		kafkaInstance = new KafkaClient();
	}
	return kafkaInstance;
};

const kafka = getKafkaInstance();
export const producer = kafka.producer;

let isConnected = false;

export const outBound = async (topic: string, key: string, value: string) => {
	// Ensure connection before sending
	if (!isConnected) {
		await ensureConnection();
	}

	try {
		await producer.send({
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
		// Reset connection status to retry on next call
		isConnected = false;
		
		// If it's a rebalancing error, we can retry once after a brief delay
		if (error instanceof Error && error.message.includes('rebalancing')) {
			console.log('[Kafka] Detected rebalancing error, retrying after delay...');
			await new Promise(resolve => setTimeout(resolve, 1000));
			
			try {
				await ensureConnection();
				await producer.send({
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
				return;
			} catch (retryError) {
				console.error('[Kafka] Retry failed:', retryError);
			}
		}
		
		throw error;
	}
};

export const ensureConnection = async (): Promise<void> => {
	if (isConnected) {
		return;
	}

	try {
		console.log('[Kafka] Ensuring connection...');
		await kafka.run();
		isConnected = true;
		console.log('[Kafka] Connection established');
	} catch (error) {
		console.error('[Kafka] Failed to establish connection:', error);
		isConnected = false;
		
		// If the error is related to consumer groups, log additional info
		if (error instanceof Error && error.message.includes('rebalancing')) {
			console.warn('[Kafka] Connection failed due to rebalancing. This might indicate consumer group conflicts.');
		}
		
		throw error;
	}
};

export const run = async () => {
	return ensureConnection();
};

export const disconnect = async () => {
	try {
		if (isConnected && producer) {
			await producer.disconnect();
			isConnected = false;
			console.log('[Kafka] Producer disconnected');
		}
	} catch (error) {
		console.error('[Kafka] Error disconnecting producer:', error);
	}
};

// Initialize connection but don't fail if it doesn't work
// This allows the module to load even if Kafka is not available
(async () => {
	try {
		await ensureConnection();
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.warn('[Kafka] Initial connection failed, will retry on first use:', errorMessage);
	}
})();