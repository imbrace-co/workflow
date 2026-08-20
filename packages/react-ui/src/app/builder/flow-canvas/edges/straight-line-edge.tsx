import { BaseEdge, EdgeProps } from '@xyflow/react';
import React, { useMemo } from 'react';

import { StepLocationRelativeToParent } from '@activepieces/shared';

import { flowUtilConsts } from '../utils/consts';
import { ApStraightLineEdge } from '../utils/types';

import { ApAddButton } from './add-button';

import { flowStructureUtil } from '@activepieces/shared';
import { useBuilderStateContext } from '@/app/builder/builder-hooks';
import { stepsHooks } from '@/features/pieces/lib/steps-hooks';

export const ApStraightLineCanvasEdge = ({
  sourceX,
  sourceY,
  targetY,
  data,
  id,
  source,
}: EdgeProps & ApStraightLineEdge) => {
  const [trigger] = useBuilderStateContext((state) => [
    state.flowVersion.trigger,
  ]);
  const sourceStep = useMemo(() => {
    return flowStructureUtil.getStep(source, trigger);
  }, [source, trigger]);
  const { stepMetadata } = stepsHooks.useStepMetadata({
    step: sourceStep as any, // getStep can return null/undefined
  });
  const hideAddButton = data.hideAddButton || stepMetadata?.isEndPiece;
  if (hideAddButton) {
    console.log(`[EndFlowDebug] Hiding add button in StraightLineEdge for source step: ${source}`);
  }
  const lineStartX = sourceX;
  const lineStartY =
    sourceY + flowUtilConsts.VERTICAL_SPACE_BETWEEN_STEP_AND_LINE;
  const lineLength =
    targetY - sourceY - 2 * flowUtilConsts.VERTICAL_SPACE_BETWEEN_STEP_AND_LINE;
  const path = `M ${lineStartX} ${lineStartY} v${lineLength}
   ${data.drawArrowHead ? flowUtilConsts.ARROW_DOWN : ''}`;
  const showDebugForLineEndPoint = false;

  return (
    <>
      <BaseEdge
        path={path}
        style={{ strokeWidth: `${flowUtilConsts.LINE_WIDTH}px` }}
      />
      {!hideAddButton && (
        <foreignObject
          x={lineStartX - flowUtilConsts.AP_NODE_SIZE.ADD_BUTTON.width / 2}
          y={
            lineStartY +
            (targetY - sourceY) / 2 -
            flowUtilConsts.AP_NODE_SIZE.ADD_BUTTON.height
          }
          width={flowUtilConsts.AP_NODE_SIZE.ADD_BUTTON.width}
          height={flowUtilConsts.AP_NODE_SIZE.ADD_BUTTON.height}
          className="overflow-visible cursor-default"
        >
          <ApAddButton
            edgeId={id}
            parentStepName={source}
            stepLocationRelativeToParent={StepLocationRelativeToParent.AFTER}
          ></ApAddButton>
        </foreignObject>
      )}

      {showDebugForLineEndPoint && (
        <foreignObject
          x={lineStartX}
          y={lineStartY + targetY - sourceY}
          className="w-[20px] h-[20px] rounded-full bg-[red] flex items-center justify-center absolute"
        >
          <div className=" w-[20px] h-[20px] rounded-full bg-[red] flex items-center justify-center"></div>
        </foreignObject>
      )}
    </>
  );
};
