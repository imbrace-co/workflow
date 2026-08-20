/* eslint-disable prefer-const */
import {
  Action,
  ActionContext,
  createAction,
  DropdownOption,
  DropdownState,
  InputPropertyMap,
  Property,
  PropertyContext,
} from '@activepieces/pieces-framework';
import { HttpMethod } from '@activepieces/pieces-common';
import { envs, getSortedOptions, imbraceApiRequest } from '../common/api';
import { utcOptions } from '../utils/utcOptions';
import { setWorkflowOutputHistory } from '../utils/workflow';

type Lang = 'English' | 'Traditional Chinese' | 'Simplified Chinese';

type Ctx = {
  auth?: { props?: Record<string, unknown> };
  propsValue?: Record<string, unknown>;
};

const readStr = (
  obj: Record<string, unknown> | undefined,
  key: string
): string | undefined => {
  const v = obj?.[key];
  return typeof v === 'string' ? v : undefined;
};

let cachedImbraceToken: string | undefined;
let cachedOrganizationId: string | undefined;
let cachedCustomProviders: any[] | undefined;
let cachedSystemModels: any[] | undefined;

const SYSTEM_PROVIDER_ID = 'system';

async function ensureOrgId(token?: string): Promise<string | undefined> {
    try {
      const selectedOrg = await imbraceApiRequest<{
        organization_id: string;
      }>(HttpMethod.GET, '/platform/v1/account', undefined, false, token);
      return selectedOrg?.organization_id;
    } catch (e) {
      console.error('Failed to fetch organization:', e);
      return ""
    }
}

async function loadProvidersAndModels(token?: string): Promise<void> {
  const orgId = await ensureOrgId(token);
  if (!orgId) return;

  try {
    const data = await imbraceApiRequest<any[]>(
      HttpMethod.GET,
      `/ai/v3/providers`,
      undefined,
      false,
      token
    );
    cachedCustomProviders = Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('Failed to fetch custom providers:', e);
    cachedCustomProviders = [];
  }

  try {
    const res = await imbraceApiRequest<{ data?: any[] }>(
      HttpMethod.GET,
      `/ai/v3/workflow-agent/models`,
      undefined,
      false,
      token
    );
    cachedSystemModels = res?.data ?? [];
  } catch (e) {
    console.error('Failed to fetch system models:', e);
    cachedSystemModels = [];
  }
}

function getProviderOptions(): DropdownOption<string>[] {
  const options: DropdownOption<string>[] = [
    { label: 'System', value: SYSTEM_PROVIDER_ID },
  ];
  for (const p of cachedCustomProviders ?? []) {
    options.push({ label: p.name, value: p.provider_id });
  }
  return options;
}

function getModelsForProvider(providerId: string): DropdownOption<string>[] {
  if (providerId === SYSTEM_PROVIDER_ID) {
    return (cachedSystemModels ?? [])
      .map((m: any) => ({ label: m.description || m.name, value: m.name }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }
  const provider = (cachedCustomProviders ?? []).find(
    (p: any) => p.provider_id === providerId
  );
  if (!provider?.models) return [];
  return (provider.models as any[])
    .map((m: any) => ({ label: m.description || m.name, value: m.name }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
}

export const documentAiAction: Action = createAction({
  name: 'document_ai',
  displayName: 'Document AI',
  description:
    'Understands a document from a URL and extracts/validates fields; optionally inserts into a Databoard.',
  props: {

    // Vision provider (custom + system)
    visionProvider: Property.Dropdown({
      displayName: 'Vision Provider',
      required: false,
      refreshers: [],
      options: async (
        _propsValue: Record<string, unknown>,
        ctx: PropertyContext
      ): Promise<DropdownState<string>> => {
        cachedImbraceToken = (ctx.server as any)?.imbraceToken as string | undefined;
        await loadProvidersAndModels(cachedImbraceToken);
        return { options: getProviderOptions() };
      },
      defaultValue: SYSTEM_PROVIDER_ID,
    }),

    //  Models (dynamic)
    modelName: Property.Dropdown({
      displayName: 'AI Vision Model Selection',
      required: true,
      refreshers: ['visionProvider'],
      options: async (
        propsValue: Record<string, unknown>,
        ctx: PropertyContext
      ): Promise<DropdownState<string>> => {
        cachedImbraceToken = (ctx.server as any)?.imbraceToken as string | undefined;
        await loadProvidersAndModels(cachedImbraceToken);

        const selectedProvider = (propsValue['visionProvider'] as string) || SYSTEM_PROVIDER_ID;
        const options = getModelsForProvider(selectedProvider);
        return { options };
      },
      defaultValue: 'gpt-4o',
    }),
    additionalDocumentInstructions: Property.LongText({
      displayName: 'Additional Document Extraction Instructions',
      required: false,
      description:
        'Add any special instructions or context for the AI to follow during the document extraction process.',
      defaultValue: '',
    }),
    url: Property.ShortText({
      displayName: 'Input File URL',
      required: false,
      description:
        'http(s) URL to PDF/image to process. Required for single-item mode.',
    }),

    language: Property.StaticDropdown({
      displayName: 'Preferred Language Output',
      required: true,
      options: {
        options: [
          { label: 'English', value: 'English' },
          { label: 'Traditional Chinese', value: 'Traditional Chinese' },
          { label: 'Simplified Chinese', value: 'Simplified Chinese' },
        ],
      },
      defaultValue: 'English',
    }),
    insertToDataboard: Property.Checkbox({
      displayName: 'Insert To Databoard',
      required: false,
      defaultValue: true,
    }),
    boardId: Property.Dropdown({
      displayName: 'Select Board',
      required: false,
      refreshers: ['insertToDataboard'],
      options: async (
        propsValue: Record<string, unknown>,
        ctx: PropertyContext
      ): Promise<DropdownState<string>> => {
        cachedImbraceToken = (ctx.server as any)?.imbraceToken as
          | string
          | undefined;
        // limit=0 → return every board (no pagination cap) so the dropdown
        // lists all boards, not just the first default page.
        const boardData = await imbraceApiRequest<{
          data?: Array<Record<string, any>>;
        }>(
          HttpMethod.GET,
          '/data-board/boards?limit=0',
          undefined,
          false,
          cachedImbraceToken
        );
        const sortedBoard = getSortedOptions(
          boardData?.data ?? [],
          'name',
          '_id',
          'description'
        );
        const options: DropdownOption<string>[] = sortedBoard.map((board) => ({
          label: board.name,
          value: board.value,
        }));
        return { options };
      },
    }),

    // Processing provider (custom + system)
    processingProvider: Property.Dropdown({
      displayName: 'Processing Provider',
      required: false,
      refreshers: [],
      options: async (
        _propsValue: Record<string, unknown>,
        ctx: PropertyContext
      ): Promise<DropdownState<string>> => {
        cachedImbraceToken = (ctx.server as any)?.imbraceToken as string | undefined;
        await loadProvidersAndModels(cachedImbraceToken);
        return { options: getProviderOptions() };
      },
      defaultValue: SYSTEM_PROVIDER_ID,
    }),

    processModelName: Property.Dropdown({
      displayName: 'AI Model Selection (Processing)',
      required: true,
      refreshers: ['processingProvider'],
      options: async (
        propsValue: Record<string, unknown>,
        ctx: PropertyContext
      ): Promise<DropdownState<string>> => {
        cachedImbraceToken = (ctx.server as any)?.imbraceToken as string | undefined;
        await loadProvidersAndModels(cachedImbraceToken);

        const selectedProvider = (propsValue['processingProvider'] as string) || SYSTEM_PROVIDER_ID;
        const options = getModelsForProvider(selectedProvider);
        return { options };
      },
    }),
    additionalInstructions: Property.LongText({
      displayName: 'Custom AI Instructions',
      required: false,
      description:
        'Add any special instructions or context for the AI to follow during the extraction and validation process.',
      defaultValue: '',
    }),
    utc: Property.StaticDropdown<number>({
      displayName: 'Time offset',
      required: true,
      options: {
        options: utcOptions.map((o) => ({ label: o.name, value: o.value })),
      },
      defaultValue: 8,
    }),
    timeout: Property.Number({
      displayName: 'Request Timeout (seconds)',
      description:
        'Timeout per request attempt, in seconds. Increase for large or ' +
        'multi-page PDFs. Retries multiply the total wait, so size this so a ' +
        'single attempt can finish.',
      required: false,
      defaultValue: 900,
    }),
    maxConcurrent: Property.Number({
      displayName: 'Max Concurrent Requests',
      description:
        'Maximum number of concurrent requests to prevent API overload (batch mode only).',
      required: false,
      defaultValue: 3,
    }),
    extractRawData: Property.Checkbox({
      displayName: 'Extract Raw Data',
      required: false,
      defaultValue: false,
    }),
    chunkSize: Property.Number({
      displayName: 'Chunk Size',
      required: false,
      defaultValue: 1,
    }),
    retryFailed: Property.Checkbox({
      displayName: 'Retry Failed Requests',
      required: false,
      defaultValue: true,
    }),
    maxRetries: Property.DynamicProperties({
      displayName: 'Max Retries',
      required: false,
      refreshers: ['retryFailed'],
      props: async (
        propsValue: Record<string, unknown>
      ): Promise<InputPropertyMap> => {
        const retryFailed = propsValue?.['retryFailed'] === true;

        if (!retryFailed) {
          return {};
        }

        return {
          maxRetries: Property.Number({
            displayName: 'Max Retries',
            required: false,
            defaultValue: 2,
          }),
        };
      },
    }),
  },

  async run(ctx: ActionContext) {
    const imbraceToken = cachedImbraceToken || ctx.server.imbraceToken;
    // if (!imbraceToken) {
    //   throw new Error(
    //     'Missing Imbrace token. Please reconnect or refresh the piece.'
    //   );
    // }
    // Update cache with current token
    cachedImbraceToken = imbraceToken;

    // Helper to call the AI doc endpoint
    const callOnce = async (args: {
      organization_id: string;
      url: string;
      language: Lang;
      modelName: string;
      processModelName: string;
      visionProviderId: string;
      processProviderId: string;
      boardId?: string | null;
      additionalInstructions?: string;
      additionalDocumentInstructions?: string;
      extractRawData?: boolean;
      chunkSize?: number;
      utc: number;
      timeoutMs: number;
      token?: string | null;
    }) => {

      let boardInfo;
      if (args.boardId && envs.DOCUMENT_API_VERSION === 'v1') {
        console.log('Fetching board info for boardId:', args.boardId);
        const boardRes = await imbraceApiRequest<{
          data?: { _id: string };
        }>(
          HttpMethod.GET,
          `/v1/organization/${args.organization_id}/boards/${args.boardId}/boardSchema`,
          undefined,
          true,
        );
        boardInfo = boardRes;
      }

      const body = {
        modelName: args.modelName,
        visionProviderId: args.visionProviderId,
        processModelName: args.processModelName,
        processProviderId: args.processProviderId,
        url: args.url,
        language: args.language,
        organizationId: args.organization_id,
        boardId: args.boardId ?? null,
        boardDetails: boardInfo ?? null,
        additionalInstructions: args.additionalInstructions ?? '',
        additionalDocumentInstructions:
          args.additionalDocumentInstructions ?? '',
        // Match your n8n offset behavior (utc - 16)
        utc: args.utc - 16,
        ...(args.extractRawData ? { extractRawData: true, useEnhancedProcessing: false } : {}),
        chunkSize: args.chunkSize ?? 1,
      };

      console.log('body dt: ', body);

      // POST /ai/v3/document (app-gateway → chat-ai; legacy backend retired)
      const endpoint = `/ai/v3/document`;

      const res = await imbraceApiRequest<any>(
        HttpMethod.POST,
        endpoint,
        body,
        false,
        cachedImbraceToken,
        undefined,
        true,
        args.timeoutMs
      );
      return res;
    };

    // Retry wrapper with exponential backoff
    const withRetry = async <T>(
      fn: () => Promise<T>,
      retry: boolean,
      maxRetries: number
    ): Promise<{ ok: true; value: T } | { ok: false; error: any }> => {
      let attempt = 0;
      // Always run at least once
      // eslint-disable-next-line no-constant-condition
      while (true) {
        try {
          const v = await fn();
          return { ok: true, value: v };
        } catch (e) {
          if (!retry || attempt >= maxRetries) {
            return { ok: false, error: e };
          }
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((r) => setTimeout(r, delay));
          attempt++;
        }
      }
    };

    const { propsValue, triggerCtx, project } = ctx;


    // Pull props
    const {
      language,
      modelName,
      processModelName,
      visionProvider,
      processingProvider,
      boardId: boardIdProp,
      additionalInstructions,
      additionalDocumentInstructions,
      utc,
      timeout,
      maxConcurrent,
      extractRawData,
      chunkSize,
      retryFailed,
      maxRetries: maxRetriesProp,
      insertToDataboard,
    } = propsValue as Record<string, any>;

    // Parse source data from trigger
    type Content = {
      text?: string;
      url?: string;
      [key: string]: any;
    };
    type SourceDetails = {
      conversation_id: string;
      position?: string;
      organization_id: string;
      content?: Content;
      from?: string;
      type?: string;
      immediate?: boolean;
      workflow_id?: string;
      config?: any;
    };

    const sourceDetails = triggerCtx as SourceDetails;
    let conversation_id: string | undefined, content: any, from: any, type: any, workflow_id: any, config: any;
    let organization_id: string | undefined = project?.orgId;
    console.log("organization_id: ", organization_id);

    
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

    // Helper function to unwrap dynamic property values
    const getUnwrappedValue = (prop: any, key: string) => {
      return prop?.[key] ?? prop;
    };


    const boardId = insertToDataboard
      ? getUnwrappedValue(boardIdProp, 'boardId')
      : null;

    const maxRetries = getUnwrappedValue(maxRetriesProp, 'maxRetries');

    if (!organization_id) throw new Error('organization_id is required but cannot be found in trigger context or props');

    const nodeName = 'Document AI'; // Action name
    const returnData: { success: any[]; error: any[] } = {
      success: [],
      error: [],
    };

    // Set workflow output history to processing (if conversation_id exists)
    if (conversation_id) {
      await setWorkflowOutputHistory(conversation_id, nodeName, '0');
    }

    // Get items - in Workflow, we process content directly
    const items = Array.isArray(content) ? content : [content];

    // Helper function to create request promise with retry logic
    const createRequestPromise = async (
      itemIndex: number,
      item: any,
      retryCount = 0
    ): Promise<any> => {
      try {
        const itemUrl = item?.url ?? ctx.propsValue['url'];

        if (!itemUrl) {
          throw new Error('URL is required for document processing');
        }




        const response = await withRetry(
          () =>
            callOnce({
              organization_id: organization_id,
              url: itemUrl,
              language: (language ?? 'English') as Lang,
              modelName,
              processModelName: processModelName === 'Default' ? 'gpt-4o' : processModelName,
              visionProviderId: visionProvider || SYSTEM_PROVIDER_ID,
              processProviderId: processingProvider || SYSTEM_PROVIDER_ID,
              boardId: boardId,
              additionalInstructions: additionalInstructions ?? '',
              additionalDocumentInstructions:
                additionalDocumentInstructions ?? '',
              extractRawData: Boolean(extractRawData ?? false),
              chunkSize: Number(chunkSize ?? 1),
              utc: Number(utc ?? 8),
              timeoutMs: Number(timeout ?? 900) * 1000,
              token: cachedImbraceToken,
            }),
          Boolean(retryFailed ?? true),
          Math.max(0, Number(maxRetries ?? 2))
        );

        return { itemIndex, response: response, success: response.ok };
      } catch (error) {
        console.log(
          `[${nodeName}] Request failed for item ${itemIndex}, attempt ${retryCount + 1
          }:`,
          error
        );

        if (retryFailed && retryCount < maxRetries) {
          const delay = Math.pow(2, retryCount) * 1000;
          console.log(
            `[${nodeName}] Retrying item ${itemIndex} in ${delay}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          return createRequestPromise(itemIndex, item, retryCount + 1);
        }

        return { itemIndex, error, success: false };
      }
    };

    // Process items with controlled concurrency
    const maxConcurrentRequests = Math.max(1, Number(maxConcurrent ?? 3));
    const results: any[] = [];
    const totalChunks = Math.ceil(items.length / maxConcurrentRequests);

    console.log(
      `[${nodeName}] Starting processing of ${items.length} items in ${totalChunks} chunks with max ${maxConcurrentRequests} concurrent requests`
    );

    // Process items in chunks to control concurrency
    for (let i = 0; i < items.length; i += maxConcurrentRequests) {
      const chunk = items.slice(i, i + maxConcurrentRequests);
      const chunkPromises = chunk.map((item, index) =>
        createRequestPromise(i + index, item)
      );

      console.log(
        `[${nodeName}] Processing chunk ${Math.floor(i / maxConcurrentRequests) + 1
        }/${Math.ceil(items.length / maxConcurrentRequests)} (${chunk.length
        } items)`
      );

      try {
        const chunkResults = await Promise.all(
          chunkPromises.map((p) =>
            p.catch((error) => ({ status: 'rejected', reason: error }))
          )
        );
        results.push(...chunkResults);
      } catch (error) {
        console.log(`[${nodeName}] Error processing chunk:`, error);
        for (let j = 0; j < chunk.length; j++) {
          results.push({ status: 'rejected', reason: error });
        }
      }
    }

    // Process results
    for (const result of results) {
      const itemIndex = results.indexOf(result);

      if (
        result &&
        typeof result === 'object' &&
        'status' in result &&
        result.status === 'rejected'
      ) {
        // Handle rejected promise
        const handleApiError = async (error: any) => {
          if (conversation_id)
            await setWorkflowOutputHistory(conversation_id, nodeName, '1');
          console.log(`[${nodeName}] Error for item ${itemIndex}:`, error);
          returnData.error.push({
            ...items[itemIndex],
            error,
          });
        };

        await handleApiError({ error: result.reason });
      } else {
        const { response, success, error } = result;

        if (success && response.ok) {
          const resp = response.value;
          // Handle successful response
          if (resp?.data?.fallback === true || !resp?.data) {
            const errorMsg = resp?.data?.fallback
              ? `The AI asked for human assistance: ${resp?.data?.comments}`
              : 'AI needs humans to fill in the form.';

            if (conversation_id)
              await setWorkflowOutputHistory(conversation_id, nodeName, '1');
            console.log(`[${nodeName}] Error for item ${itemIndex}:`, errorMsg);
            returnData.error.push({
              ...items[itemIndex],
              error: { message: errorMsg },
            });
          } else {
            // Success case
            returnData.success.push({
              ...items[itemIndex],
              ...resp,
              from,
              conversation_id,
              config,
              content,
              type,
              workflow_id,
            });
          }
        } else {
          // Handle failed request
          const handleApiError = async (errorObj: any) => {
            if (conversation_id)
              await setWorkflowOutputHistory(conversation_id, nodeName, '1');
            console.log(`[${nodeName}] Error for item ${itemIndex}:`, errorObj);
            returnData.error.push({
              ...items[itemIndex],
              error: errorObj,
            });
          };

          // withRetry failures carry the HttpError on `response.error`; the
          // outer catch path carries it on `error`. Surface status + body so a
          // real downstream error (or a client-side timeout coerced to a
          // bodyless 500) is visible instead of a bare "Request failed".
          const failure =
            response && response.ok === false ? response.error : error;
          await handleApiError({
            status: failure?.response?.status,
            body: failure?.response?.body,
            error: failure?.message || 'Request failed',
          });
        }
      }
    }

    return returnData;
  },
});
