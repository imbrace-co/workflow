import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { dashboardAutoLogin } from '@/lib/dashboard-auto-login';
import { authenticationSession } from '@/lib/authentication-session';
import { UncategorizedFolderId } from '@activepieces/shared';

import { foldersApi } from './folders-api';
import { createPredefinedFolders } from './folders-utils';

// Use organizationId as query key since project context is auto-resolved from org
const folderListQueryKey = ['folders', dashboardAutoLogin.getOrganizationId()];

export const foldersHooks = {
  folderListQueryKey,

  useFolders: () => {
    const folderQuery = useQuery({
      queryKey: folderListQueryKey,
      queryFn: () => foldersApi.list(),
      staleTime: 5 * 60 * 1000, // 5 minutes - prevent unnecessary refetches
      gcTime: 10 * 60 * 1000, // 10 minutes cache time
    });

    return {
      folders: folderQuery.data,
      isLoading: folderQuery.isLoading,
      refetch: folderQuery.refetch,
    };
  },
  useFolder: (folderId: string) => {
    return useQuery({
      queryKey: ['folder', folderId],
      queryFn: () => foldersApi.get(folderId),
      enabled: folderId !== UncategorizedFolderId,
    });
  },

  useCreatePredefinedFolders: () => {
    const queryClient = useQueryClient();
    
    return useMutation({
      mutationFn: () => createPredefinedFolders(),
      onSuccess: () => {
        // Invalidate and refetch folder list
        queryClient.invalidateQueries({ queryKey: folderListQueryKey });
      },
    });
  },
};
