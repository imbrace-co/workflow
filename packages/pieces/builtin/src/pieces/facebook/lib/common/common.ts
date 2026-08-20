import {
  HttpMethod,
  httpClient,
  getAccessTokenOrThrow,
} from '@activepieces/pieces-common';
import { OAuth2PropertyValue, Property } from '@activepieces/pieces-framework';

export const facebookGraphCommon = {
  baseUrl: 'https://graph.facebook.com/v24.0',

  page: Property.Dropdown<FacebookPageDropdown>({
    displayName: 'Page',
    required: true,
    refreshers: [],
    options: async ({ auth }) => {
      if (!auth) {
        return {
          disabled: true,
          options: [],
          placeholder: 'Connect your account',
        };
      }

      try {
        const accessToken: string = getAccessTokenOrThrow(
          auth as OAuth2PropertyValue
        );
        const pages: any[] = (
          await facebookGraphCommon.getPages(accessToken)
        ).map((page: FacebookPage) => {
          return {
            label: page.name,
            value: {
              id: page.id,
              accessToken: page.access_token,
            },
          };
        });

        return {
          options: pages,
          placeholder: 'Choose a page',
        };
      } catch (e) {
        console.debug(e);
        return {
          disabled: true,
          options: [],
          placeholder: 'Connect your account',
        };
      }
    },
  }),

  message: Property.LongText({
    displayName: 'Message',
    required: true,
  }),
  link: Property.ShortText({
    displayName: 'Link',
    required: false,
  }),

  caption: Property.LongText({
    displayName: 'Caption',
    required: false,
  }),
  photo: Property.ShortText({
    displayName: 'Photo',
    description: 'A URL we can access for the photo',
    required: true,
  }),

  title: Property.ShortText({
    displayName: 'Title',
    required: false,
  }),
  description: Property.LongText({
    displayName: 'Description',
    required: false,
  }),
  video: Property.ShortText({
    displayName: 'Video',
    description: 'A URL we can access for the video (Limit: 1GB or 20 minutes)',
    required: true,
  }),

  getPages: async (accessToken: string) => {
    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${facebookGraphCommon.baseUrl}/me/accounts?access_token=${accessToken}`,
    });

    return response.body.data;
  },

  createPost: async (
    page: FacebookPageDropdown,
    message: string,
    link: string | undefined
  ) => {
    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${facebookGraphCommon.baseUrl}/${page.id}/feed`,
      body: {
        access_token: page.accessToken,
        message: message,
        link: link,
      },
    });
    return response.body;
  },
  createPhotoPost: async (
    page: FacebookPageDropdown,
    caption: string | undefined,
    photo: string
  ) => {
    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${facebookGraphCommon.baseUrl}/${page.id}/photos`,
      body: {
        access_token: page.accessToken,
        url: photo,
        caption: caption,
      },
    });

    return response.body;
  },

  createVideoPost: async (
    page: FacebookPageDropdown,
    title: string | undefined,
    description: string | undefined,
    video: string
  ) => {
    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${facebookGraphCommon.baseUrl}/${page.id}/videos`,
      body: {
        access_token: page.accessToken,
        title: title,
        description: description,
        file_url: video,
      },
    });

    return response.body;
  },

  getPageInfo: async (page: FacebookPageDropdown) => {
    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${facebookGraphCommon.baseUrl}/${page.id}`,
      queryParams: {
        access_token: page.accessToken,
        fields: 'id,name,about,category,category_list,followers_count,fan_count,website,phone,emails,location,link,username,picture',
      },
    });

    return response.body;
  },

getPagePosts: async (
    page: FacebookPageDropdown,
    limit: number,
    fields?: string
  ) => {
    const defaultFields = 'id,message,created_time,story';

    const fieldsToUse = fields || defaultFields;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${facebookGraphCommon.baseUrl}/${page.id}/feed`,
      queryParams: {
        access_token: page.accessToken,
        limit: limit.toString(),
        fields: fieldsToUse,
      },
    });

    return response.body;
  },

  deletePost: async (page: FacebookPageDropdown, postId: string) => {
    const response = await httpClient.sendRequest({
      method: HttpMethod.DELETE,
      url: `${facebookGraphCommon.baseUrl}/${postId}`,
      queryParams: {
        access_token: page.accessToken,
      },
    });

    return response.body;
  },

  getPostDetail: async (page: FacebookPageDropdown, postId: string, fields?: string) => {
    const defaultFields = 'id,message,created_time,story,from,to,permalink_url,likes.summary(true),comments.summary(true),shares';
    const fieldsToUse = fields || defaultFields;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${facebookGraphCommon.baseUrl}/${postId}`,
      queryParams: {
        access_token: page.accessToken,
        fields: fieldsToUse,
      },
    });

    return response.body;
  },

  getPostComments: async (page: FacebookPageDropdown, postId: string, limit: number) => {
    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${facebookGraphCommon.baseUrl}/${postId}/comments`,
      queryParams: {
        access_token: page.accessToken,
        limit: limit.toString(),
        fields: 'id,from,message,created_time,like_count,comment_count',
      },
    });

    return response.body;
  },

  replyToComment: async (page: FacebookPageDropdown, commentId: string, message: string) => {
    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${facebookGraphCommon.baseUrl}/${commentId}/comments`,
      body: {
        access_token: page.accessToken,
        message: message,
      },
    });

    return response.body;
  },

  likePost: async (page: FacebookPageDropdown, postId: string) => {
    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${facebookGraphCommon.baseUrl}/${postId}/likes`,
      body: {
        access_token: page.accessToken,
      },
    });

    return response.body;
  },

  likeComment: async (page: FacebookPageDropdown, commentId: string) => {
    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${facebookGraphCommon.baseUrl}/${commentId}/likes`,
      body: {
        access_token: page.accessToken,
      },
    });

    return response.body;
  },

  deleteComment: async (page: FacebookPageDropdown, commentId: string) => {
    const response = await httpClient.sendRequest({
      method: HttpMethod.DELETE,
      url: `${facebookGraphCommon.baseUrl}/${commentId}`,
      queryParams: {
        access_token: page.accessToken,
      },
    });

    return response.body;
  },

  getPageConversations: async (page: FacebookPageDropdown, limit: number) => {
    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${facebookGraphCommon.baseUrl}/${page.id}/conversations`,
      queryParams: {
        access_token: page.accessToken,
        limit: limit.toString(),
        fields: 'id,link,updated_time,message_count,unread_count,participants',
      },
    });

    return response.body;
  },

  getConversationMessages: async (page: FacebookPageDropdown, conversationId: string, limit: number) => {
    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${facebookGraphCommon.baseUrl}/${conversationId}/messages`,
      queryParams: {
        access_token: page.accessToken,
        limit: limit.toString(),
        fields: 'id,from,message,created_time,to',
      },
    });

    return response.body;
  },

  sendPageMessage: async (page: FacebookPageDropdown, recipientId: string, message: string) => {
    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${facebookGraphCommon.baseUrl}/${page.id}/messages`,
      body: {
        access_token: page.accessToken,
        recipient: {
          id: recipientId,
        },
        message: {
          text: message,
        },
      },
    });

    return response.body;
  },

  getPageInsights: async (page: FacebookPageDropdown, metric: string, period: string) => {
    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${facebookGraphCommon.baseUrl}/${page.id}/insights`,
      queryParams: {
        access_token: page.accessToken,
        metric: metric,
        period: period,
      },
    });

    return response.body;
  },

  getPostInsights: async (page: FacebookPageDropdown, postId: string, metric: string) => {
    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${facebookGraphCommon.baseUrl}/${postId}/insights`,
      queryParams: {
        access_token: page.accessToken,
        metric: metric,
      },
    });

    return response.body;
  },

  getAdCampaigns: async (accessToken: string, adAccountId: string, limit: number, fields?: string) => {
    const defaultFields = 'id,name,status,objective,created_time,start_time,stop_time,daily_budget,lifetime_budget';
    const fieldsToUse = fields || defaultFields;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${facebookGraphCommon.baseUrl}/${adAccountId}/campaigns`,
      queryParams: {
        access_token: accessToken,
        limit: limit.toString(),
        fields: fieldsToUse,
      },
    });

    return response.body;
  },

  getAdSets: async (accessToken: string, adAccountId: string, limit: number, fields?: string) => {
    const defaultFields = 'id,name,status,campaign_id,created_time,start_time,end_time,daily_budget,lifetime_budget,targeting';
    const fieldsToUse = fields || defaultFields;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${facebookGraphCommon.baseUrl}/${adAccountId}/adsets`,
      queryParams: {
        access_token: accessToken,
        limit: limit.toString(),
        fields: fieldsToUse,
      },
    });

    return response.body;
  },

  getAds: async (accessToken: string, adAccountId: string, limit: number, fields?: string) => {
    const defaultFields = 'id,name,status,adset_id,campaign_id,created_time,creative';
    const fieldsToUse = fields || defaultFields;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${facebookGraphCommon.baseUrl}/${adAccountId}/ads`,
      queryParams: {
        access_token: accessToken,
        limit: limit.toString(),
        fields: fieldsToUse,
      },
    });

    return response.body;
  },

  getUserProfile: async (accessToken: string, fields?: string) => {
    const defaultFields = 'id,name,email,first_name,last_name,picture';
    const fieldsToUse = fields || defaultFields;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${facebookGraphCommon.baseUrl}/me`,
      queryParams: {
        access_token: accessToken,
        fields: fieldsToUse,
      },
    });

    return response.body;
  },

  getUserPages: async (accessToken: string, limit: number, fields?: string) => {
    const defaultFields = 'id,name,access_token,category,tasks,fan_count';
    const fieldsToUse = fields || defaultFields;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${facebookGraphCommon.baseUrl}/me/accounts`,
      queryParams: {
        access_token: accessToken,
        limit: limit.toString(),
        fields: fieldsToUse,
      },
    });

    return response.body;
  },

  initVideoUpload: async (
    page: FacebookPageDropdown,
    fileSize: number,
    title?: string,
    description?: string
  ) => {
    const body: any = {
      access_token: page.accessToken,
      upload_phase: 'start',
      file_size: fileSize,
    };

    if (title) body.title = title;
    if (description) body.description = description;

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${facebookGraphCommon.baseUrl}/${page.id}/videos`,
      body: body,
    });

    return response.body;
  },

  uploadVideoChunk: async (
    page: FacebookPageDropdown,
    videoId: string,
    uploadSessionId: string,
    startOffset: number,
    videoFileChunkUrl: string
  ) => {
    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${facebookGraphCommon.baseUrl}/${videoId}`,
      body: {
        access_token: page.accessToken,
        upload_phase: 'transfer',
        upload_session_id: uploadSessionId,
        start_offset: startOffset,
        video_file_chunk: videoFileChunkUrl,
      },
    });

    return response.body;
  },

  cancelVideoUpload: async (
    page: FacebookPageDropdown,
    videoId: string,
    uploadSessionId: string
  ) => {
    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${facebookGraphCommon.baseUrl}/${videoId}`,
      body: {
        access_token: page.accessToken,
        upload_phase: 'cancel',
        upload_session_id: uploadSessionId,
      },
    });

    return response.body;
  },
};

export interface FacebookPage {
  id: string;
  name: string;
  category: string;
  category_list: string[];
  access_token: string;
  tasks: string[];
}

export interface FacebookPageDropdown {
  id: string;
  accessToken: string;
}
