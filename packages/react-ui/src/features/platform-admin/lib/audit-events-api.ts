import { api } from '@/lib/api';
import {
  ApplicationEvent,
  ListAuditEventsRequest,
} from '@/lib/ee-types';
import { SeekPage } from '@activepieces/shared';

export const auditEventsApi = {
  list(request: ListAuditEventsRequest) {
    return api.get<SeekPage<ApplicationEvent>>('/v1/audit-events', request);
  },
};
