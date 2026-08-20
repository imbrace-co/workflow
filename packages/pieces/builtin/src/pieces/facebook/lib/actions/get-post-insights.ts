import { createAction, Property } from '@activepieces/pieces-framework';
import { facebookGraphCommon, FacebookPageDropdown } from '../common/common';
import { facebookGraphAuth } from '../..';

export const getPostInsights = createAction({
  auth: facebookGraphAuth,
  name: 'get_post_insights',
  displayName: 'Get Post Insights',
  description: 'Get insights and analytics data for a specific Facebook post',
  props: {
    page: facebookGraphCommon.page,
    postId: Property.ShortText({
      displayName: 'Post ID',
      description: 'The ID of the post (Format: PageID_PostID). Example: 61587801366414_123456789',
      required: true,
    }),
    metric: Property.ShortText({
      displayName: 'Metric',
      description: 'The metrics to retrieve, separated by commas.\n\n' +
        '**Recommended:** post_impressions_unique, post_clicks, post_reactions_by_type_total.\n\n' +
        '**Engagement:** post_responses_by_type_total, post_media_view, post_impressions_fan_unique.',
      required: true,
      // Đã thay post_impressions bằng post_impressions_unique theo yêu cầu
      defaultValue: 'post_impressions_unique,post_clicks,post_reactions_by_type_total',
    }),
  },
  async run(context) {
    try {
      const page = context.propsValue.page as FacebookPageDropdown;
      const postId = context.propsValue.postId.trim();
      // Xóa khoảng trắng để tránh lỗi cú pháp #100
      const metric = context.propsValue.metric.replace(/\s/g, '');

      const result = await facebookGraphCommon.getPostInsights(page, postId, metric);

      return result;
    } catch (error) {
      console.error('Error in get_post_insights action:', error);
      throw error;
    }
  },
});
