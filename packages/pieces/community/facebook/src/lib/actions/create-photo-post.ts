import { createAction } from '@activepieces/pieces-framework';

import { facebookGraphCommon, FacebookPageDropdown } from '../common/common';
import { facebookGraphAuth } from '../..';

export const createPhotoPost = createAction({
  auth: facebookGraphAuth,

  name: 'create_photo_post',
  displayName: 'Create Page Photo',
  description: 'Create a photo on a Facebook Page you manage',
  props: {
    page: facebookGraphCommon.page,
    photo: facebookGraphCommon.photo,
    caption: facebookGraphCommon.caption,
  },
  async run(context) {
    try {
      const page: FacebookPageDropdown = context.propsValue.page!;

      const result = await facebookGraphCommon.createPhotoPost(
        page,
        context.propsValue.caption,
        context.propsValue.photo
      );

      return result;
    } catch (error) {
      console.error('Error in create_photo_post action:', error);
      throw error;
    }
  },
});
