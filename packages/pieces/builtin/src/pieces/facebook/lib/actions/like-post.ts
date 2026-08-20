import { createAction, Property } from '@activepieces/pieces-framework';
import { facebookGraphCommon, FacebookPageDropdown } from '../common/common';
import { facebookGraphAuth } from '../..';

export const likePost = createAction({
  auth: facebookGraphAuth,
  name: 'like_post',
  displayName: 'Like Post',
  description: 'Like a post on Facebook',
  props: {
    page: facebookGraphCommon.page,
    postId: Property.ShortText({
      displayName: 'Post ID',
      description: 'The ID of the post to like (e.g., 123456789_987654321)',
      required: true,
    }),
  },
  async run(context) {
    try {
      const page = context.propsValue.page as FacebookPageDropdown;
      const postId = context.propsValue.postId;

      const result = await facebookGraphCommon.likePost(page, postId);

      return result;
    } catch (error) {
      console.error('Error in like_post action:', error);
      throw error;
    }
  },
});
