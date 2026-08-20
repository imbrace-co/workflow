import React, { useEffect, useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';

import { useAuthorization } from '@/hooks/authorization-hooks';
import { projectHooks } from '@/hooks/project-hooks';
import {
  FROM_QUERY_PARAM,
  useDefaultRedirectPath,
} from '@/lib/navigation-utils';
import { determineDefaultRoute } from '@/lib/utils';
import { isNil } from '@activepieces/shared';

import { LoadingScreen } from '../../components/ui/loading-screen';
import { authenticationSession } from '../../lib/authentication-session';
import { dashboardAutoLogin } from '../../lib/dashboard-auto-login';
import { AllowOnlyLoggedInUserOnlyGuard } from '../components/allow-logged-in-user-only-guard';
import { api } from '@/lib/api';

export const TokenCheckerWrapper: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const {
    isError,
    error,
    data: isProjectValid,
    projectIdFromParams,
    isLoading,
    isFetching,
  } = projectHooks.useSwitchToProjectInParams();

  const { checkAccess } = useAuthorization();

  if (isNil(projectIdFromParams)) {
    console.log('TokenCheckerWrapper: No project ID in params, redirecting to sign-in');
    return <Navigate to="/sign-in" replace />;
  }
  const failedToSwitchToProject =
    !isProjectValid && !isNil(projectIdFromParams);
  if (failedToSwitchToProject) {
    console.log('TokenCheckerWrapper: Failed to switch to project, redirecting');
    const defaultRoute = determineDefaultRoute(checkAccess);
    return <Navigate to={defaultRoute} replace />;
  }
  if (isError || !isProjectValid) {
    console.log('TokenCheckerWrapper: Project validation failed, redirecting');
    console.log({ isError, isProjectValid, error });
    return <Navigate to="/" replace />;
  }
  //TODO: after upgrading react, we should use (use) hook to trigger suspense instead of this
  if (isLoading || isFetching) {
    return <LoadingScreen></LoadingScreen>;
  }
  return <>{children}</>;
};

type RedirectToCurrentProjectRouteProps = {
  path: string;
  children: React.ReactNode;
};
const RedirectToCurrentProjectRoute: React.FC<
  RedirectToCurrentProjectRouteProps
> = ({ path }) => {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const defaultRedirectPath = useDefaultRedirectPath();
  const from = searchParams.get(FROM_QUERY_PARAM) ?? defaultRedirectPath;
  const [externalProjectId, setExternalProjectId] = useState<string | null>(null);
  const [isLoadingExternal, setIsLoadingExternal] = useState(false);

  // Check if we have external authentication
  const hasExternalAuth = Boolean(
    dashboardAutoLogin.getAccessToken() && dashboardAutoLogin.getOrganizationId(),
  );

  // Only get JWT project ID if no external auth
  const currentProjectId = hasExternalAuth ? null : authenticationSession.getProjectId();

  useEffect(() => {
    if (
      hasExternalAuth &&
      isNil(currentProjectId) &&
      !externalProjectId &&
      !isLoadingExternal
    ) {
      setIsLoadingExternal(true);

      // For external auth, we need to make an API call to get the project info
      // We'll use the flows API since it's already available and will return project-scoped data
      api
        .get<any>('/v1/flows', { limit: 1 })
        .then((data) => {
          if (data.data && data.data.length > 0) {
            const projectId = data.data[0].projectId as string;
            setExternalProjectId(projectId);
          } else {
            console.log(
              'RedirectToCurrentProjectRoute: No flows found, creating dummy project ID',
            );
            // If no flows exist yet, we'll use a placeholder - the backend will auto-create the project
            setExternalProjectId('external-project');
          }
          setIsLoadingExternal(false);
        })
        .catch((error) => {
          console.error(
            'RedirectToCurrentProjectRoute: Failed to get project info:',
            error,
          );
          setIsLoadingExternal(false);
        });
    }
  }, [hasExternalAuth, currentProjectId, externalProjectId, isLoadingExternal]);

  // Show loading while fetching external project info
  if (hasExternalAuth && isNil(currentProjectId) && isLoadingExternal) {
    return <LoadingScreen />;
  }

  // Use external project ID if available, otherwise fall back to JWT project ID
  const effectiveProjectId = currentProjectId || externalProjectId;

  if (isNil(effectiveProjectId)) {
    // If we're externally authenticated, do not bounce to sign-in; wait for project resolution
    if (hasExternalAuth) {
      return <LoadingScreen />;
    }
    return (
      <Navigate
        to={`/sign-in?${new URLSearchParams({ from }).toString()}`}
        replace
      />
    );
  }

  const pathWithParams = `${path.startsWith('/') ? path : `/${path}`}`.replace(
    /:(\w+)/g,
    (_, param) => params[param] ?? '',
  );

  const searchParamsString = searchParams.toString();
  const pathWithParamsAndSearchParams = `${pathWithParams}${
    searchParamsString ? `?${searchParamsString}` : ''
  }`;
  return (
    <Navigate
      to={`/projects/${effectiveProjectId}${pathWithParamsAndSearchParams}`}
      replace
    />
  );
};

interface ProjectRouterWrapperProps {
  path: string;
  element: React.ReactNode;
}

export const ProjectRouterWrapper = ({
  element,
  path,
}: ProjectRouterWrapperProps) => [
  {
    path: `/projects/:projectId${path.startsWith('/') ? path : `/${path}`}`,
    element: (
      <AllowOnlyLoggedInUserOnlyGuard>
        <TokenCheckerWrapper>{element}</TokenCheckerWrapper>
      </AllowOnlyLoggedInUserOnlyGuard>
    ),
  },
  {
    path,
    element: (
      <AllowOnlyLoggedInUserOnlyGuard>
        <RedirectToCurrentProjectRoute path={path}>
          {element}
        </RedirectToCurrentProjectRoute>
      </AllowOnlyLoggedInUserOnlyGuard>
    ),
  },
];
