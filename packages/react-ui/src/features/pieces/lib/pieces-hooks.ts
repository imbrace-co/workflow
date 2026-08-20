import { useMutation, useQueries, useQuery } from '@tanstack/react-query';
import { t } from 'i18next';
import { useTranslation } from 'react-i18next';

import { flagsHooks } from '@/hooks/flags-hooks';
import { platformHooks } from '@/hooks/platform-hooks';
import {
  PieceStepMetadataWithSuggestions,
  StepMetadataWithSuggestions,
  CategorizedStepMetadataWithSuggestions,
} from '@/lib/types';
import {
  PieceMetadataModel,
  PieceMetadataModelSummary,
  PropertyType,
  ExecutePropsResult,
} from '@activepieces/pieces-framework';
import {
  FlowActionType,
  flowPieceUtil,
  LocalesEnum,
  PieceOptionRequest,
  PlatformWithoutSensitiveData,
  FlowTriggerType,
  ApFlagId,
  ApEnvironment,
  PieceCategory,
} from '@activepieces/shared';

import { pieceSearchUtils } from './piece-search-utils';
import {
  PieceSelectorTabType,
  usePieceSelectorTabs,
} from './piece-selector-tabs-provider';
import { piecesApi } from './pieces-api';
import { stepsHooks } from './steps-hooks';

const isPieceStepMetadataWithSuggestions = (
  metadata: StepMetadataWithSuggestions,
): metadata is PieceStepMetadataWithSuggestions =>
  metadata.type === FlowActionType.PIECE || metadata.type === FlowTriggerType.PIECE;

const {
  getPinnedPieces,
  getPopularPieces,
  getAiAndAgentsPieces,
  isUtilityPiece,
  isAppPiece,
  getHighlightedPieces,
  isFlowController,
} = pieceSearchUtils;

type UsePieceModelForStepSettings = {
  name: string;
  version: string | undefined;
  enabled?: boolean;
  getExactVersion: boolean;
};

type UsePieceProps = {
  name: string;
  version?: string;
  enabled?: boolean;
};

type UseMultiplePiecesProps = {
  names: string[];
};

type UsePiecesProps = {
  searchQuery?: string;
  includeHidden?: boolean;
  includeTags?: boolean;
};
type UsePiecesSearchProps = {
  searchQuery: string;
  enabled?: boolean;
  type: 'action' | 'trigger';
};

export const piecesHooks = {
  usePiece: ({ name, version, enabled = true }: UsePieceProps) => {
    const { i18n } = useTranslation();
    const query = useQuery<PieceMetadataModel, Error>({
      queryKey: ['piece', name, version],
      queryFn: () =>
        piecesApi.get({ name, version, locale: i18n.language as LocalesEnum }),
      staleTime: Infinity,
      enabled,
    });
    return {
      pieceModel: query.data,
      isLoading: query.isLoading,
      isSuccess: query.isSuccess,
      refetch: query.refetch,
    };
  },
  usePieceModelForStepSettings: ({
    name,
    version,
    enabled = true,
    getExactVersion,
  }: UsePieceModelForStepSettings) => {
    const exactVersion = version
      ? flowPieceUtil.getExactVersion(version)
      : undefined;
    const latestPatchVersion = exactVersion
      ? flowPieceUtil.getMostRecentPatchVersion(exactVersion)
      : undefined;
    const pieceQuery = piecesHooks.usePiece({
      name,
      version: exactVersion,
      enabled,
    });
    const latestPatchQuery = piecesHooks.usePiece({
      name,
      version: latestPatchVersion,
      enabled,
    });
    return {
      pieceModel: getExactVersion
        ? pieceQuery.pieceModel
        : latestPatchQuery.pieceModel,
      isLoading: pieceQuery.isLoading || latestPatchQuery.isLoading,
      isSuccess: pieceQuery.isSuccess && latestPatchQuery.isSuccess,
      refetch: () => {
        pieceQuery.refetch();
        latestPatchQuery.refetch();
      },
    };
  },
  useMultiplePieces: ({ names }: UseMultiplePiecesProps) => {
    const { i18n } = useTranslation();
    return useQueries({
      queries: names.map((name) => ({
        queryKey: ['piece', name, undefined],
        queryFn: () =>
          piecesApi.get({
            name,
            version: undefined,
            locale: i18n.language as LocalesEnum,
          }),
        staleTime: Infinity,
      })),
    });
  },
  usePieces: ({
    searchQuery,
    includeHidden = false,
    includeTags = false,
  }: UsePiecesProps) => {
    const { i18n } = useTranslation();
    const query = useQuery<PieceMetadataModelSummary[], Error>({
      queryKey: ['pieces', searchQuery, includeHidden],
      queryFn: () =>
        piecesApi.list({
          searchQuery,
          includeHidden,
          includeTags,
          locale: i18n.language as LocalesEnum,
        }),
      staleTime: searchQuery ? 0 : Infinity,
    });
    return {
      pieces: query.data,
      isLoading: query.isLoading,
      refetch: query.refetch,
    };
  },
  usePiecesSearch: (
    props: UsePiecesSearchProps,
  ): {
    isLoading: boolean;
    data: CategorizedStepMetadataWithSuggestions[];
  } => {
    const { selectedTab } = usePieceSelectorTabs();
    const { data: environment } = flagsHooks.useFlag<ApEnvironment>(
      ApFlagId.ENVIRONMENT,
    );
    const { metadata, isLoading: isLoadingPieces } =
      stepsHooks.useAllStepsMetadata(props);
    const { platform } = platformHooks.useCurrentPlatform();
    if (!metadata || isLoadingPieces) {
      return {
        isLoading: true,
        data: [],
      };
    }
    const piecesMetadataWithoutEmptySuggestions =
      filterOutPiecesWithNoSuggestions(metadata);

    const pinnedPieces = getPinnedPieces(
      piecesMetadataWithoutEmptySuggestions,
      platform.pinnedPieces ?? [],
    );

    const popularPieces = getPopularPieces(
      piecesMetadataWithoutEmptySuggestions,
      platform.pinnedPieces ?? [],
    );

    const flowControllerPieces =
      piecesMetadataWithoutEmptySuggestions.filter(isFlowController);

    const utilityPieces =
      piecesMetadataWithoutEmptySuggestions.filter(isUtilityPiece);

    const popularPiecesNames = new Set(popularPieces.map((p) => p.pieceName));
    const pinnedPiecesNames = new Set(pinnedPieces.map((p) => p.pieceName));
    const pieceMetadataWithoutPopularOrPinnedPieces =
      piecesMetadataWithoutEmptySuggestions.filter((p) => {
        if (!isPieceStepMetadataWithSuggestions(p)) {
          return true;
        }
        return (
          !popularPiecesNames.has(p.pieceName) && !pinnedPiecesNames.has(p.pieceName)
        );
      });

    const appPieces =
      pieceMetadataWithoutPopularOrPinnedPieces.filter(isAppPiece);

    const utilitiesCategory = {
      title: t('Utility'),
      metadata: utilityPieces,
    };
    const flowControllerCategory = {
      title: t('Flow Controller'),
      metadata: flowControllerPieces,
    };
    const appsCategory = {
      title: t('Apps'),
      metadata: appPieces,
    };
    const popularCategory = {
      title: t('Popular'),
      metadata: popularPieces,
    };
    const allCategory = {
      title: t('All'),
      metadata: piecesMetadataWithoutEmptySuggestions,
    };

    switch (selectedTab) {
      case PieceSelectorTabType.ALL: {
        // Show ALL connectors - Popular + Highlights + All others
        // This ensures no connector is ever lost
        return {
          isLoading: false,
          data: getExploreTabContent(
            piecesMetadataWithoutEmptySuggestions,
            platform,
            props.type,
            environment,
          ),
        };
      }
      case PieceSelectorTabType.AI_AGENTS:
        // Uses PieceCategory.ARTIFICIAL_INTELLIGENCE and UNIVERSAL_AI
        return {
          isLoading: false,
          data: getAiAndAgentsPieces(piecesMetadataWithoutEmptySuggestions),
        };
      case PieceSelectorTabType.CHANNEL_ACTIONS: {
        // Filter pieces with COMMUNICATION category
        const channelPieces = piecesMetadataWithoutEmptySuggestions.filter(
          (p) =>
            (p.type === FlowActionType.PIECE ||
              p.type === FlowTriggerType.PIECE) &&
            p.categories?.includes(PieceCategory.COMMUNICATION),
        );
        return {
          isLoading: false,
          data: channelPieces.length > 0 ? [{ title: t('Channel Actions'), metadata: channelPieces }] : [],
        };
      }
      case PieceSelectorTabType.INTEGRATIONS: {
        // Show Apps/Integrations - pieces that are not AI, not Utility, not Flow Controller
        const popularAppsCategory = {
          ...popularCategory,
          metadata: popularCategory.metadata.filter(isAppPiece),
        };
        const result = {
          isLoading: false,
          data: [popularAppsCategory, appsCategory],
        };
        if (pinnedPieces.length > 0) {
          result.data.unshift({
            title: t('Highlights'),
            metadata: pinnedPieces,
          });
        }
        return result;
      }
      case PieceSelectorTabType.ACTIONS: {
        // Only show pieces explicitly categorized as ACTIONS
        const actionPieces = piecesMetadataWithoutEmptySuggestions.filter(
          (p) =>
            (p.type === FlowActionType.PIECE ||
              p.type === FlowTriggerType.PIECE) &&
            p.categories?.includes(PieceCategory.ACTIONS),
        );
        return {
          isLoading: false,
          data:
            actionPieces.length > 0
              ? [{ title: t('Actions'), metadata: actionPieces }]
              : [],
        };
      }
      case PieceSelectorTabType.FUNCTIONS: {
        // CORE category pieces (utility functions like text helper, date helper, etc.)
        return {
          isLoading: false,
          data: [utilitiesCategory],
        };
      }
      case PieceSelectorTabType.WORKFLOW_PRESETS: {
        // Reserved for curated presets (no special filter for now)
        return {
          isLoading: false,
          data: [],
        };
      }
      case PieceSelectorTabType.INTERNAL_USE: {
        // Developer tools category + Code action
        const devToolsPieces = piecesMetadataWithoutEmptySuggestions.filter(
          (p) =>
            p.type === FlowActionType.CODE ||
            ((p.type === FlowActionType.PIECE ||
              p.type === FlowTriggerType.PIECE) &&
              p.categories?.includes(PieceCategory.DEVELOPER_TOOLS)),
        );
        return {
          isLoading: false,
          data: devToolsPieces.length > 0 ? [{ title: t('Developer Tools'), metadata: devToolsPieces }] : [],
        };
      }
      case PieceSelectorTabType.LOGICS:
        // Flow control pieces (Router, Loop, Branch, etc.)
        return {
          isLoading: false,
          data: [flowControllerCategory],
        };
      case PieceSelectorTabType.NONE:
        // Fallback - shows ALL pieces to ensure nothing is lost
        return {
          isLoading: false,
          data: allCategory.metadata.length > 0 ? [allCategory] : [],
        };
    }
  },
  usePieceOptions: <
    T extends
      | PropertyType.DYNAMIC
      | PropertyType.DROPDOWN
      | PropertyType.MULTI_SELECT_DROPDOWN,
  >({
    onSuccess,
    onError,
    onMutate,
  }: {
    onSuccess: (data: ExecutePropsResult<T>) => void;
    onError: (error: Error) => void;
    onMutate: () => void;
  }) => {
    return useMutation<
      ExecutePropsResult<T>,
      Error,
      { request: PieceOptionRequest; propertyType: T }
    >({
      mutationFn: async ({ request, propertyType }) => {
        onMutate();
        return piecesApi.options(request, propertyType);
      },
      onSuccess,
      onError,
      retry: 1,
      retryDelay: 1000,
    });
  },
};

const filterOutPiecesWithNoSuggestions = (
  stepsMetadata: StepMetadataWithSuggestions[],
) => {
  return stepsMetadata.filter((metadata) => {
    // Keep Popular pieces even if they don't provide suggestions
    if (
      isPieceStepMetadataWithSuggestions(metadata) &&
      pieceSearchUtils
        .getPopularPieces([metadata], [])
        .some((p) => p.pieceName === metadata.pieceName)
    ) {
      return true;
    }
    const isActionWithSuggestions =
      metadata.type === FlowActionType.PIECE &&
      metadata.suggestedActions &&
      metadata.suggestedActions.length > 0;

    const isTriggerWithSuggestions =
      metadata.type === FlowTriggerType.PIECE &&
      metadata.suggestedTriggers &&
      metadata.suggestedTriggers.length > 0;

    const isNotPieceType =
      metadata.type !== FlowActionType.PIECE &&
      metadata.type !== FlowTriggerType.PIECE;
    return (
      isActionWithSuggestions || isTriggerWithSuggestions || isNotPieceType
    );
  });
};

const getExploreTabContent = (
  queryResult: StepMetadataWithSuggestions[],
  platform: PlatformWithoutSensitiveData,
  type: 'action' | 'trigger',
  environment: ApEnvironment | null,
) => {
  const popularCategory: CategorizedStepMetadataWithSuggestions = {
    title: t('Popular'),
    metadata: environment === ApEnvironment.DEVELOPMENT ? queryResult : [],
  };
  if (environment === ApEnvironment.DEVELOPMENT) {
    return [popularCategory];
  }
  const pinnedPieces = getPinnedPieces(
    queryResult,
    platform.pinnedPieces ?? [],
  );
  const popularPieces = getPopularPieces(
    queryResult,
    platform.pinnedPieces ?? [],
  );

  if (popularPieces.length > 0) {
    popularCategory.metadata = [...popularCategory.metadata, ...popularPieces];
  }

  const hightlightedPiecesCategory: CategorizedStepMetadataWithSuggestions = {
    title: t('Highlights'),
    metadata: [],
  };
  const highlightedPieces = getHighlightedPieces(queryResult, type);
  const codePiece = queryResult.find(
    (piece) => piece.type === FlowActionType.CODE,
  );
  const branchPiece = queryResult.find(
    (piece) => piece.type === FlowActionType.ROUTER || piece.type === FlowActionType.MULTIPLE_CHOICE,
  );
  const loopPiece = queryResult.find(
    (piece) => piece.type === FlowActionType.LOOP_ON_ITEMS,
  );

  if (highlightedPieces.length > 0) {
    hightlightedPiecesCategory.metadata.push(...highlightedPieces);
  }

  if (branchPiece) {
    hightlightedPiecesCategory.metadata.splice(0, 0, branchPiece);
  }

  if (codePiece) {
    hightlightedPiecesCategory.metadata.splice(3, 0, codePiece);
  }
  if (loopPiece) {
    hightlightedPiecesCategory.metadata.splice(5, 0, loopPiece);
  }
  if (pinnedPieces.length > 0) {
    hightlightedPiecesCategory.metadata = [
      ...pinnedPieces,
      ...hightlightedPiecesCategory.metadata,
    ];
  }

  return [popularCategory, hightlightedPiecesCategory];
};
