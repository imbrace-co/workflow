import { api } from '@/lib/api';
import { ListProjectRequestForPlatformQueryParams } from '@activepieces/shared';
import { ProjectWithLimits, SeekPage } from '@activepieces/shared';

export const platformProjectApi = {
  list: async (
    params: ListProjectRequestForPlatformQueryParams,
  ): Promise<SeekPage<ProjectWithLimits>> => {
    return api.get<SeekPage<ProjectWithLimits>>(`/v1/projects`, params);
  },
};
