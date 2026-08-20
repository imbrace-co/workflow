import { t } from 'i18next';
import { Plus } from 'lucide-react';
import React from 'react';

import { Button } from '../../../../components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../../components/ui/tooltip';

interface BranchesToolbarProps {
  addButtonClicked: () => void;
  disabled?: boolean;
  channelType?: string;
  currentBranches?: number;
  maxBranches?: number;
}

const BranchesToolbar: React.FC<BranchesToolbarProps> = ({
  addButtonClicked,
  disabled = false,
  channelType = 'webwidget',
  currentBranches = 0,
  maxBranches = 10,
}) => {
  const getTooltipMessage = () => {
    if (disabled) {
      return t(`Maximum branches reached (${maxBranches} for ${channelType})`);
    }
    return t(`Add Branch (${currentBranches}/${maxBranches} for ${channelType})`);
  };

  return (
    <div className="flex items-center gap-2 justify-end mb-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={'basic'}
            className="gap-1 items-center"
            onClick={addButtonClicked}
            disabled={disabled}
          >
            <Plus className="w-4 h-4"></Plus>
            {t('Add Branch')}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {getTooltipMessage()}
        </TooltipContent>
      </Tooltip>
    </div>
  );
};

export default BranchesToolbar;
