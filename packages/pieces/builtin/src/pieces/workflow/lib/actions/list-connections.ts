import { createAction, Property } from '@activepieces/pieces-framework';
import { HttpMethod } from '@activepieces/pieces-common';
import { apwfApiRequest, buildResponse, buildErrorResponse } from '../common/api';

export const listConnections = createAction({
  name: 'list_connections',
  displayName: 'List Connections',
  description:
    'List available connections (credentials) for the current project. Filter by piece name to find connections for a specific integration. When a piece requires authentication, use this to find an existing connection or instruct the user to create one.',
  props: {
    pieceName: Property.ShortText({
      displayName: 'Piece Name',
      description:
        'Filter connections for a specific piece (e.g., @activepieces/piece-gmail)',
      required: false,
    }),
    status: Property.StaticDropdown({
      displayName: 'Status',
      description: 'Filter connections by status',
      required: false,
      options: {
        options: [
          { label: 'Active', value: 'ACTIVE' },
          { label: 'Missing', value: 'MISSING' },
          { label: 'Error', value: 'ERROR' },
        ],
      },
    }),
    limit: Property.Number({
      displayName: 'Limit',
      description: 'Maximum number of connections to return',
      required: false,
      defaultValue: 10,
    }),
    cursor: Property.ShortText({
      displayName: 'Cursor',
      description: 'Pagination cursor from a previous response',
      required: false,
    }),
  },
  async run(context) {
    const { pieceName, status, limit, cursor } = context.propsValue;
    const organizationId = context.project.orgId || '';

    try {
      const data = await apwfApiRequest({
        method: HttpMethod.GET,
        path: '/v1/app-connections',
        organizationId,
        accessToken: context.server.imbraceToken,
        queryParams: {
          projectId: context.project.id,
          pieceName: pieceName ?? undefined,
          status: status ?? undefined,
          limit: limit?.toString(),
          cursor: cursor ?? undefined,
        },
      });

      const connections = data.data || [];
      const activeConns = connections.filter(
        (c: any) => c.status === 'ACTIVE'
      );
      const pieceNote = pieceName ? ` for "${pieceName}"` : '';

      const connSummaries = connections
        .slice(0, 5)
        .map((c: any) => `"${c.displayName}" (${c.status})`)
        .join(', ');

      const nextSteps: string[] = [];

      if (activeConns.length > 0) {
        const firstActive = activeConns[0];
        nextSteps.push(
          `Use connection id "${firstActive.id}" (name: "${firstActive.displayName}") in the piece settings when calling "Apply Flow Operation" with ADD_ACTION or UPDATE_TRIGGER`
        );
        if (activeConns.length > 1) {
          nextSteps.push(
            `${activeConns.length} active connections available. Choose the most appropriate one for the user's needs.`
          );
        }
      } else {
        nextSteps.push(
          `No active connections found${pieceNote}. Instruct the user to add a connection${pieceName ? ` for "${pieceName}"` : ''} in Settings > Connections before proceeding.`
        );
        nextSteps.push(
          'After the user adds a connection, call "List Connections" again to verify.'
        );
      }

      if (data.next) {
        nextSteps.push(
          `Use cursor "${data.next}" to fetch the next page of connections`
        );
      }

      return buildResponse(
        'list_connections',
        data,
        `Found ${connections.length} connection(s)${pieceNote}: ${connSummaries || 'none'}. ${activeConns.length} active connection(s) available.`,
        nextSteps
      );
    } catch (error) {
      return buildErrorResponse('list_connections', error);
    }
  },
});
