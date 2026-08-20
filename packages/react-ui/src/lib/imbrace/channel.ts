import { api } from '../api';
import webWidgetIcon from '@/assets/channel/web_widget.svg';
import facebookIcon from '@/assets/channel/facebook.svg';
import whatsappIcon from '@/assets/channel/whatsapp.svg';
import lineIcon from '@/assets/channel/line.svg';
import wechatIcon from '@/assets/channel/wechat.svg';
import instagramIcon from '@/assets/channel/instagram.svg';

export type ChannelType = 'web' | 'facebook' | 'whatsapp' | 'instagram' | 'email' | 'wechat' | 'line' | 'store';

export type Channel = {
  id: string;
  name: string;
  type: ChannelType;
  status: 'active' | 'inactive';
  created: string;
  updated: string;
};

export interface ChannelCountType {
  all: number;
  whatsapp: number;
  web: number;
  instagram: number;
  facebook: number;
  store: number;
}


// workflow type
export const DEFAULT_WORKFLOW_TYPE = 'main';
export const CHANNEL_WORKFLOW_TYPE = 'channel';
export const AUTOMATION_WORKFLOW_TYPE = 'automation';
export const PRESET_WORKFLOW_TYPE = 'preset';
export const CHANNEL_AUTOMATION_WORKFLOW_TYPE = 'channelAutomation';
export const BOARD_WORKFLOW_TYPE = 'board';
export const BOARD_AUTOMATION_WORKFLOW_TYPE = 'boardAutomation';

export const CHANNEL_TYPE = [
  { tag: 'email', title: 'Email Starter' },
  { tag: 'facebook', title: 'Facebook Starter' },
  { tag: 'instagram', title: 'Instagram Starter' },
  { tag: 'line', title: 'LINE Starter' },
  { tag: 'web', title: 'Web Widget Starter' },
  { tag: 'wechat', title: 'Wechat Starter' },
  { tag: 'whatsapp', title: 'WhatsApp Starter' },
];

export const CHANNEL_TYPE_OPTIONS = [
  { name: 'Web', icon: webWidgetIcon, id: 'web' },
  { name: 'Facebook', icon: facebookIcon, id: 'facebook' },
  { name: 'WhatsApp', icon: whatsappIcon, id: 'whatsapp' },
  { name: 'Line', icon: lineIcon, id: 'line' },
  { name: 'WeChat', icon: wechatIcon, id: 'wechat' },
  { name: 'Instagram', icon: instagramIcon, id: 'instagram' },
]

export const tags = [
  { "id": "1", "name": "preset" },
  { "id": "61", "name": "automation" },
  { "id": "62", "name": "web" },
  { "id": "63", "name": "facebook" },
  { "id": "64", "name": "whatsapp" },
  { "id": "65", "name": "line" },
  { "id": "66", "name": "wechat" },
  { "id": "68", "name": "instagram" },
  { "id": "69", "name": "email" },
  { "id": "73", "name": "board" },
  { "id": "74", "name": "journey" },
  { "id": "75", "name": "idea" }];

export const VALID_TAGS = [
  'preset',
  'web',
  'mail',
  'wechat',
  'automation',
  'line',
  'whatsapp',
  'facebook',
  'instagram',
  'board',
  'journey',
  'idea',
];


export const checkTagsToSetType = (inputTags: string[], openExistWorkflow?: boolean) => {
  const tags = inputTags.filter((tag) => VALID_TAGS.includes(tag));
  const hasPresetTag = tags.includes(PRESET_WORKFLOW_TYPE);
  const hasAutomationTag = tags.includes(AUTOMATION_WORKFLOW_TYPE);
  const hasBoardTag = tags.includes(BOARD_WORKFLOW_TYPE);
  const findChannelTag = CHANNEL_TYPE.find((channel) => tags.includes(channel.tag));

  let detectedWorkflowType = null;
  let detectedChannelType = null;

  if (hasPresetTag) {
    detectedWorkflowType = PRESET_WORKFLOW_TYPE;
  }
  if (hasAutomationTag && !findChannelTag) {
    detectedWorkflowType = AUTOMATION_WORKFLOW_TYPE;
  }
  if (hasAutomationTag && hasBoardTag) {
    detectedWorkflowType = BOARD_AUTOMATION_WORKFLOW_TYPE;
  }
  if (hasAutomationTag && findChannelTag) {
    detectedWorkflowType = CHANNEL_AUTOMATION_WORKFLOW_TYPE;
    detectedChannelType = findChannelTag.tag as ChannelType;
  }
  // "channel" workflow type won't be set from iframe url
  if (openExistWorkflow && findChannelTag && !hasAutomationTag) {
    detectedWorkflowType = CHANNEL_WORKFLOW_TYPE;
    detectedChannelType = findChannelTag.tag as ChannelType;
  }
  return {
    workflowType: detectedWorkflowType,
    channelType: detectedChannelType
  };
}

export const validateTagList = async (tagList: string[], allTags: string[]) => {
  const validTagList = allTags.filter((tag: string) => tagList.includes(tag)).map((tag: string) => tag);
  if (validTagList.length > 0) {
    return validTagList;
  }
  return [];
}

export const checkTypeWhenCreateWorkflow = async (tagString?: string) => {
  if (tagString) {
    const queryTags = (tagString as string).split(',');
    const { workflowType, channelType } = checkTagsToSetType(queryTags);
    return { workflowType, channelType };
  }
  return { workflowType: null, channelType: null };
}

export type ChannelCount = {
  count: number;
};

export type ConversationCount = {
  count: number;
};

export type FacebookChannel = {
  id: string;
  fbUserId: string;
  pageId: string;
  pageName: string;
  accessToken: string;
};

export type ChannelFileUpload = {
  file: File;
  channelId?: string;
};

export const imbraceChannelApi = {
  async list(channelType: ChannelType): Promise<Channel[]> {
    return api.get<Channel[]>(`/channel-service/v1/channels`, { type: channelType });
  },

  async getById(channelId: string): Promise<Channel> {
    return api.get<Channel>(`/channel-service/v1/channels/${channelId}`);
  },

  async create(request: Partial<Channel>): Promise<Channel> {
    return api.post<Channel>('/channel-service/v1/channels', request);
  },

  async update(channelId: string, request: Partial<Channel>): Promise<Channel> {
    return api.post<Channel>(`/channel-service/v1/channels/${channelId}`, request);
  },

  async delete(channelId: string): Promise<void> {
    return api.delete<void>(`/channel-service/v1/channels/${channelId}`);
  },

  // Count operations
  async getChannelCount(): Promise<ChannelCount> {
    return api.get<ChannelCount>('/channel-service/v1/channels/_count');
  },

  async getConversationCount(): Promise<ConversationCount> {
    return api.get<ConversationCount>('/channel-service/v1/channels/_conv_count');
  },

  // File operations
  async uploadFile(fileData: ChannelFileUpload): Promise<void> {
    const formData = new FormData();
    formData.append('file', fileData.file);
    if (fileData.channelId) {
      formData.append('channelId', fileData.channelId);
    }
    return api.post<void>('/v1/channel-service/v1/channels/_fileupload', formData, undefined, {
      'Content-Type': 'multipart/form-data',
    });
  },

  // Facebook operations
  async getFacebookChannelByUserId(userId: string): Promise<FacebookChannel[]> {
    return api.get<FacebookChannel[]>(`/backend/v1/facebooks`, { fbUserId: userId });
  },

  async createFacebookChannel(request: any): Promise<void> {
    return api.post<void>('/backend/v1/facebook/_auth_pages', request);
  },

  async deleteFacebookChannels(request: any): Promise<void> {
    return api.post<void>('/backend/v1/facebook/_cancel_pages', request);
  },

  async fetchFBPagesWithCredId(credentialId: string): Promise<any> {
    return api.get<any>(`/channel-service/v1/channels/_facebook/credential/${credentialId}`);
  },

  async createFacebook(request: any): Promise<Channel> {
    return api.post<Channel>('/channel-service/v1/channels/_facebook', request);
  },

  async updateFacebook(request: any): Promise<Channel> {
    return api.post<Channel>('/channel-service/v2/channels/_facebook', request);
  },

  // Instagram operations
  async createInstagram(request: any): Promise<Channel> {
    return api.post<Channel>('/channel-service/v1/channels/_instagram', request);
  },

  async createInstagramDirectV2(request: any): Promise<Channel> {
    return api.post<Channel>('/channel-service/v1/channels/_instagramV2', request);
  },

  async updateInstagram(request: any): Promise<Channel> {
    return api.post<Channel>('/channel-service/v1/channels/_instagram', request);
  },

  // Email operations
  async createEmail(request: any): Promise<Channel> {
    return api.post<Channel>('/channel-service/v1/channels/_email', request);
  },

  async createMailChannel(request: any): Promise<Channel> {
    return api.post<Channel>('/backend/v1/mail_channels', request);
  },

  async updateMailChannel(channelId: string, request: any): Promise<Channel> {
    return api.post<Channel>(`/backend/v1/mail_channels/${channelId}`, request);
  },

  // WeChat operations
  async createWechat(request: any): Promise<Channel> {
    return api.post<Channel>('/channel-service/v1/channels/_wechat', request);
  },

  // Line operations
  async createLine(request: any): Promise<Channel> {
    return api.post<Channel>('/channel-service/v1/channels/_line', request);
  },

  // WhatsApp operations
  async createWhatsapp(request: any): Promise<Channel> {
    return api.post<Channel>('/channel-service/v1/channels/_whatsapp', request);
  },

  async createWhatsappV2(request: any): Promise<Channel> {
    return api.post<Channel>('/channel-service/v2/channels/_whatsapp', request);
  },

  async updateWhatsApp(request: any): Promise<Channel> {
    return api.post<Channel>('/channel-service/v2/channels/_whatsapp', request);
  },

  // Web operations
  async createWebWidget(request: any): Promise<Channel> {
    return api.post<Channel>('/channel-service/v1/channels/_web', request);
  },

  // Utility operations
  async initializeNewChannel(request: any): Promise<Channel> {
    return api.post<Channel>('/backend/v1/init_channel', request);
  },

  async replaceChannel(request: any): Promise<void> {
    return api.post<void>('/channel-service/v1/channels/_replace', request);
  },
};