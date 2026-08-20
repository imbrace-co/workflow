import { t } from 'i18next';
import { Bot, Loader2 } from 'lucide-react';
import React from 'react';

import { CardList, CardListItem } from '@/components/custom/card-list';
import { ScrollArea } from '@/components/ui/scroll-area';
import { pieceSelectorUtils } from '@/features/pieces/lib/piece-selector-utils';
import {
  PieceSelectorOperation,
  PieceStepMetadataWithSuggestions,
  StepMetadataWithSuggestions,
} from '@/lib/types';
import {
  AiAssistant,
  useAiAssistants,
} from '@/lib/imbrace/ai-assistant';
import {
  FlowActionType,
  FlowOperationType,
} from '@activepieces/shared';

import { useBuilderStateContext } from '../builder-hooks';

type AiAssistantsListProps = {
  operation: PieceSelectorOperation;
  allPiecesMetadata: StepMetadataWithSuggestions[];
};

const AI_CONNECTOR_PIECE_NAME = 'ai-connector';
const ASSISTANT_REQUEST_ACTION_NAME = 'assistant-request';

export const AiAssistantsList: React.FC<AiAssistantsListProps> = ({
  operation,
  allPiecesMetadata,
}) => {
  const { data: assistants, isLoading } = useAiAssistants();
  const [handleAddingOrUpdatingStep] = useBuilderStateContext((state) => [
    state.handleAddingOrUpdatingStep,
  ]);

  const aiConnectorPiece = allPiecesMetadata.find(
    (p): p is PieceStepMetadataWithSuggestions =>
      p.type === FlowActionType.PIECE &&
      (p.pieceName === AI_CONNECTOR_PIECE_NAME ||
        p.pieceName === `@activepieces/piece-${AI_CONNECTOR_PIECE_NAME}`),
  );

  const handleSelectAssistant = (assistant: AiAssistant) => {
    if (!aiConnectorPiece) {
      console.error('AI Agents piece not found');
      return;
    }

    const assistantRequestAction = aiConnectorPiece.suggestedActions?.find(
      (a) => a.name === ASSISTANT_REQUEST_ACTION_NAME,
    );

    if (!assistantRequestAction) {
      console.error('assistant-request action not found');
      return;
    }

    const pieceSelectorItem = {
      actionOrTrigger: assistantRequestAction,
      type: FlowActionType.PIECE as const,
      pieceMetadata: aiConnectorPiece,
    };

    // Step 1: Add the piece step first (gets all default values)
    const stepName = handleAddingOrUpdatingStep({
      pieceSelectorItem,
      operation,
      selectStepAfter: false,
    });

    // Step 2: Get default values with all properties properly initialized
    const defaultValues = pieceSelectorUtils.getDefaultStepValues({
      stepName,
      pieceSelectorItem,
    });

    // Step 3: Pre-fill the assistant_id in the input
    defaultValues.settings.input.assistant_id = assistant.id;

    // Step 4: Update the step with the modified settings
    handleAddingOrUpdatingStep({
      pieceSelectorItem,
      operation: {
        type: FlowOperationType.UPDATE_ACTION,
        stepName,
      },
      selectStepAfter: true,
      overrideSettings: defaultValues.settings,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!assistants || assistants.length === 0) {
    return (
      <div className="flex flex-col gap-2 items-center justify-center h-full w-full">
        <Bot className="w-10 h-10 text-muted-foreground" />
        <div className="text-sm text-muted-foreground">
          {t('No AI assistants found')}
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full" viewPortClassName="h-full">
      <CardList className="min-w-[350px] h-full gap-0" listClassName="gap-0">
        {assistants.map((assistant) => (
          <CardListItem
            key={assistant.id}
            className="p-2 w-full"
            onClick={() => handleSelectAssistant(assistant)}
            style={{ minHeight: '54px' }}
          >
            <div className="flex gap-3 items-start">
              <div className="flex items-center justify-center w-[36px] h-[36px] rounded-full bg-accent shrink-0">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="text-sm">{assistant.name}</div>
                <div className="text-xs text-muted-foreground">
                  {assistant.description}
                </div>
              </div>
            </div>
          </CardListItem>
        ))}
      </CardList>
    </ScrollArea>
  );
};
