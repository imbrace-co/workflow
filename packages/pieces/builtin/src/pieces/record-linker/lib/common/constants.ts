export const hiddenFieldTypes = {
  identifier: ['Notes', 'Attachment'],
  createAction: [] as string[],
  otherAction: ['Notes'],
};

export const originalSources = [
  { label: 'Web Widget', value: 'channel_web' },
  { label: 'Facebook', value: 'channel_facebook' },
  { label: 'WhatsApp', value: 'channel_whatsapp' },
  { label: 'Instagram', value: 'channel_instagram' },
  { label: 'WeChat', value: 'channel_wechat' },
  { label: 'LINE', value: 'channel_line' },
  { label: 'Business Contact Collector', value: 'journey_business_contact_collector' },
  { label: 'Form Management', value: 'journey_form_management' },
  { label: 'Facebook Social Media Management', value: 'journey_facebook_social_media_management' },
  { label: 'Facebook Leads Management', value: 'journey_facebook_leads_management' },
  { label: 'Customized Original Sources', value: 'customized_sources' },
  { label: 'Other', value: 'customized_other' },
];

export const versionOptions = [
  { label: 'Version 1', value: '1' },
  { label: 'Version 2', value: '2' },
] as const;

export const actionOptions = [
  { label: 'Create a record', value: 'create' },
  { label: 'Update fields', value: 'update' },
  { label: 'Delete a record', value: 'deleteRecord' },
  { label: 'Clear fields', value: 'clearFields' },
  { label: 'Get all records', value: 'getAll' },
  { label: 'Get single record', value: 'search' },
  { label: 'Get board details', value: 'getBoardDetails' },
] as const;
