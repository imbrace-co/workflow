import { createAction, Property } from '@activepieces/pieces-framework';
import { facebookGraphCommon, FacebookPageDropdown } from '../common/common';
import { facebookGraphAuth } from '../..';

export const likeComment = createAction({
  auth: facebookGraphAuth,
  name: 'like_comment',
  displayName: 'Like Comment',
  description: 'Like a comment on Facebook',
  props: {
    page: facebookGraphCommon.page,
    commentId: Property.ShortText({
      displayName: 'Comment ID',
      description: 'The ID of the comment to like',
      required: true,
    }),
  },
  async run(context) {
    try {
      const page = context.propsValue.page as FacebookPageDropdown;
      const commentId = context.propsValue.commentId;

      const result = await facebookGraphCommon.likeComment(page, commentId);

      return result;
    } catch (error) {
      console.error('Error in like_comment action:', error);
      throw error;
    }
  },
});
