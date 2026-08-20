import { createAction } from '@activepieces/pieces-framework';
import { FacebookPageDropdown, facebookGraphCommon } from '../common/common';
import { facebookGraphAuth } from '../..';

export const createVideoPost = createAction({
  auth: facebookGraphAuth,
  name: 'create_video_post',
  displayName: 'Create Page Video',
  description: 'Create a video on a Facebook Page you manage',
  props: {
    page: facebookGraphCommon.page,
    video: facebookGraphCommon.video,
    title: facebookGraphCommon.title,
    description: facebookGraphCommon.description,
  },
  async run(context) {
    try {
      const page: FacebookPageDropdown = context.propsValue.page!;

      const result = await facebookGraphCommon.createVideoPost(
        page,
        context.propsValue.title,
        context.propsValue.description,
        context.propsValue.video
      );

      return result;
    } catch (error) {
      console.error('Error in create_video_post action:', error);
      throw error;
    }
  },
});
