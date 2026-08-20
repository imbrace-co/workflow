import { createAction, Property } from '@activepieces/pieces-framework';
import { facebookGraphCommon } from '../common/common';
import { facebookGraphAuth } from '../..';
import { OAuth2PropertyValue } from '@activepieces/pieces-framework';
import { getAccessTokenOrThrow } from '@activepieces/pieces-common';

export const getAdCampaigns = createAction({
  auth: facebookGraphAuth,
  name: 'get_ad_campaigns',
  displayName: 'Get Ad Campaigns',
  description: 'Get ad campaigns from a Facebook Ad Account',
  props: {
    adAccountId: Property.ShortText({
      displayName: 'Ad Account ID',
      description: 'The ID of the ad account (e.g., act_123456789)',
      required: true,
    }),
    limit: Property.Number({
      displayName: 'Limit',
      description: 'The maximum number of campaigns to retrieve',
      required: false,
      defaultValue: 25,
    }),
    fields: Property.LongText({
      displayName: 'Fields',
      description: 'Optional comma-separated list of fields to retrieve',
      required: false,
    }),
  },
  async run(context) {
    try {
      const accessToken = getAccessTokenOrThrow(context.auth as OAuth2PropertyValue);
      const adAccountId = context.propsValue.adAccountId;
      const limit = context.propsValue.limit || 25;
      const fields = context.propsValue.fields;

      const result = await facebookGraphCommon.getAdCampaigns(accessToken, adAccountId, limit, fields);

      return result;
    } catch (error) {
      console.error('Error in get_ad_campaigns action:', error);
      throw error;
    }
  },
});
