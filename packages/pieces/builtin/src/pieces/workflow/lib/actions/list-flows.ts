import { createAction, Property } from '@activepieces/pieces-framework';
import { HttpMethod } from '@activepieces/pieces-common';
import { apwfApiRequest, buildResponse, buildErrorResponse } from '../common/api';

export const listFlows = createAction({
  name: 'list_flows',
  displayName: 'List Flows',
  description:
    'List all flows in the current project. Returns a paginated list with metadata, triggers, and status. Supports filtering by status, name, and folder.',
  props: {
    limit: Property.Number({
      displayName: 'Limit',
      description: 'Maximum number of flows to return per page',
      required: false,
      defaultValue: 10,
    }),
    cursor: Property.ShortText({
      displayName: 'Cursor',
      description: 'Pagination cursor from a previous response',
      required: false,
    }),
    status: Property.StaticDropdown({
      displayName: 'Status',
      description: 'Filter flows by status',
      required: false,
      options: {
        options: [
          { label: 'Enabled', value: 'ENABLED' },
          { label: 'Disabled', value: 'DISABLED' },
        ],
      },
    }),
    name: Property.ShortText({
      displayName: 'Name',
      description: 'Filter flows by name (partial match)',
      required: false,
    }),
    folderId: Property.ShortText({
      displayName: 'Folder ID',
      description: 'Filter flows by folder',
      required: false,
    }),
  },
  async run(context) {
    const { limit, cursor, status, name, folderId } = context.propsValue;
    const organizationId = context.project.orgId || '';

    try {
      const data = await apwfApiRequest({
        method: HttpMethod.GET,
        path: '/v1/flows',
        organizationId,
        accessToken: context.server.imbraceToken,
        queryParams: {
          projectId: context.project.id,
          limit: limit?.toString(),
          cursor: cursor ?? undefined,
          status: status ?? undefined,
          name: name ?? undefined,
          folderId: folderId ?? undefined,
        },
      });

      const flows = data.data || [];
      const enabledCount = flows.filter(
        (f: any) => f.status === 'ENABLED'
      ).length;
      const disabledCount = flows.filter(
        (f: any) => f.status === 'DISABLED'
      ).length;

      const nextSteps: string[] = [];
      if (flows.length > 0) {
        nextSteps.push(
          'Use "Get Flow" with a flowId to see full trigger and action details'
        );
        nextSteps.push(
          'Use "Apply Flow Operation" to modify any of the returned flows'
        );
      }
      if (data.next) {
        nextSteps.push(
          `Use cursor "${data.next}" to fetch the next page of results`
        );
      }
      if (flows.length === 0) {
        nextSteps.push('Use "Create Flow" to create a new flow');
      }

      return buildResponse(
        'list_flows',
        data,
        `Found ${flows.length} flow(s) (${enabledCount} enabled, ${disabledCount} disabled).${data.next ? ' More pages available.' : ''}`,
        nextSteps
      );
    } catch (error) {
      return buildErrorResponse('list_flows', error);
    }
  },
});
