import { t } from 'i18next';
import { Compass, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { NewProjectDialog } from '@/app/routes/platform/projects/new-project-dialog';
import { useEmbedding } from '@/components/embed-provider';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarMenu,
  SidebarGroupContent,
  SidebarSeparator,
  useSidebar,
  SidebarGroupLabel,
} from '@/components/ui/sidebar-shadcn';
import { platformHooks } from '@/hooks/platform-hooks';
import { userHooks } from '@/hooks/user-hooks';
import { cn } from '@/lib/utils';
import {
  isNil,
  PlatformRole,
  TeamProjectsLimit,
} from '@activepieces/shared';

import { SidebarGeneralItemType } from '../ap-sidebar-group';
import { ApSidebarItem, SidebarItemType } from '../ap-sidebar-item';
import { AppSidebarHeader } from '../sidebar-header';
import SidebarUsageLimits from '../sidebar-usage-limits';
import { SidebarUser } from '../sidebar-user';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function ProjectDashboardSidebar() {
  const { embedState } = useEmbedding();
  const { state, setOpen } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: currentUser } = userHooks.useCurrentUser();
  const { platform } = platformHooks.useCurrentPlatform();

  const shouldShowNewProjectButton = useMemo(() => {
    if (platform.plan.teamProjectsLimit === TeamProjectsLimit.NONE) {
      return false;
    }
    return currentUser?.platformRole === PlatformRole.ADMIN;
  }, [platform.plan.teamProjectsLimit]);

  // We no longer fetch project data, so the button is never disabled based on count.
  const shouldDisableNewProjectButton = false;

  const permissionFilter = (link: SidebarGeneralItemType) => {
    if (link.type === 'link') {
      return isNil(link.hasPermission) || link.hasPermission;
    }
    return true;
  };

  const exploreLink: SidebarItemType = {
    type: 'link',
    to: '/explore',
    label: t('Explore'),
    show: true,
    icon: Compass,
    hasPermission: true,
    isSubItem: false,
  };

  const items = [exploreLink].filter(permissionFilter);

  const handleProjectSelect = async (_projectId: string) => {
    // No-op: we no longer render projects in this sidebar.
    return;
  };

  return (
    !embedState.hideSideNav && (
      <Sidebar
        variant="inset"
        collapsible="icon"
        onClick={() => setOpen(true)}
        className={cn(
          state === 'collapsed' ? 'cursor-nesw-resize' : '',
          'group',
          'p-1',
        )}
      >
        <AppSidebarHeader />

        {state === 'collapsed' && <div className="mt-1" />}
        {state === 'expanded' && <div className="mt-2" />}

        <SidebarContent
          className={cn(
            state === 'collapsed' ? 'gap-2' : 'gap-0',
            'scrollbar-hover',
            'cursor-default',
            'flex',
            'flex-col',
            'overflow-hidden',
          )}
        >
          <SidebarGroup className="cursor-default flex-shrink-0">
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <ApSidebarItem key={item.label} {...item} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator
            className={cn(
              state === 'collapsed' ? 'mb-3' : 'mb-5',
              'flex-shrink-0',
            )}
          />

          <SidebarGroup className="flex-1 flex flex-col overflow-hidden">
            {state === 'expanded' && (
              <div className="flex items-center justify-between">
                <SidebarGroupLabel>{t('Projects')}</SidebarGroupLabel>
                <div className="flex items-center gap-1">
                  {shouldShowNewProjectButton && (
                    <>
                      {!shouldDisableNewProjectButton ? (
                        <NewProjectDialog
                          onCreate={() => {
                            // no list to refresh anymore
                          }}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 hover:bg-accent"
                          >
                            <Plus />
                          </Button>
                        </NewProjectDialog>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled
                                className="h-6 w-6"
                              >
                                <Plus />
                              </Button>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[250px]">
                            <p className="text-xs mb-1">
                              {t(
                                'Upgrade your plan to create additional team projects.',
                              )}{' '}
                              <button
                                className="text-xs text-primary underline hover:no-underline"
                                onClick={() =>
                                  window.open(
                                    'https://www.activepieces.com/pricing',
                                    '_blank',
                                  )
                                }
                              >
                                {t('View Plans')}
                              </button>
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="flex-1" onClick={(e) => e.stopPropagation()}>
              {/* Projects list removed */}
            </div>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter
          onClick={(e) => e.stopPropagation()}
          className="cursor-default"
        >
          {state === 'expanded' && (
            <div className="mb-2">
              <SidebarUsageLimits />
            </div>
          )}
          <SidebarUser />
        </SidebarFooter>
      </Sidebar>
    )
  );
}
