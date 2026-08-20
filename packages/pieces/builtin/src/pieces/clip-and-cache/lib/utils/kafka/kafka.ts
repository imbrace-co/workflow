import { Kafka, KafkaConfig, SASLMechanism, Producer } from 'kafkajs';
import dotenv from 'dotenv';
import { generateAuthToken } from 'aws-msk-iam-sasl-signer-js';

dotenv.config({ path: './.env' });
interface IKafkaHelper {
	clientId: string;
	brokers: string[];
	kafkaUseSASL: string;
	kafkaSSL: boolean;
	kafkaMechanism: string;
	kafkaSASLUser: string;
	kafkaSASLPass: string;
	kafka: Kafka;
	producer: Producer;
	run: () => void;
}

export class KafkaClient implements IKafkaHelper {
	clientId: string;

	brokers: string[];

	kafkaUseSASL: string;

	kafkaSSL: boolean;

	kafkaMechanism: SASLMechanism = 'plain';

	kafkaSASLUser: string = '';

	kafkaSASLPass: string = '';

	kafka: IKafkaHelper['kafka'];

	producer: IKafkaHelper['producer'];

	constructor() {
		// Generate a unique client ID for each instance to avoid conflicts
		const baseClientId = process.env?.['KAFKA_CLIENT_ID'] ?? 'activepieces-producer';
		const timestamp = Date.now();
		const randomSuffix = Math.random().toString(36).substring(2, 8);
		this.clientId = `${baseClientId}-${timestamp}-${randomSuffix}`;

		console.log(`Kafka env config:`, process.env);

		this.brokers = (process.env?.['KAFKA_ENDPOINT'] ?? '').split(',');

		this.kafkaUseSASL = process.env?.['KAFKA_USE_SASL'] ?? 'true';

		this.kafkaSSL = process.env?.['KAFKA_USE_SSL'] === 'true';

		const rejectUnAuth = process.env?.['KAFKA_SSL_REJECT_UNAUTHORIZED'] === 'true' ? true : false;

		this.kafkaMechanism = (process.env?.['KAFKA_SASL_MECHANISM'] as SASLMechanism) ?? 'plain';

		this.kafkaSASLUser = process.env?.['KAFKA_SASL_USERNAME'] ?? '';

		this.kafkaSASLPass = process.env?.['KAFKA_SASL_PASSWORD'] ?? '';

		const kafkaAWSRegion = process.env?.['KAFKA_AWS_REGION'] ?? 'ap-east-1';
		const isAWSKafka = process.env?.['KAFKA_IS_AWS_KAFKA'] === 'true';

	let kafkaConfig: KafkaConfig = {
			clientId: this.clientId,
			brokers: this.brokers,
			connectionTimeout: 3000,
			requestTimeout: 30000,
		};

		// Add SSL configuration (using logic from KafkaController)
		if (this.kafkaSSL) {
			if (!rejectUnAuth) {
				kafkaConfig.ssl = {
					rejectUnauthorized: false,
				}
			}
			else {
				kafkaConfig.ssl = true
			}
		}

		// Add SASL configuration if enabled (using logic from KafkaController)
		if (this.kafkaUseSASL === 'true') {
			if (!(this.kafkaSASLUser && this.kafkaSASLPass)) {
				throw new Error(
					'Kafka SASL is activated but no username and password got defined. Please set KAFKA_SASL_USERNAME and KAFKA_SASL_PASSWORD environment variables.',
				)
			}
			kafkaConfig.sasl = {
				username: this.kafkaSASLUser,
				password: this.kafkaSASLPass,
				mechanism: this.kafkaMechanism as any,
			}
		}

		this.kafka = new Kafka(kafkaConfig);

		if (isAWSKafka) {
			this.kafka = new Kafka({
				clientId: this.clientId,
				brokers: this.brokers,
				ssl: true,
				sasl: {
					mechanism: 'oauthbearer',
					oauthBearerProvider: () => this.oauthBearerTokenProvider(kafkaAWSRegion),
				},
			});
		}



		// Configure producer optimized for short-lived connections
		this.producer = this.kafka.producer({
			maxInFlightRequests: 1,
			idempotent: false,
			transactionTimeout: 30000,
			allowAutoTopicCreation: false,
			// Optimize for quick connection and disconnection
			metadataMaxAge: 300000, // 5 minutes
			retry: {
				initialRetryTime: 100,
				retries: 3,
				maxRetryTime: 5000,
			},
		});

		// Add minimal error handlers (reduce logging noise for many short-lived connections)
		this.producer.on('producer.connect', () => {
			console.log(`[Kafka] Producer ${this.clientId} connected`);
		});

		this.producer.on('producer.disconnect', () => {
			console.log(`[Kafka] Producer ${this.clientId} disconnected`);
		});

		this.producer.on('producer.network.request_timeout', (payload) => {
			console.warn('[Kafka] Producer request timeout:', payload);
		});
	}

	async oauthBearerTokenProvider(region: string) {
		try {
			// Uses AWS Default Credentials Provider Chain to fetch credentials
			const authTokenResponse = await generateAuthToken({
				region, logger: console,
				awsDebugCreds: true
			});
			console.log('======= AWS Kafka authTokenResponse:', authTokenResponse);
			return {
				value: authTokenResponse.token
			};
		} catch (error) {
			console.error('Failed to generate AWS Kafka auth token:', error);
			throw error;
		}
	}

	async run(): Promise<void> {
		await this.producer.connect();
	}
}

