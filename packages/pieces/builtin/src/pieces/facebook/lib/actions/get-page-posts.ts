import { createAction, Property } from '@activepieces/pieces-framework';
import { facebookGraphCommon, FacebookPageDropdown } from '../common/common';
import { facebookGraphAuth } from '../..';

export const getPagePosts = createAction({
  auth: facebookGraphAuth,
  name: 'get_page_posts',
  displayName: 'Get Page Posts',
  description: 'Retrieve posts from a Facebook Page',
  props: {
    page: facebookGraphCommon.page,
    limit: Property.Number({
      displayName: 'Limit',
      description: 'Maximum number of posts to retrieve (default: 25)',
      required: false,
      defaultValue: 25,
    }),
    fields: Property.LongText({
      displayName: 'Custom Fields (Optional)',
      description: 'Leave empty for safe defaults (id, message, story, created_time, permalink_url, type, from). Note: aggregated fields (reactions, comments, shares, attachments) are deprecated in /feed endpoint. To get engagement data, query individual posts via their IDs.',
      required: false,
    }),
  },
  async run(context) {
    try {
      const page = context.propsValue.page as FacebookPageDropdown;
      const limit = context.propsValue.limit || 25;
      const fields = context.propsValue.fields;

      const result = await facebookGraphCommon.getPagePosts(
        page,
        limit,
        fields
      );

      return result;
    } catch (error) {
      console.error('Error in get_page_posts action:', error);
      throw error;
    }
  },
});
