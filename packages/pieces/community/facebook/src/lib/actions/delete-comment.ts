import { createAction, Property } from '@activepieces/pieces-framework';
import { facebookGraphCommon, FacebookPageDropdown } from '../common/common';
import { facebookGraphAuth } from '../..';

export const deleteComment = createAction({
  auth: facebookGraphAuth,
  name: 'delete_comment',
  displayName: 'Delete Comment',
  description: 'Delete a comment from Facebook',
  props: {
    page: facebookGraphCommon.page,
    commentId: Property.ShortText({
      displayName: 'Comment ID',
      description: 'The ID of the comment to delete',
      required: true,
    }),
  },
  async run(context) {
    try {
      const page = context.propsValue.page as FacebookPageDropdown;
      const commentId = context.propsValue.commentId;

      const result = await facebookGraphCommon.deleteComment(page, commentId);

      return result;
    } catch (error) {
      console.error('Error in delete_comment action:', error);
      throw error;
    }
  },
});
