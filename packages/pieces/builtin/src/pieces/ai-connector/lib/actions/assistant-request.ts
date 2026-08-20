import {
  createAction,
  Property,
  ActionContext,
  PropertyContext,
  DropdownState,
  DropdownOption,
  InputPropertyMap,
} from '@activepieces/pieces-framework';
import { imbraceApiRequest } from '../common/api';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { getAccountAssistantsV2, getAssistantById } from '../common/ai-api';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
import { outboundTextMessage, outboundSuggestionsMessage, setRedisHash } from '../utils/ai-assitant';
dotenv.config({ path: './.env' });
// import { setWorkflowOutputHistory } from '../utils/ai-assitant';

let cachedOrganizationId: string | undefined;

function extractChatResult(raw: string): string {
  const match = raw.match(/<chat_result>([\s\S]*?)<\/chat_result>/);
  return match ? match[1].trim() : raw;
}

export const assistantRequest = createAction({
  // auth: check https://www.activepieces.com/docs/developers/piece-reference/authentication,
  name: 'assistant-request',
  displayName: 'Chat Completion',
  description:
    'Return the response data from AI assistant based on the instruction and setup',
  props: {
    assistant_id: Property.Dropdown({
      displayName: 'Assistant Name',
      required: true,
      refreshers: [],
      options: async (_, ctx) => {
        const imbraceToken = ctx.server.imbraceToken;

        // Cache organization_id so it's always available in run()
        try {
          const selectedOrg = await imbraceApiRequest(
            HttpMethod.GET,
            `/platform/v1/account`,
            {},
            false,
            imbraceToken
          );
          cachedOrganizationId = selectedOrg?.organization_id;
        } catch (e) {
          console.error('Failed to fetch organization:', e);
        }

        const assistants = await imbraceApiRequest(
          HttpMethod.GET,
          '/ai/v3/accounts/assistants?limit=10000',
          {},
          false,
          imbraceToken,
          cachedOrganizationId ? { 'x-organization-id': cachedOrganizationId } : undefined
        );
        console.log('[DEBUG assistant-request] assistants response:', JSON.stringify(assistants));
        if (!assistants) return { disabled: true, options: [] };

        // normalize assistant list
        for (let i = 0; i < assistants.length; i++) {
          assistants[i].mode = assistants[i].mode || 'standard';
          assistants[i].description =
            assistants[i].mode === 'advanced'
              ? 'Advanced Flow AI Assistant'
              : 'Standard Conversation AI Assistant';
        }

        // convert to dropdown format (label/value/description)
        const options = assistants
          .map((a: any) => ({
            label: a.name,
            value: a.assistant_id,
            description: a.description,
          }))
          .sort((a: any, b: any) =>
            a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
          );

        return { disabled: false, options };
      },
    }),
    version: Property.Dropdown({
      displayName: 'API Version',
      required: true,
      refreshers: [],
      options: async () => {
        return {
          disabled: false,
          options: [
            { label: 'v1', value: 'v1' },
            { label: 'v2', value: 'v2' },
          ],
        };
      },
      defaultValue: 'v2',
    }),
    sessionId: Property.ShortText({
      displayName: 'Session ID',
      description:
        'Session identifier for the conversation (v2). If left empty, one is generated automatically (e.g. ca5525f0-f7a5-4b05-971c-e17affdb0a52).',
      required: false,
    }),
    modelName: Property.Dropdown({
      displayName: 'Model',
      required: false,
      refreshers: [],
      defaultValue: 'Default',
      options: async (_, ctx) => {
        const models = await imbraceApiRequest(
          HttpMethod.GET,
          '/ai/v3/workflow-agent/models',
          {},
          false,
          ctx.server.imbraceToken
        );
        if (!models?.data) return { disabled: true, options: [] };

        return {
          disabled: false,
          options: models.data.map((m: any) => ({
            label: m.name,
            value: m.name,
          })),
        };
      },
    }),
    enableCustomPrompt: Property.Checkbox({
      displayName: 'Customized Prompt',
      required: false,
      defaultValue: false,
    }),
    prompt: Property.DynamicProperties({
      displayName: 'Prompt',
      required: false,
      description: 'Prompt to send if custom prompt enabled',
      refreshers: ['enableCustomPrompt'],
      props: (propsValue): any => {
        if (propsValue['enableCustomPrompt']) {
          return {
            prompt: Property.LongText({
              displayName: 'Prompt',
              required: true,
              description: 'Custom prompt to send to the AI assistant',
            }),
          };
        }
        else {
          return {};
        }
      },
    }),
    voiceMessage: Property.Checkbox({
      displayName: 'Allow Voice Message',
      defaultValue: false,
      required: false,
    }),
    enableSuggestions: Property.Checkbox({
      displayName: 'Enable Suggestions',
      description: 'After the AI responds, fetch and send follow-up suggestions',
      required: false,
      defaultValue: false,
    }),
    custom_instructions: Property.LongText({
      displayName: 'Custom Instructions',
      description: 'Additional instructions for suggestions',
      required: false,
    }),
    // Make vendor dynamic so its options depend on whether voice messages are enabled.
    // Example logic: if voiceMessage=false, only allow text vendor(s); if true, include voice-capable vendors.
    vendor: Property.Dropdown({
      displayName: 'Vendor',
      required: false,
      refreshers: ['voiceMessage'],
      options: async (props) => {
        const voice = (props['voiceMessage'] as boolean | undefined);
        if (!voice) {
          return { disabled: true, options: [] };
        }
        const voiceCapableExtras = [
          { label: 'Fano', value: 'fano' },
          { label: 'Google', value: 'google' },
          { label: 'OpenAI', value: 'openai' },
        ];
        const options = voice ? [...voiceCapableExtras] : [];
        return { disabled: false, options };
      },
    }),
    languageCode: Property.Dropdown({
      displayName: 'Language Code',
      required: false,
      defaultValue: 'yue-Hant-HK',
      refreshers: ['voiceMessage', 'vendor'],
      options: async (props) => {
        const voice = (props['voiceMessage'] as boolean | undefined);
        if (!voice) {
          return { disabled: true, options: [] };
        }
        const extendedLanguages = [
          { label: 'English (US)', value: 'en-US' },
          { label: 'Chinese (China)', value: 'cmn-Hans-CN' },
          { label: 'Chinese (Taiwan)', value: 'cmn-Hant-TW' },
          { label: 'Chinese (Taiwan)', value: 'cmn-Hant-TW' },
        ];
        const options = voice ? [...extendedLanguages] : [];
        return { disabled: false, options };
      },
    }),
  },
  async run(ctx: ActionContext) {
    try {
      console.log("<assistant-request> Action started", ctx);
      const { propsValue, triggerCtx, project } = ctx;
      const { modelName, assistant_id, enableCustomPrompt, prompt, languageCode, vendor, enableSuggestions, custom_instructions, version, sessionId,
      } = propsValue;

      type Content = {
        text?: string;
        [key: string]: any;
      };
      type SourceDetails = {
        conversation_id: string;
        position?: string;
        organization_id?: string;
        content?: Content;
        from?: string;
        type?: string;
        immediate?: boolean;
        workflow_id?: string;
        config?: any;
        user_id?: string;
        id?: string;
      };

      const sourceDetails = triggerCtx as SourceDetails;
      let conversation_id: string | undefined, content: any, from: any, type: any, workflow_id: any, config: any;
      const organization_id: string | undefined = project?.orgId;

      if (!sourceDetails) {
        console.error("No body found in source");
      } else {
        ({
          conversation_id,
          content,
          from,
          type,
          workflow_id,
          config,
        } = sourceDetails);
      }

      // Legacy backend retired: AI calls go via the app-gateway (/ai/v3/*) and
      // the org access token comes from platform-service. Mint it up front — the
      // gateway requires it (incl. the assistant lookup below).
      const baseUri = process.env['IMBRACE_API_DOMAIN'] || 'https://app-gateway.dev.imbrace.co';
      const platformUri = process.env['PLATFORM_SERVICE_API'] || 'http://platform.dev.imbrace.lan'

      if (!organization_id) throw new Error('organization_id is required but cannot be found in trigger context or props');

      let accessToken = '';
      try {
        const accessResponse = await fetch(`${platformUri}/v1/access`, {
          method: 'GET',
          headers: { 'x-organization-id': organization_id },
        });
        accessToken = ((await accessResponse.json()) as any)?.token || '';
      } catch (e) {
        console.error('Failed to fetch access token:', e);
      }

      const assistants = await getAccountAssistantsV2(organization_id as string, accessToken);
      // console.debug('Fetched assistants for organization', { organization_id, count: assistants?.length ?? 0 });
      const assistant = await getAssistantById(
        assistants,
        assistant_id as string
      );
      if (!assistant) throw new Error('Assistant not found');

      const sendMessage = assistant['mode'] === 'advanced' ? false : true;
      const { streaming = false } = assistant;
      let text: string | undefined
      if (enableCustomPrompt && prompt) {
        text = prompt['prompt'];
      }
      else {
        text = content?.text ?? content?.payload;
      }
      // AI response message
      let message;

      if (typeof text !== 'string') {
        return { error: 'Invalid text input' };
      }

      if (streaming) {
        const rejectMsg = 'Streaming mode is enabled, skipping immediate message sending'
        console.log(rejectMsg);
        return rejectMsg
      } else {
        if (version === 'v2') {
          console.debug('Using v2 API for assistant request', { assistant_id, organization_id, text,ctx });
          // accessToken already minted above via platform-service /v1/access.
          let userId='';

          const v2BaseUrl = process.env['MESSAGE_SUGGESTION_API'] || 'https://nextbestaction.sandbox.imbrace.co';

          // Resolve session id: use the provided prop, else fall back to the
          // conversation id when present, else generate one.
          const resolvedSessionId =
            typeof sessionId === 'string' && sessionId.trim()
              ? sessionId.trim()
              : conversation_id || randomUUID();

          try {
            const authUserResponse = await fetch(`${v2BaseUrl}/api/chat-client/auth/user`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Access-Token': accessToken,
              },
              body: JSON.stringify({}),
            });
            console.log('Auth user response status:', authUserResponse.status);
            const authUserData = await authUserResponse.json();
            userId = authUserData?.id || '';
          } catch (e) {
            console.error('Failed to fetch auth user:', e);
          }
          const v2Response = await fetch(`${v2BaseUrl}/api/v2/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-access-token': accessToken,
              'x-organization-id': organization_id || '',
            },
            body: JSON.stringify({
              id: resolvedSessionId,
              session_id: resolvedSessionId,
              messages: [{ role: 'user', content: [{ type: 'text', text }] }],
              user_id: userId,
              assistant_id,
              organization_id,
              from_connector: true
            }),
          });

          const responseText = await v2Response.text();
          // Parse AI SDK v5 UI Message Stream (SSE): each event line starts with
          // "data: " and contains JSON with a `type` field. Concatenate every
          // `text-delta.delta` to reconstruct the AI's full text response.
          let fullText = '';
          for (const line of responseText.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;
            try {
              const evt = JSON.parse(payload);
              if (evt?.type === 'text-delta' && typeof evt.delta === 'string') {
                fullText += evt.delta;
              }
            } catch { /* skip malformed chunks */ }
          }
          const rawText = fullText || responseText;
          message = extractChatResult(rawText);

          if (sendMessage && conversation_id) {
            let suggestions: string[] | undefined;

            if (enableSuggestions) {
              try {
                const suggestionsResponse = await httpClient.sendRequest({
                  method: HttpMethod.POST,
                  url: `${baseUri}/ai/v3/suggestions`,
                  body: {
                    thread_id: conversation_id,
                    assistant_id: assistant_id,
                    custom_instructions: typeof custom_instructions === 'string' ? custom_instructions : '',
                  },
                  headers: {
                    'Content-Type': 'application/json',
                    'X-Access-Token': accessToken,
                    'x-organization-id': organization_id,
                  },
                });
                ({ suggestions } = suggestionsResponse.body);
              } catch (error) {
                console.error('<assistant-request v2> Suggestions API failed (non-fatal):', error);
              }
            }

            await outboundTextMessage(message, conversation_id);

            if (suggestions?.length) {
              await outboundSuggestionsMessage(suggestions, conversation_id);
            }

            await setRedisHash('removeWorkflowPosition', conversation_id, 'position', '');
          }
        } else {
        const bodyAi = {
          text,
          thread_id: conversation_id,
          assistant_id,
          file_ids: [],
          secret: '擁抱科技',
          role: 'user',
          model: modelName,
          streaming: false,
        };

        const response = await httpClient.sendRequest({
          method: HttpMethod.POST,
          url: `${baseUri}/ai/v3/rag/answer_question`,
          body: bodyAi,
          headers: {
            'Content-Type': 'application/json',
            'X-Access-Token': accessToken,
            'x-organization-id': organization_id,
          },
        });
        message = response.body.message;
        // console.debug('AI Response:', message);

        if (sendMessage && conversation_id) {
          // Fetch suggestions first (before any Kafka sends) so all messages are sent back-to-back
          let follow_up_message: string | undefined;
          let suggestions: string[] | undefined;

          if (enableSuggestions) {
            try {
              const suggestionsResponse = await httpClient.sendRequest({
                method: HttpMethod.POST,
                url: `${baseUri}/ai/v3/suggestions`,
                body: {
                  thread_id: conversation_id,
                  assistant_id: assistant_id,
                  custom_instructions: typeof custom_instructions === 'string' ? custom_instructions : '',
                },
                headers: {
                  'Content-Type': 'application/json',
                  'X-Access-Token': accessToken,
                  'x-organization-id': organization_id,
                },
              });
              ({ follow_up_message, suggestions } = suggestionsResponse.body);
            } catch (error) {
              console.error('<assistant-request> Suggestions API failed (non-fatal):', error);
            }
          }

          // Send all Kafka messages back-to-back for smooth UX
          await outboundTextMessage(message, conversation_id);

          // if (follow_up_message) {
          //   await outboundTextMessage(follow_up_message, conversation_id);
          // }

          if (suggestions?.length) {
            await outboundSuggestionsMessage(suggestions, conversation_id);
          }

          await setRedisHash('removeWorkflowPosition', conversation_id, 'position', '');
        }
        return message;
      }
      return message;
      }
    } catch (error) {
      console.error("Error in assistant request action:", error);
      throw error;
    }
  },
});
