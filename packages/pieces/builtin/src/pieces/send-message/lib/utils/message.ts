import { outBound, outBoundTopic } from "./kafka/controller";
import { redisExpire, redisHSet } from "./redis/controller";

export async function outboundTextMessage(message: string, conversation_id: string) {
	console.log('<outboundTextMessage>');
	
	// Validate input
	if (!message || message.trim() === '') {
		console.log('<outboundTextMessage> Empty message, skipping send');
		return;
	}

	if (!conversation_id || conversation_id.trim() === '') {
		console.log('<outboundTextMessage> Empty conversation_id, skipping send');
		return;
	}

	const value = JSON.stringify({
		conversation_id,
		type: 'text',
		content: {
			text: message,
		},
	});
	console.log('<outboundTextMessage> outBound value:', value);

	try {
		// Send the message using the new per-message instantiation pattern
		// The controller handles all connection management, retries, and cleanup internally
		await outBound(outBoundTopic, conversation_id, value);
		console.log('<outboundTextMessage> Message sent successfully');
		
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('<outboundTextMessage> Failed to send message:', errorMessage);
		throw error;
	}
}

export async function setRedisHash(
	operation: string,
	hash: string,
	key: string,
	value: string,
	expireTime?: number | undefined,
) {
	console.log(`<${operation}> Start setting up Redis: `, { hash, key, value });
	try {
		const result = await redisHSet(hash, key, value);
		if (expireTime) {
			await redisExpire(hash, expireTime);
		}
		console.log(`<${operation}> [${key}] saved to Redis result: `, result);
	} catch (error) {
		console.log(`<${operation}> Error setting Redis data: ${hash}, $${key}, ${value}: `, error);
	}
}