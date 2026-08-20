import { t } from 'i18next';
import React from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { PieceIcon } from '@/features/pieces/components/piece-icon';
import { stepsHooks } from '@/features/pieces/lib/steps-hooks';
import { PieceStepMetadata } from '@/lib/types';
import {
  FlowAction,
  FlowActionType,
  isNil,
  FlowTrigger,
  FlowTriggerType,
} from '@activepieces/shared';
import { useBuilderStateContext } from '../builder-hooks';

type StepCardProps = {
  step: FlowAction | FlowTrigger;
};

const StepCard: React.FC<StepCardProps> = ({ step }) => {
  const [flow] = useBuilderStateContext((state) => [state.flow]);
  const { stepMetadata } = stepsHooks.useStepMetadata({
    step,
  });

  const isPiece =
    stepMetadata?.type === FlowActionType.PIECE ||
    stepMetadata?.type === FlowTriggerType.PIECE;
  const pieceVersion = isPiece
    ? (stepMetadata as PieceStepMetadata)?.pieceVersion
    : undefined;
  const actionOrTriggerDisplayName =
    stepMetadata?.actionOrTriggerOrAgentDisplayName;
  const modifiedTitle = stepMetadata
    ? `${stepMetadata?.displayName} ${actionOrTriggerDisplayName ? `(${actionOrTriggerDisplayName})` : ''
    }`
    : null;

  // Get piece name for PieceIcon
  const pieceName = isPiece
    ? (step as any)?.settings?.pieceName
    : undefined;

  return (
    <div className="flex items-center justify-center gap-4 min-h-[48px]">
      <div className="flex h-full min-w-[48px] items-center justify-center">
        {stepMetadata?.logoUrl ? (
          <PieceIcon
            logoUrl={stepMetadata.logoUrl}
            displayName={stepMetadata.displayName}
            pieceName={pieceName}
            flowMetadataTags={Array.isArray(flow.metadata?.tags) ? flow.metadata.tags as (string | { id: string; name: string })[] : []}
            size="xl"
            showTooltip={false}
            circle={false}
            border={false}
          />
        ) : (
          <Skeleton className="w-12 h-12 rounded" />
        )}
      </div>
      <div className="flex h-full grow justify-center gap-2 text-start">
        <div className="text-base flex flex-col grow gap-1">
          <div className="flex-grow">
            {!isNil(modifiedTitle) ? (
              modifiedTitle
            ) : (
              <Skeleton className="h-3 w-32 rounded" />
            )}
          </div>
          <div className="overflow-hidden text-ellipsis text-xs text-muted-foreground">
            {!isNil(stepMetadata?.description) ? (
              t(stepMetadata.description)
            ) : (
              <div className="flex flex-col gap-1">
                <Skeleton className="h-2 w-48 rounded" />
              </div>
            )}
          </div>
        </div>
        <div className="flex  items-center gap-2">
          {pieceVersion && (
            <div className="text-xs text-muted-foreground flex justify-center items-center">
              v{pieceVersion}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export { StepCard };
