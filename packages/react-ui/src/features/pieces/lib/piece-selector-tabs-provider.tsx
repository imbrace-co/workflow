import { createContext, useContext, useState } from 'react';

import { StepMetadataWithSuggestions } from '@/lib/types';

export enum PieceSelectorTabType {
  ALL = 'ALL',
  AI_AGENTS = 'AI_AGENTS',
  CHANNEL_ACTIONS = 'CHANNEL_ACTIONS',
  INTEGRATIONS = 'INTEGRATIONS',
  FUNCTIONS = 'FUNCTIONS',
  ACTIONS = 'ACTIONS',
  WORKFLOW_PRESETS = 'WORKFLOW_PRESETS',
  INTERNAL_USE = 'INTERNAL_USE',
  LOGICS = 'LOGICS',
  NONE = 'NONE',
}

export const PieceSelectorTabsContext = createContext({
  selectedTab: PieceSelectorTabType.ALL,
  setSelectedTab: (tab: PieceSelectorTabType) => {},
  resetToBeforeNoneWasSelected: () => {},
  setSelectedPieceInExplore: (piece: StepMetadataWithSuggestions | null) => {},
  selectedPieceInExplore: null as null | StepMetadataWithSuggestions,
});

export const PieceSelectorTabsProvider = ({
  children,
  onTabChange,
  initiallySelectedTab,
}: {
  children: React.ReactNode;
  onTabChange: (tab: PieceSelectorTabType) => void;
  initiallySelectedTab: PieceSelectorTabType;
}) => {
  const normalizeTab = (tab: PieceSelectorTabType) => {
    // Tabs removed from UI but kept for backward compatibility
    if (tab === PieceSelectorTabType.WORKFLOW_PRESETS) {
      return PieceSelectorTabType.ALL;
    }
    return tab;
  };

  const [selectedTab, setSelectedTab] = useState(
    normalizeTab(initiallySelectedTab),
  );
  const [lastTabBefroeNoneWasSelected, setLastTabBeforeNoneWasSelected] =
    useState(normalizeTab(initiallySelectedTab));
  const [selectedPieceInExplore, setSelectedPieceInExplore] =
    useState<StepMetadataWithSuggestions | null>(null);
  return (
    <PieceSelectorTabsContext.Provider
      value={{
        selectedTab,
        setSelectedPieceInExplore,
        selectedPieceInExplore,
        setSelectedTab: (tab: PieceSelectorTabType) => {
          const nextTab = normalizeTab(tab);
          if (tab !== PieceSelectorTabType.NONE) {
            setLastTabBeforeNoneWasSelected(nextTab);
            onTabChange(nextTab);
          }
          setSelectedTab(nextTab);
        },
        resetToBeforeNoneWasSelected: () => {
          setSelectedTab(lastTabBefroeNoneWasSelected);
        },
      }}
    >
      {children}
    </PieceSelectorTabsContext.Provider>
  );
};

export const usePieceSelectorTabs = () => {
  const context = useContext(PieceSelectorTabsContext);
  if (!context) {
    throw new Error(
      'usePieceSelectorTabs must be used within a PieceSelectorTabsProvider',
    );
  }
  return context;
};
