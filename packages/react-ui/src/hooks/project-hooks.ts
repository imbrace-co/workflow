import {
  useQuery,
  QueryClient,
  useSuspenseQuery,
  useInfiniteQuery,
  InfiniteData,
} from '@tanstack/react-query';
import { HttpStatusCode } from 'axios';
import { t } from 'i18next';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';

import { useEmbedding } from '@/components/embed-provider';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';
import { authenticationSession } from '@/lib/authentication-session';
import { dashboardAutoLogin } from '@/lib/dashboard-auto-login';
import { UpdateProjectPlatformRequest } from '@activepieces/shared';
import {
  ApEdition,
  ApFlagId,
  isNil,
  ProjectWithLimits,
  ProjectWithLimitsWithPlatform,
  SeekPage,
  ListProjectRequestForUserQueryParams,
} from '@activepieces/shared';

import { projectApi } from '../lib/project-api';

import { flagsHooks } from './flags-hooks';

export const projectHooks = {
  useCurrentProject: () => {
    const currentProjectId = authenticationSession.getProjectId();
    const hasExternalAuth = Boolean(
      dashboardAutoLogin.getAccessToken() && dashboardAutoLogin.getOrganizationId(),
    );
    const query = useSuspenseQuery<ProjectWithLimits, Error>({
      queryKey: ['current-project', hasExternalAuth ? currentProjectId ?? 'external' : currentProjectId],
      queryFn: async () => {
        // Under external auth with no JWT project set, resolve the project from server
        if (hasExternalAuth && !currentProjectId) {
          // Use flows to derive the active project, which is guaranteed to be scoped by platform
          const flows = await api.get<any>('/v1/flows', { limit: 1 });
          const projectIdFromFlows: string | null =
            flows.data && flows.data.length > 0 ? flows.data[0].projectId : null;
          if (projectIdFromFlows) {
            return projectApi.get(projectIdFromFlows);
          }
          // If there are no flows yet, fallback to platform projects list
          const project = await projectApi.listForPlatforms();
          // const firstPlatform = platforms[0];
          // const firstProject = firstPlatform?.projects?.[0];
          if (!project) {
            throw new Error('No projects available for current platform');
          }
          return projectApi.get((project as any).id);
        }
        return projectApi.current();
      },
    });
    return {
      ...query,
      project: query.data,
      updateCurrentProject,
      setCurrentProject,
    };
  },
  useProjects: (params?: ListProjectRequestForUserQueryParams) => {
    const { limit = 1000, displayName, cursor, ...restParams } = params || {};
    return useQuery<ProjectWithLimits[], Error>({
      queryKey: ['projects', params],
      queryFn: async () => {
        const results = await projectApi.list({
          cursor,
          limit,
          displayName,
          ...restParams,
        });
        return results.data;
      },
      enabled: !displayName || displayName.length > 0,
    });
  },
  useProjectsInfinite: (limit = 20) => {
    return useInfiniteQuery<
      SeekPage<ProjectWithLimits>,
      Error,
      InfiniteData<SeekPage<ProjectWithLimits>>,
      string[],
      string | undefined
    >({
      queryKey: ['projects-infinite', limit.toString()],
      getNextPageParam: (lastPage: SeekPage<ProjectWithLimits>) => lastPage.next,
      initialPageParam: undefined,
      queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
        projectApi.list({
          cursor: pageParam,
          limit,
        }),
    });
  },
  useProjectsForPlatforms: () => {
    return useQuery<ProjectWithLimitsWithPlatform[], Error>({
      queryKey: ['projects-for-platforms'],
      queryFn: async () => {
        return projectApi.listForPlatforms();
      },
    });
  },
  useReloadPageIfProjectIdChanged: (projectId: string) => {
    const { embedState } = useEmbedding();
    useEffect(() => {
      // Skip project change detection for external auth
      // With external auth, project is auto-resolved from organization and doesn't change
      const hasExternalAuth = Boolean(
        dashboardAutoLogin.getAccessToken() && dashboardAutoLogin.getOrganizationId(),
      );

      if (hasExternalAuth) {
        return; // No-op for external auth
      }

      const handleVisibilityChange = () => {
        const currentProjectId = authenticationSession.getProjectId();
        if (
          currentProjectId !== projectId &&
          document.visibilityState === 'visible' &&
          !embedState.isEmbedded
        ) {
          window.location.reload();
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
        document.removeEventListener(
          'visibilitychange',
          handleVisibilityChange,
        );
      };
    }, [projectId, embedState.isEmbedded]);
  },
  useSwitchToProjectInParams: () => {
    const { projectId: projectIdFromParams } = useParams<{
      projectId: string;
    }>();
    const projectIdFromToken = authenticationSession.getProjectId();
    const { data: edition } = flagsHooks.useFlag<ApEdition>(ApFlagId.EDITION);
    const { toast } = useToast();

    const query = useSuspenseQuery<boolean, Error>({
      //added currentProjectId in case user switches project and goes back to the same project
      queryKey: ['switch-to-project', projectIdFromParams, projectIdFromToken],
      queryFn: async () => {
        if (edition === ApEdition.COMMUNITY) {
          return true;
        }
        if (isNil(projectIdFromParams)) {
          return false;
        }

        // Check if we're using external authentication
        const hasExternalAuth = dashboardAutoLogin.getAccessToken() && dashboardAutoLogin.getOrganizationId();

        if (hasExternalAuth) {
          // For external auth, project context is auto-resolved on backend
          // We just need to validate that the project exists by making an API call
          console.log('useSwitchToProjectInParams: External auth detected, validating project access');
          try {
            // Make a simple API call to validate project access using shared API (adds external headers)
            await api.get<any>('/v1/flows', { limit: 1 });
            console.log('useSwitchToProjectInParams: External auth project validation successful');
            return true;
          } catch (error) {
            console.error('useSwitchToProjectInParams: External auth project validation error:', error);
            return false;
          }
        }

        // For JWT authentication, use the traditional project switching
        try {
          await authenticationSession.switchToProject(projectIdFromParams);
          return true;
        } catch (error) {
          if (
            api.isError(error) &&
            (error.response?.status === HttpStatusCode.BadRequest ||
              error.response?.status === HttpStatusCode.Forbidden)
          ) {
            toast({
              duration: 10000,
              title: t('Invalid Access'),
              description: t(
                'Either the project does not exist or you do not have access to it.',
              ),
            });
          }
          return false;
        }
      },
      retry: false,
      staleTime: 0,
    });

    return {
      projectIdFromParams,
      projectIdFromToken,
      ...query,
    };
  },
};

const updateCurrentProject = async (
  queryClient: QueryClient,
  request: UpdateProjectPlatformRequest,
) => {
  const currentProjectId = authenticationSession.getProjectId();
  queryClient.setQueryData(['current-project', currentProjectId], {
    ...queryClient.getQueryData(['current-project', currentProjectId])!,
    ...request,
  });
};

const setCurrentProject = async (
  queryClient: QueryClient,
  project: ProjectWithLimits,
  pathName?: string,
) => {
  await authenticationSession.switchToProject(project.id);
  queryClient.setQueryData(['current-project'], project);
  if (pathName) {
    const pathNameWithNewProjectId = pathName.replace(
      /\/projects\/\w+/,
      `/projects/${project.id}`,
    );
    window.location.href = pathNameWithNewProjectId;
  }
};
