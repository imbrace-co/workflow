import { createAction, Property } from '@activepieces/pieces-framework';
import { facebookGraphCommon, FacebookPageDropdown } from '../common/common';
import { facebookGraphAuth } from '../..';

export const getPageInsights = createAction({
  auth: facebookGraphAuth,
  name: 'get_page_insights',
  displayName: 'Get Page Insights',
  description: 'Get insights and analytics data for a Facebook Page',
  props: {
    page: facebookGraphCommon.page,
    metric: Property.ShortText({
      displayName: 'Metric',
      description: 'The metrics to retrieve, separated by commas.\n\n' +
        '**Common metrics:** page_post_engagements, page_follows, page_impressions_unique.\n\n' +
        '**Other available metrics:** page_fan_adds_by_paid_non_paid_unique, page_daily_follows, page_daily_follows_unique, page_impressions_paid_unique, page_impressions_viral_unique, page_impressions_nonviral_unique, page_media_view.',
      required: true,
      // Lựa chọn các metric thông dụng và ổn định nhất làm mặc định
      defaultValue: 'page_post_engagements,page_follows,page_impressions_unique',
    }),
    period: Property.StaticDropdown({
      displayName: 'Period',
      description: 'The time period for the insights. Note: Some metrics (like page_fans) require "lifetime".',
      required: true,
      defaultValue: 'day',
      options: {
        options: [
          { label: 'Day', value: 'day' },
          { label: 'Week', value: 'week' },
          { label: 'Days 28', value: 'days_28' },
          { label: 'Lifetime', value: 'lifetime' }, // Đã thêm Lifetime theo yêu cầu của bạn
        ],
      },
    }),
  },
  async run(context) {
    try {
      const page = context.propsValue.page as FacebookPageDropdown;
      // Làm sạch dữ liệu đầu vào: xóa khoảng trắng để tránh lỗi #100
      const metric = context.propsValue.metric.replace(/\s/g, '');
      const period = context.propsValue.period;

      const result = await facebookGraphCommon.getPageInsights(page, metric, period);

      return result;
    } catch (error) {
      console.error('Error in get_page_insights action:', error);
      throw error;
    }
  },
});
