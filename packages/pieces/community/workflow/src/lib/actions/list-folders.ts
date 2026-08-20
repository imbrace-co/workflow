import { createAction, Property } from '@activepieces/pieces-framework';
import { HttpMethod } from '@activepieces/pieces-common';
import { apwfApiRequest, buildResponse, buildErrorResponse } from '../common/api';

export const listFolders = createAction({
  name: 'list_folders',
  displayName: 'List Folders',
  description:
    'List available folders for organizing flows. Use folder IDs when creating flows or moving flows to folders via "Apply Flow Operation" with CHANGE_FOLDER.',
  props: {
    limit: Property.Number({
      displayName: 'Limit',
      description: 'Maximum number of folders to return',
      required: false,
      defaultValue: 100,
    }),
    cursor: Property.ShortText({
      displayName: 'Cursor',
      description: 'Pagination cursor from a previous response',
      required: false,
    }),
  },
  async run(context) {
    const { limit, cursor } = context.propsValue;
    const organizationId = context.project.orgId || '';

    try {
      const data = await apwfApiRequest({
        method: HttpMethod.GET,
        path: '/v1/folders',
        organizationId,
        accessToken: context.server.imbraceToken,
        queryParams: {
          projectId: context.project.id,
          limit: limit?.toString(),
          cursor: cursor ?? undefined,
        },
      });

      const folders = data.data || [];
      const folderSummaries = folders
        .slice(0, 10)
        .map((f: any) => `"${f.displayName}" (${f.numberOfFlows} flows)`)
        .join(', ');

      const nextSteps: string[] = [];

      if (folders.length > 0) {
        const first = folders[0];
        nextSteps.push(
          `Use folder id "${first.id}" (name: "${first.displayName}") when calling "Create Flow" or "Apply Flow Operation" with CHANGE_FOLDER`
        );
      } else {
        nextSteps.push(
          'No folders found. When creating a flow, use the folderName property to automatically create a new folder.'
        );
      }

      if (data.next) {
        nextSteps.push(
          `Use cursor "${data.next}" to fetch the next page of folders`
        );
      }

      return buildResponse(
        'list_folders',
        data,
        `Found ${folders.length} folder(s): ${folderSummaries || 'none'}.`,
        nextSteps
      );
    } catch (error) {
      return buildErrorResponse('list_folders', error);
    }
  },
});
