import { createAction, Property } from '@activepieces/pieces-framework';
import { facebookGraphCommon, FacebookPageDropdown } from '../common/common';
import { facebookGraphAuth } from '../..';

export const getPostComments = createAction({
  auth: facebookGraphAuth,
  name: 'get_post_comments',
  displayName: 'Get Post Comments',
  description: 'Get comments on a Facebook post',
  props: {
    page: facebookGraphCommon.page,
    postId: Property.ShortText({
      displayName: 'Post ID',
      description: 'The ID of the post to get comments from (e.g., 123456789_987654321)',
      required: true,
    }),
    limit: Property.Number({
      displayName: 'Limit',
      description: 'Number of comments to retrieve (default: 25)',
      required: false,
      defaultValue: 25,
    }),
  },
  async run(context) {
    try {
      const page = context.propsValue.page as FacebookPageDropdown;
      const postId = context.propsValue.postId;
      const limit = context.propsValue.limit || 25;

      const result = await facebookGraphCommon.getPostComments(page, postId, limit);

      return result;
    } catch (error) {
      console.error('Error in get_post_comments action:', error);
      throw error;
    }
  },
});
