import { createAction, Property } from '@activepieces/pieces-framework';
import { HttpMethod } from '@activepieces/pieces-common';
import { apwfApiRequest, buildResponse, buildErrorResponse } from '../common/api';

export const deleteFlow = createAction({
  name: 'delete_flow',
  displayName: 'Delete Flow',
  description:
    'Permanently delete a flow by its ID. This action cannot be undone.',
  props: {
    flowId: Property.ShortText({
      displayName: 'Flow ID',
      description: 'The ID of the flow to delete',
      required: true,
    }),
  },
  async run(context) {
    const { flowId } = context.propsValue;
    const organizationId = context.project.orgId || '';

    try {
      await apwfApiRequest({
        method: HttpMethod.DELETE,
        path: `/v1/flows/${flowId}`,
        organizationId,
        accessToken: context.server.imbraceToken,
      });

      return buildResponse(
        'delete_flow',
        { flowId },
        `Flow "${flowId}" has been permanently deleted.`,
        [
          'Use "List Flows" to see remaining flows',
          'Use "Create Flow" to create a new flow',
        ]
      );
    } catch (error) {
      return buildErrorResponse('delete_flow', error);
    }
  },
});
