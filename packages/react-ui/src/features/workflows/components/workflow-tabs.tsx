import { useTranslation } from 'react-i18next';
import { MessageSquare, Zap, Settings, ChevronRight } from 'lucide-react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChannelCountType } from '@/lib/imbrace/channel';

export enum WorkflowTabType {
  CHANNEL_WORKFLOW = 'channels',
  BOARD = 'board',
  AUTOMATION = 'automations',
}

const workflowTabParamName = 'workflowTab';
const channelTypeParamName = 'channelType';

interface WorkflowTabsProps {
  refresh?: number;
}

// Channel type options based on ChannelCountType
// Channel type options moved inside component for translation


export const WorkflowTabs = ({ refresh }: WorkflowTabsProps) => {
  const { t } = useTranslation();
  const location = useLocation();

  // Channel type options based on ChannelCountType
  const channelTypeOptions = [
    { key: 'web', label: t('Web') },
    { key: 'whatsapp', label: t('WhatsApp') },
    { key: 'instagram', label: t('Instagram') },
    { key: 'facebook', label: t('Facebook') },
    { key: 'store', label: t('Store') },
  ] as const;
  const [searchParams, setSearchParams] = useSearchParams(location.search);
  // Determine selected tab and channel type from tag parameter
  const tag = searchParams.get('tag');
  const getTabAndChannelFromTag = (tag: string | null) => {
    if (!tag) return { tab: WorkflowTabType.CHANNEL_WORKFLOW, channelType: 'web' };
    
    if (tag.includes('board,automation')) {
      return { tab: WorkflowTabType.BOARD, channelType: 'web' };
    }
    if (tag.includes('automation') && !tag.includes('board')) {
      // Check if it's channel workflow or general automation
      const channelTypes = ['web', 'whatsapp', 'instagram', 'facebook', 'store'];
      const foundChannel = channelTypes.find(channel => tag.includes(channel));
      if (foundChannel) {
        return { tab: WorkflowTabType.CHANNEL_WORKFLOW, channelType: foundChannel };
      }
      return { tab: WorkflowTabType.AUTOMATION, channelType: 'web' };
    }
    
    return { tab: WorkflowTabType.CHANNEL_WORKFLOW, channelType: 'web' };
  };
  
  const { tab: selectedTab, channelType: selectedChannelType } = getTabAndChannelFromTag(tag);
  const [showChannelSubmenu, setShowChannelSubmenu] = useState(false);

  const updateSearchParams = (tabType: WorkflowTabType, channelType: string) => {
    console.log('updateSearchParams called with:', { tabType, channelType });
    console.log('Current searchParams:', searchParams.toString());
    
    const newQueryParameters = new URLSearchParams(searchParams);
    
    // Remove workflowTab and channelType parameters
    newQueryParameters.delete(workflowTabParamName);
    newQueryParameters.delete(channelTypeParamName);
    console.log('Removed workflowTab and channelType parameters');
    
    // Set tag parameter based on tab type
    const tag = tabType === WorkflowTabType.CHANNEL_WORKFLOW
      ? `${
          channelType
            ? `${channelType},`
            : ''
        }automation`
      : tabs.find((workflowTab) => workflowTab.id === tabType)?.tag;
    
    if (tag) {
      newQueryParameters.set('tag', tag);
      console.log('Set tag:', tag);
    }
    
    // Reset cursor to empty when changing tabs (this is expected behavior)
    newQueryParameters.set('cursor', '');
    console.log('Reset cursor to empty (tab change)');
    
    // Ensure limit is set (DataTable will handle this, but we ensure it exists)
    if (!newQueryParameters.has('limit')) {
      newQueryParameters.set('limit', '10');
      console.log('Set default limit: 10');
    }
    
    console.log('Final URL params:', newQueryParameters.toString());
    setSearchParams(newQueryParameters, { replace: false });
  };

  const tabs = [
    {
      id: WorkflowTabType.CHANNEL_WORKFLOW,
      label: t('Channel Workflow'),
      icon: MessageSquare,
      tag: 'channel',
    },
    {
      id: WorkflowTabType.BOARD,
      label: t('Board Automation'),
      icon: Zap,
      tag: 'board,automation',
    },
    {
      id: WorkflowTabType.AUTOMATION,
      label: t('General Automation'),
      icon: Settings,
      tag: 'automation',
    },
  ];

  useEffect(() => {
    console.log('useEffect triggered', {
      tag: searchParams.get('tag'),
      selectedTab,
      selectedChannelType
    });
    
    // Delay to ensure DataTable has set its parameters first
    const timeoutId = setTimeout(() => {
      updateSearchParams(selectedTab, selectedChannelType);
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, []); // Only run once on mount

  return (
    <div className="mt-4">
      <div className="flex flex-col w-full gap-y-1">
        <div className="px-4 py-2">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            {t('Workflow Categories')}
          </h3>
        </div>
        <div className="flex flex-col gap-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isChannelWorkflow =
              tab.id === WorkflowTabType.CHANNEL_WORKFLOW;

            return (
              <div key={tab.id} className="relative">
                <Button
                  variant="ghost"
                  className={cn(
                    'w-full items-center justify-start gap-2 pl-4 pr-0 h-10',
                    {
                      'bg-accent dark:bg-accent/50': selectedTab === tab.id,
                    }
                  )}
                  onClick={() => updateSearchParams(tab.id, selectedChannelType)}
                  onMouseEnter={() =>
                    isChannelWorkflow && setShowChannelSubmenu(true)
                  }
                  onMouseLeave={() =>
                    isChannelWorkflow && setShowChannelSubmenu(false)
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span
                    className={cn('flex-grow text-start', {
                      'font-medium': selectedTab === tab.id,
                    })}
                  >
                    {tab.label}
                  </span>
                  {isChannelWorkflow && <ChevronRight className="h-4 w-4" />}
                </Button>

                {/* Channel Workflow Submenu */}
                {isChannelWorkflow && showChannelSubmenu && (
                  <div
                    className="absolute left-full top-0 ml-1 bg-background border border-border rounded-md shadow-lg z-50 min-w-[180px]"
                    onMouseEnter={() => setShowChannelSubmenu(true)}
                    onMouseLeave={() => setShowChannelSubmenu(false)}
                  >
                    <div className="py-1">
                      {channelTypeOptions.map((option) => (
                        <Button
                          key={option.key}
                          variant="ghost"
                          className={cn(
                            'w-full items-center justify-start gap-2 px-3 py-2 h-8 text-sm',
                            {
                              'bg-accent dark:bg-accent/50':
                                selectedChannelType === option.key,
                            }
                          )}
                          onClick={() => updateSearchParams(tab.id, option.key)}
                        >
                          <span className="flex-grow text-start">
                            {option.label}
                          </span>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export { workflowTabParamName, channelTypeParamName };
