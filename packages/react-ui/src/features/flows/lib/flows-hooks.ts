import { QueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { t } from 'i18next';
import { useNavigate } from 'react-router-dom';

import { useSocket } from '@/components/socket-provider';
import { toast } from '@/components/ui/use-toast';
import { flowRunsApi } from '@/features/flow-runs/lib/flow-runs-api';
import { pieceSelectorUtils } from '@/features/pieces/lib/piece-selector-utils';
import { piecesApi } from '@/features/pieces/lib/pieces-api';
import { stepUtils } from '@/features/pieces/lib/step-utils';
import { flagsHooks } from '@/hooks/flags-hooks';
import { dashboardAutoLogin } from '@/lib/dashboard-auto-login';
import { downloadFile, NEW_FLOW_QUERY_PARAM } from '@/lib/utils';
import {
  ApFlagId,
  FlowOperationType,
  FlowRun,
  FlowStatus,
  FlowVersion,
  FlowVersionMetadata,
  ListFlowsRequest,
  PopulatedFlow,
  FlowTrigger,
  FlowTriggerType,
} from '@activepieces/shared';

import { flowsApi } from './flows-api';
import { flowsUtils } from './flows-utils';

const createFlowsQueryKey = () => ['flows', dashboardAutoLogin.getOrganizationId()];
export const flowsHooks = {
  invalidateFlowsQuery: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({
      queryKey: createFlowsQueryKey(),
    });
    // Also refresh any cached counts that depend on flows
    queryClient.invalidateQueries({ queryKey: ['flowsCount'] });
    queryClient.invalidateQueries({ queryKey: ['channelFlowCounts'] });
    queryClient.invalidateQueries({ queryKey: ['folderFlowCount'] });
  },
  useFlows: (request: Omit<ListFlowsRequest, 'projectId'>) => {
    return useQuery({
      queryKey: createFlowsQueryKey(),
      queryFn: async () => {
        // projectId removed - auto-resolved from organization context
        return await flowsApi.list(request);
      },
      staleTime: 5 * 1000,
    });
  },
  usePublishFlow: ({
    flowId,
    setFlow,
    setVersion,
    setIsPublishing,
  }: {
    flowId: string;
    setFlow: (flow: PopulatedFlow) => void;
    setVersion: (version: FlowVersion) => void;
    setIsPublishing: (isPublishing: boolean) => void;
  }) => {
    const { data: enableFlowOnPublish } = flagsHooks.useFlag<boolean>(
      ApFlagId.ENABLE_FLOW_ON_PUBLISH,
    );

    return useMutation({
      mutationFn: async () => {
        setIsPublishing(true);
        return flowsApi.update(flowId, {
          type: FlowOperationType.LOCK_AND_PUBLISH,
          request: {
            status: enableFlowOnPublish
              ? FlowStatus.ENABLED
              : FlowStatus.DISABLED,
          },
        });
      },
      onSuccess: (flow) => {
        toast({
          title: t('Success'),
          description: t('Flow has been published.'),
        });
        setFlow(flow);
        setVersion(flow.version);
        setIsPublishing(false);
      },
      onError: (err: Error) => {
        toast({
          title: t('Error'),
          description: t('Failed to publish flow, please contact support.'),
          variant: 'destructive',
        });
        console.error('Failed to publish flow', err);
        setIsPublishing(false);
      },
    });
  },
  useExportFlows: () => {
    return useMutation({
      mutationFn: async (flows: PopulatedFlow[]) => {
        if (flows.length === 0) {
          return flows;
        }
        if (flows.length === 1) {
          await flowsUtils.downloadFlow(flows[0].id);
          return flows;
        }
        await downloadFile({
          obj: await flowsUtils.zipFlows(flows),
          fileName: 'flows',
          extension: 'zip',
        });
        return flows;
      },
      onSuccess: (res) => {
        if (res.length > 0) {
          toast({
            title: t('Success'),
            description:
              res.length === 1
                ? t(`${res[0].version.displayName} has been exported.`)
                : t('Flows have been exported.'),
            duration: 3000,
          });
        }
      },
    });
  },

  useFetchFlowVersion: ({
    onSuccess,
  }: {
    onSuccess: (flowVersion: FlowVersion) => void;
  }) => {
    return useMutation<FlowVersion, Error, FlowVersionMetadata>({
      mutationFn: async (flowVersion) => {
        const result = await flowsApi.get(flowVersion.flowId, {
          versionId: flowVersion.id,
        });
        return result.version;
      },
      onSuccess,
    });
  },
  useOverWriteDraftWithVersion: ({
    onSuccess,
  }: {
    onSuccess: (flowVersion: PopulatedFlow) => void;
  }) => {
    return useMutation<PopulatedFlow, Error, FlowVersionMetadata>({
      mutationFn: async (flowVersion) => {
        const result = await flowsApi.update(flowVersion.flowId, {
          type: FlowOperationType.USE_AS_DRAFT,
          request: {
            versionId: flowVersion.id,
          },
        });
        return result;
      },
      onSuccess,
    });
  },
  useCreateMcpFlow: () => {
    const navigate = useNavigate();
    return useMutation({
      mutationFn: async () => {
        // projectId removed - auto-resolved from organization context
        const flow = await flowsApi.create({
          displayName: t('Untitled'),
        });
        const mcpPiece = await piecesApi.get({
          name: '@activepieces/piece-mcp',
        });
        const trigger = mcpPiece.triggers['mcp_tool'];
        if (!trigger) {
          throw new Error('MCP trigger not found');
        }
        const stepData = pieceSelectorUtils.getDefaultStepValues({
          stepName: 'trigger',
          pieceSelectorItem: {
            actionOrTrigger: trigger,
            type: FlowTriggerType.PIECE,
            pieceMetadata: stepUtils.mapPieceToMetadata({
              piece: mcpPiece,
              type: 'trigger',
            }),
          },
        }) as FlowTrigger;
        await flowsApi.update(flow.id, {
          type: FlowOperationType.UPDATE_TRIGGER,
          request: stepData,
        });
        return flow;
      },
      onSuccess: (flow) => {
        navigate(`/flows/${flow.id}/`);
      },
    });
  },
  useCreateWebhookFlow: () => {
    const navigate = useNavigate();
    return useMutation<PopulatedFlow, Error, { folderName?: string; metadata?: any }>({
      mutationFn: async ({ folderName, metadata } = {}) => {
        // Create a new flow first
        const flow = await flowsApi.create({
          displayName: t('Untitled'),
          folderName,
          metadata,
        });
        
        // Get the webhook piece
        const webhookPiece = await piecesApi.get({
          name: '@activepieces/piece-webhook',
        });
        
        const trigger = webhookPiece.triggers['catch_webhook'];
        if (!trigger) {
          throw new Error('Webhook trigger not found');
        }
        
        // Create step data for webhook trigger
        const stepData = pieceSelectorUtils.getDefaultStepValues({
          stepName: 'trigger',
          pieceSelectorItem: {
            actionOrTrigger: trigger,
            type: FlowTriggerType.PIECE,
            pieceMetadata: stepUtils.mapPieceToMetadata({
              piece: webhookPiece,
              type: 'trigger',
            }),
          },
        }) as FlowTrigger;
        
        // Update the flow with webhook trigger
        await flowsApi.update(flow.id, {
          type: FlowOperationType.UPDATE_TRIGGER,
          request: stepData,
        });
        
        return flow;
      },
      onSuccess: (flow) => {
        navigate(`/flows/${flow.id}?${NEW_FLOW_QUERY_PARAM}=true`);
      },
    });
  },
  useGetFlow: (flowId: string) => {
    return useQuery({
      queryKey: ['flow', flowId],
      queryFn: async () => {
        try {
          return await flowsApi.get(flowId);
        } catch (err) {
          console.error(err);
          return null;
        }
      },
      staleTime: 0,
    });
  },
  useTestFlow: ({
    flowVersionId,
    onUpdateRun,
  }: {
    flowVersionId: string;
    onUpdateRun: (run: FlowRun) => void;
  }) => {
    const socket = useSocket();
    return useMutation<void>({
      mutationFn: () =>
        flowRunsApi.testFlow(
          socket,
          {
            flowVersionId,
          },
          onUpdateRun,
        ),
    });
  },
};
