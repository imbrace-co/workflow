import { outBound, outBoundTopic, ensureConnection, producer, run } from "./kafka/controller";
import { redisExpire, redisHSet } from "./redis";
import * as constants from '../../constants';
// import { redisExpire, redisHSet } from "./redis/controller";

// export async function setWorkflowOutputHistory(
// 	conversation_id: string,
// 	nodeName: string,
// 	output_index: string,
// ): Promise<void> {
// 	// await setRedisHash('setWorkflowOutputHistory', conversation_id, nodeName, output_index);
// }

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
export function languageConfig(getParam: Function, config?: string): string {
	console.log(`<languageConfig> with: `, { getParam, config });
	const lang = [];
	for (let i = 0; i < 2; i++) {
		try {
			lang[i] = getParam(`multilang.lang[${i}].language`, 0);
		} catch (err) {
			if (err) lang[i] = 'Does not exist';
		}
	}
	console.log('<languageConfig> languages: ', lang);
	let langParam = '';
	switch (config) {
		case lang[0]:
			langParam = 'multilang.lang[0]';
			break;
		case lang[1]:
			langParam = 'multilang.lang[1]';
			break;
		default:
			break;
	}
	console.log('<languageConfig> langParam: ', langParam);
	return langParam;
}

export async function assignTeam(conversation_id: string, team_id: string, user_id?: string) {
	console.log('<assignTeam>');

	const value = JSON.stringify({
		conversation_id,
		team_id,
		user_id,
	});

	try {
		await outBound(constants.teamAssignTopic, conversation_id, value);
		await producer.disconnect();
	} catch (error) {
		console.log(`<assignTeam> Error: `, error);
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.log(`<assignTeam> Error message:`, errorMessage);
		if (errorMessage.includes('producer is disconnected')) {
			await run()
				.then(async () => await outBound(constants.teamAssignTopic, conversation_id, value))
				.catch((e) => console.debug(e));
		}
	}
}

export async function finishWorkflow(conversation_id: string, nodeName: string) {
	const json = {
		nodeName,
		done: true,
	};
	await setRedisHash('finishWorkflow', conversation_id, 'position', JSON.stringify(json));
}
