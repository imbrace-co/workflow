import { createAction, Property } from '@activepieces/pieces-framework';
import { ExecutionType, PauseType } from '@activepieces/shared';
import { parseResumeUrl, WaitingRun, waitingRunScope, waitingRunStoreKey } from '../common/waiting-runs';

export const waitForEvent = createAction({
  name: 'wait_for_event',
  displayName: 'Wait for Event',
  description:
    'Pause this run until another flow calls "Resume Waiting Run" with the same key.',
  props: {
    markdown: Property.MarkDown({
      value:
        'The run waits without polling and survives restarts. Use a key that identifies this case, for example an order or request id. If another run is already waiting on the same key, this run replaces it.',
    }),
    key: Property.ShortText({
      displayName: 'Key',
      description: 'Correlation key, for example {{trigger.body.request_id}}',
      required: true,
    }),
  },
  errorHandlingOptions: {
    continueOnFailure: { hide: true },
    retryOnFailure: { hide: true },
  },
  async run(context) {
    const storeKey = waitingRunStoreKey(context.propsValue.key);

    if (context.executionType === ExecutionType.BEGIN) {
      const waiting = parseResumeUrl(context.generateResumeUrl({ queryParams: {} }));
      await context.store.put<WaitingRun>(storeKey, waiting, waitingRunScope);
      context.run.pause({
        pauseMetadata: {
          type: PauseType.WEBHOOK,
          response: {},
        },
      });
      return { key: context.propsValue.key, waiting: true };
    }

    // Normally "Resume Waiting Run" already removed the entry; only clean up if it is still ours.
    const entry = await context.store.get<WaitingRun>(storeKey, waitingRunScope);
    if (entry?.runId === context.run.id) {
      await context.store.delete(storeKey, waitingRunScope);
    }
    return {
      key: context.propsValue.key,
      body: context.resumePayload.body,
      queryParams: context.resumePayload.queryParams,
    };
  },
});
