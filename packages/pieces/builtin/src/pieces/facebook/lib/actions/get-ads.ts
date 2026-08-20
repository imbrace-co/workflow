import { createAction, Property } from '@activepieces/pieces-framework';
import { facebookGraphCommon } from '../common/common';
import { facebookGraphAuth } from '../..';
import { OAuth2PropertyValue } from '@activepieces/pieces-framework';
import { getAccessTokenOrThrow } from '@activepieces/pieces-common';

export const getAds = createAction({
  auth: facebookGraphAuth,
  name: 'get_ads',
  displayName: 'Get Ads',
  description: 'Get ads from a Facebook Ad Account',
  props: {
    adAccountId: Property.ShortText({
      displayName: 'Ad Account ID',
      description: 'The ID of the ad account (e.g., act_123456789)',
      required: true,
    }),
    limit: Property.Number({
      displayName: 'Limit',
      description: 'The maximum number of ads to retrieve',
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

      const result = await facebookGraphCommon.getAds(accessToken, adAccountId, limit, fields);

      return result;
    } catch (error) {
      console.error('Error in get_ads action:', error);
      throw error;
    }
  },
});
