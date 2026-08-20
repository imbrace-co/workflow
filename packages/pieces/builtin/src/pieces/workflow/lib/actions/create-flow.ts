import { createAction, Property } from '@activepieces/pieces-framework';
import { HttpMethod } from '@activepieces/pieces-common';
import { apwfApiRequest, buildResponse, buildErrorResponse } from '../common/api';

export const createFlow = createAction({
  name: 'create_flow',
  displayName: 'Create Flow',
  description:
    'Create a new empty flow (draft). After creation, use Apply Flow Operation to add triggers, actions, and then publish.',
  props: {
    displayName: Property.ShortText({
      displayName: 'Display Name',
      description: 'The name of the flow',
      required: true,
    }),
    folderId: Property.ShortText({
      displayName: 'Folder ID',
      description: 'Place the flow in a specific folder. Use "List Folders" to find available folder IDs.',
      required: false,
    }),
    folderName: Property.ShortText({
      displayName: 'Folder Name',
      description:
        'Create or use a folder with this name (used if Folder ID is not set)',
      required: false,
    }),
    metadata: Property.Json({
      displayName: 'Metadata',
      description: 'Optional metadata object to attach to the flow',
      required: false,
    }),
  },
  async run(context) {
    const { displayName, folderId, folderName, metadata } =
      context.propsValue;
    const organizationId = context.project.orgId || '';

    try {
      const body: Record<string, unknown> = {
        displayName,
        projectId: context.project.id,
      };
      if (folderId) body['folderId'] = folderId;
      if (folderName) body['folderName'] = folderName;
      if (metadata) body['metadata'] = metadata;

      const data = await apwfApiRequest({
        method: HttpMethod.POST,
        path: '/v1/flows',
        organizationId,
        accessToken: context.server.imbraceToken,
        body,
      });

      const flowId = data.id;

      return buildResponse(
        'create_flow',
        data,
        `Created flow "${displayName}" with id "${flowId}". Status: DISABLED, State: DRAFT.`,
        [
          `Use "Apply Flow Operation" with UPDATE_TRIGGER to set the trigger (flowId: "${flowId}")`,
          `Use "Apply Flow Operation" with ADD_ACTION to add actions (flowId: "${flowId}")`,
          'After adding trigger and actions, use LOCK_AND_PUBLISH to publish the flow',
          'Use "List Pieces" or "Get Piece Details" to find suitable pieces for trigger/actions',
          'Use "List Connections" to check available connections for pieces that require authentication',
        ]
      );
    } catch (error) {
      return buildErrorResponse('create_flow', error);
    }
  },
});
