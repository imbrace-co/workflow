import { createAction, Property } from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { WaitingRun, waitingRunScope, waitingRunStoreKey } from '../common/waiting-runs';

export const resumeWaitingRun = createAction({
  name: 'resume_waiting_run',
  displayName: 'Resume Waiting Run',
  description: 'Resume the run that is paused in "Wait for Event" with the same key.',
  props: {
    key: Property.ShortText({
      displayName: 'Key',
      description: 'The key the waiting run used, for example {{trigger.body.request_id}}',
      required: true,
    }),
    data: Property.Json({
      displayName: 'Data',
      description: 'Sent to the waiting run; it appears as "body" in the output of its Wait for Event step.',
      required: false,
      defaultValue: {},
    }),
    failIfNotFound: Property.Checkbox({
      displayName: 'Fail if no run is waiting',
      description: 'Off: the step succeeds with resumed = false.',
      required: false,
      defaultValue: false,
    }),
  },
  async run(context) {
    const { key, data, failIfNotFound } = context.propsValue;
    const storeKey = waitingRunStoreKey(key);

    const waiting = await context.store.get<WaitingRun>(storeKey, waitingRunScope);
    if (!waiting) {
      if (failIfNotFound) {
        throw new Error(`No run is waiting for key "${key}"`);
      }
      return { resumed: false, key };
    }

    // Remove first so a second event with the same key cannot resume the run twice.
    await context.store.delete(storeKey, waitingRunScope);
    await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${context.server.apiUrl}v1/flow-runs/${waiting.runId}/requests/${waiting.requestId}`,
      body: data ?? {},
    });
    return { resumed: true, key, runId: waiting.runId };
  },
});
