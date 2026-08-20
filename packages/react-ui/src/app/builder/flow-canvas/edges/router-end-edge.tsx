import { BaseEdge, EdgeProps } from '@xyflow/react';

import { StepLocationRelativeToParent } from '@activepieces/shared';

import { flowUtilConsts } from '../utils/consts';
import { ApRouterEndEdge } from '../utils/types';

import { ApAddButton } from './add-button';

import { flowStructureUtil } from '@activepieces/shared';
import React, { useMemo } from 'react';
import { useBuilderStateContext } from '@/app/builder/builder-hooks';
import { stepsHooks } from '@/features/pieces/lib/steps-hooks';

export const ApRouterEndCanvasEdge = ({
  sourceX,
  targetX,
  targetY,
  sourceY,
  data,
  id,
}: EdgeProps & Omit<ApRouterEndEdge, 'position'>) => {
  const [trigger] = useBuilderStateContext((state) => [
    state.flowVersion.trigger,
  ]);
  const parentStep = useMemo(() => {
    if (data.drawEndingVerticalLine) {
      return flowStructureUtil.getStep(data.routerOrBranchStepName, trigger);
    }
    return null;
  }, [data, trigger]);
  const { stepMetadata } = stepsHooks.useStepMetadata({
    step: parentStep,
  });
  const hideAddButton = data.hideAddButton || stepMetadata?.isEndPiece;
  if (hideAddButton && data.drawEndingVerticalLine) {
    console.log(`[EndFlowDebug] Hiding add button in RouterEndEdge for router: ${data.routerOrBranchStepName}`);
  }
  const verticalLineLength =
    flowUtilConsts.VERTICAL_SPACE_BETWEEN_STEPS -
    2 * flowUtilConsts.VERTICAL_SPACE_BETWEEN_STEP_AND_LINE;

  const horizontalLineLength =
    (Math.abs(targetX - sourceX) - 2 * flowUtilConsts.ARC_LENGTH) *
    (targetX > sourceX ? 1 : -1);

  const distanceBetweenTargetAndSource = Math.abs(targetX - sourceX);

  const generatePath = () => {
    // Start point
    let path = `M ${sourceX - 0.5} ${
      sourceY - flowUtilConsts.VERTICAL_SPACE_BETWEEN_STEP_AND_LINE * 2
    }`;

    // Vertical line from start
    path += `v ${data.verticalSpaceBetweenLastNodeInBranchAndEndLine}`;

    // Arc or vertical line based on distance
    if (distanceBetweenTargetAndSource >= flowUtilConsts.ARC_LENGTH) {
      path +=
        targetX > sourceX
          ? flowUtilConsts.ARC_RIGHT_DOWN
          : flowUtilConsts.ARC_LEFT_DOWN;
    } else {
      path += `v ${
        flowUtilConsts.ARC_LENGTH +
        flowUtilConsts.VERTICAL_SPACE_BETWEEN_STEP_AND_LINE +
        2
      }`;
    }

    // Optional horizontal line
    if (data.drawHorizontalLine) {
      path += `h ${horizontalLineLength} ${
        targetX > sourceX ? flowUtilConsts.ARC_RIGHT : flowUtilConsts.ARC_LEFT
      }`;
    }

    // Optional ending vertical line with arrow
    if (data.drawEndingVerticalLine) {
      path += `v${verticalLineLength}`;
      if (!data.isNextStepEmpty) {
        path += flowUtilConsts.ARROW_DOWN;
      }
    }

    return path;
  };

  const path = generatePath();

  return (
    <>
      <BaseEdge
        path={path}
        style={{ strokeWidth: `${flowUtilConsts.LINE_WIDTH}px` }}
      />

      {data.drawEndingVerticalLine && !hideAddButton && (
        <foreignObject
          x={
            targetX -
            flowUtilConsts.AP_NODE_SIZE.ADD_BUTTON.width / 2 -
            flowUtilConsts.LINE_WIDTH / 2
          }
          y={
            targetY -
            verticalLineLength +
            flowUtilConsts.AP_NODE_SIZE.ADD_BUTTON.height
          }
          width={flowUtilConsts.AP_NODE_SIZE.ADD_BUTTON.width}
          height={flowUtilConsts.AP_NODE_SIZE.ADD_BUTTON.height}
          className="overflow-visible"
        >
          <ApAddButton
            edgeId={id}
            stepLocationRelativeToParent={StepLocationRelativeToParent.AFTER}
            parentStepName={data.routerOrBranchStepName}
          />
        </foreignObject>
      )}
    </>
  );
};
