import { createAction, Property } from '@activepieces/pieces-framework';
import { HttpMethod } from '@activepieces/pieces-common';
import { apwfApiRequest, buildResponse, buildErrorResponse } from '../common/api';

function countActions(trigger: any): number {
  let count = 0;
  let current = trigger?.nextAction;
  while (current) {
    count++;
    current = current.nextAction;
  }
  return count;
}

export const getFlow = createAction({
  name: 'get_flow',
  displayName: 'Get Flow',
  description:
    'Get a single flow by its ID with full details including all steps, triggers, actions, and version information.',
  props: {
    flowId: Property.ShortText({
      displayName: 'Flow ID',
      description: 'The ID of the flow to retrieve',
      required: true,
    }),
    versionId: Property.ShortText({
      displayName: 'Version ID',
      description: 'Retrieve a specific version of the flow (optional)',
      required: false,
    }),
  },
  async run(context) {
    const { flowId, versionId } = context.propsValue;
    const organizationId = context.project.orgId || '';

    try {
      const data = await apwfApiRequest({
        method: HttpMethod.GET,
        path: `/v1/flows/${flowId}`,
        organizationId,
        accessToken: context.server.imbraceToken,
        queryParams: {
          versionId: versionId ?? undefined,
        },
      });

      const version = data.version;
      const displayName = version?.displayName || 'Unknown';
      const triggerType = version?.trigger?.type || 'EMPTY';
      const triggerPiece =
        triggerType === 'PIECE_TRIGGER'
          ? ` (${version.trigger.settings?.pieceName || 'unknown piece'})`
          : '';
      const actionCount = countActions(version?.trigger);
      const valid = version?.valid ? 'true' : 'false';
      const state = version?.state || 'DRAFT';

      const nextSteps: string[] = [];
      if (triggerType === 'EMPTY') {
        nextSteps.push(
          'Use "Apply Flow Operation" with UPDATE_TRIGGER to set a trigger for this flow'
        );
        nextSteps.push(
          'Use "List Pieces" to find suitable pieces for the trigger'
        );
      }
      nextSteps.push(
        'Use "Apply Flow Operation" with ADD_ACTION to add steps to this flow'
      );
      if (state === 'DRAFT') {
        nextSteps.push(
          'Use "Apply Flow Operation" with LOCK_AND_PUBLISH to publish this flow when ready'
        );
      }
      if (valid === 'false') {
        nextSteps.push(
          'Flow is not valid. Use "Apply Flow Operation" with UPDATE_ACTION or UPDATE_TRIGGER to fix invalid steps'
        );
      }
      nextSteps.push(
        'Use "List Connections" to check available connections for pieces used in this flow'
      );

      return buildResponse(
        'get_flow',
        data,
        `Flow "${displayName}" (${data.status}, ${state}). Trigger: ${triggerType}${triggerPiece}. Actions: ${actionCount}. Valid: ${valid}.`,
        nextSteps
      );
    } catch (error) {
      return buildErrorResponse('get_flow', error);
    }
  },
});
