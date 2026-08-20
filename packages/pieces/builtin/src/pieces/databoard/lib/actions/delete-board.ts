import { createAction, Property } from '@activepieces/pieces-framework';
import { HttpMethod } from '@activepieces/pieces-common';
import { privateApiRequest, buildResponse, buildErrorResponse } from '../common/api';

export const deleteBoard = createAction({
  name: 'delete_board',
  displayName: 'Delete Board',
  description: 'Delete a board by ID. This action is irreversible.',
  props: {
    boardId: Property.ShortText({
      displayName: 'Board ID',
      description: 'The ID of the board to delete',
      required: true,
    }),
  },
  async run(context) {
    const { boardId } = context.propsValue;

    try {
      const data = await privateApiRequest(
        HttpMethod.DELETE,
        `/api/boards/${boardId}`,
      );

      return buildResponse(
        'delete_board',
        data,
        `Deleted board ${boardId}.`,
        [],
      );
    } catch (error) {
      return buildErrorResponse('delete_board', error);
    }
  },
});
