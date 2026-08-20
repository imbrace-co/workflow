import { createAction } from '@activepieces/pieces-framework';
import { facebookGraphCommon, FacebookPageDropdown } from '../common/common';
import { facebookGraphAuth } from '../..';

export const createPost = createAction({
  auth: facebookGraphAuth,
  name: 'create_post',
  displayName: 'Create Page Post',
  description: 'Create a post on a Facebook Page you manage',
  props: {
    page: facebookGraphCommon.page,
    message: facebookGraphCommon.message,
    link: facebookGraphCommon.link,
  },
  async run(context) {
    try {
      const page: FacebookPageDropdown = context.propsValue.page!;

      const result = await facebookGraphCommon.createPost(
        page,
        context.propsValue.message,
        context.propsValue.link
      );

      return result;
    } catch (error) {
      console.error('Error in create_post action:', error);
      throw error;
    }
  },
});
