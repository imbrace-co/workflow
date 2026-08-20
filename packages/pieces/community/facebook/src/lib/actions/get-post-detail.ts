import { createAction, Property } from '@activepieces/pieces-framework';
import { facebookGraphCommon, FacebookPageDropdown } from '../common/common';
import { facebookGraphAuth } from '../..';

export const getPostDetail = createAction({
  auth: facebookGraphAuth,
  name: 'get_post_detail',
  displayName: 'Get Post Detail',
  description: 'Get detailed information about a specific post',
  props: {
    page: facebookGraphCommon.page,
    postId: Property.ShortText({
      displayName: 'Post ID',
      description: 'The ID of the post to retrieve (e.g., 123456789_987654321)',
      required: true,
    }),
    fields: Property.LongText({
      displayName: 'Fields',
      description: 'Comma-separated list of fields to retrieve (optional). Leave empty for default fields.',
      required: false,
    }),
  },
  async run(context) {
    try {
      const page = context.propsValue.page as FacebookPageDropdown;
      const postId = context.propsValue.postId;
      const fields = context.propsValue.fields;

      const result = await facebookGraphCommon.getPostDetail(page, postId, fields);

      return result;
    } catch (error) {
      console.error('Error in get_post_detail action:', error);
      throw error;
    }
  },
});
