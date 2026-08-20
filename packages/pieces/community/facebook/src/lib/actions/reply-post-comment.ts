import { createAction, Property } from '@activepieces/pieces-framework';
import { facebookGraphCommon, FacebookPageDropdown } from '../common/common';
import { facebookGraphAuth } from '../..';

export const replyPostComment = createAction({
  auth: facebookGraphAuth,
  name: 'reply_post_comment',
  displayName: 'Reply to Post Comment',
  description: 'Reply to a comment on a Facebook post',
  props: {
    page: facebookGraphCommon.page,
    commentId: Property.ShortText({
      displayName: 'Comment ID',
      description: 'The ID of the comment to reply to',
      required: true,
    }),
    message: Property.LongText({
      displayName: 'Reply Message',
      description: 'The message content of your reply',
      required: true,
    }),
  },
  async run(context) {
    try {
      const page = context.propsValue.page as FacebookPageDropdown;
      const commentId = context.propsValue.commentId;
      const message = context.propsValue.message;

      const result = await facebookGraphCommon.replyToComment(page, commentId, message);

      return result;
    } catch (error) {
      console.error('Error in reply_post_comment action:', error);
      throw error;
    }
  },
});
