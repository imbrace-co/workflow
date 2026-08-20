import { createAction, Property } from '@activepieces/pieces-framework';
import { facebookGraphCommon, FacebookPageDropdown } from '../common/common';
import { facebookGraphAuth } from '../..';

export const deletePagePost = createAction({
  auth: facebookGraphAuth,
  name: 'delete_page_post',
  displayName: 'Delete Page Post',
  description: 'Delete a post from a Facebook Page',
  props: {
    page: facebookGraphCommon.page,
    postId: Property.ShortText({
      displayName: 'Post ID',
      description: 'The ID of the post to delete (e.g., 123456789_987654321)',
      required: true,
    }),
  },
  async run(context) {
    try {
      const page = context.propsValue.page as FacebookPageDropdown;
      const postId = context.propsValue.postId;

      const result = await facebookGraphCommon.deletePost(page, postId);

      return result;
    } catch (error) {
      console.error('Error in delete_page_post action:', error);
      throw error;
    }
  },
});
