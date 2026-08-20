# End Piece UI Implementation

This document describes how the `isEndPiece` property from `@activepieces/pieces-framework` is handled in the frontend UI.

## Overview

Terminal steps are actions that indicate the end of a workflow execution path. The UI enforces this by hiding the ability to add further steps and providing visual feedback to the user.

## Implementation Details

### 1. Metadata Propagation

The `isEndPiece` property is fetched as part of the piece metadata and propagated to the UI components through:

- **[`src/features/pieces/lib/step-utils.tsx`](src/features/pieces/lib/step-utils.tsx)**: Populates the `isEndPiece` property in the `StepMetadata` object.
- **[`src/lib/types.ts`](src/lib/types.ts)**: Defines the `BaseStepMetadata` which now includes the optional `isEndPiece` boolean.

### 2. Graph Construction

The graph construction logic is located in [`src/app/builder/flow-canvas/utils/flow-canvas-utils.ts`](src/app/builder/flow-canvas/utils/flow-canvas-utils.ts).
The `convertFlowVersionToGraph` function now accepts an optional `isEndPieceMap`.

- **[`src/app/builder/flow-canvas/index.tsx`](src/app/builder/flow-canvas/index.tsx)**: At the component level, we pre-fetch metadata for all steps to build this map.
- The graph builder checks this map for each step.
- If a step is marked as an end piece, the succeeds edge is created with `hideAddButton: true`.

### 3. Visual Indicators

Individual step nodes check the `isEndPiece` property in their metadata.

- **[`src/app/builder/flow-canvas/nodes/step-node.tsx`](src/app/builder/flow-canvas/nodes/step-node.tsx)**: If `isEndPiece` is `true`, a **"TERMINAL"** badge is rendered next to the step's display name.
- This provides clear feedback to the user that this action is the final step in its branch.

### 4. Edge Interaction

The edge interaction logic is handled in the following component:

- **[`src/app/builder/flow-canvas/edges/straight-line-edge.tsx`](src/app/builder/flow-canvas/edges/straight-line-edge.tsx)**: The `ApStraightLineCanvasEdge` component conditionally renders the `ApAddButton` (the "+" icon) only if `data.hideAddButton` is NOT `true`.

## Adding New Terminal Pieces

To make a piece terminal in the UI:

1. Set `isEndPiece: true` in the piece's action definition in the piece framework (e.g., [`../pieces/community/framework/src/lib/piece.ts`](../pieces/community/framework/src/lib/piece.ts)).
2. Rebuild the piece and sync it to the project.
3. The UI will automatically detect this and apply the visual/functional restrictions.
