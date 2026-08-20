# isEndPiece Feature

The `isEndPiece` property allows an action to be designated as a **Terminal Step** in a workflow. This is useful for pieces that represent the final action of a flow (e.g., "End Flow", "Return Response", "Handoff to Human").

## How it Works

When an action is marked as `isEndPiece: true`:

1. **UI Indicator**: A "TERMINAL" badge is displayed on the step node in the workflow builder.
2. **Add Step Prevention**: The "+" (Add Step) button that normally appears after a step is hidden, preventing users from adding further actions after this one.

## Usage in Action Definition

To mark an action as an end piece, set the `isEndPiece` property to `true` in the `createAction` call:

```typescript
import { createAction } from '@activepieces/pieces-framework';

export const myTerminalAction = createAction({
  name: 'myTriggeredEnd',
  displayName: 'End Workflow Now',
  description: 'Ends the workflow execution immediately.',
  isEndPiece: true, // This is the key property
  props: {
      // ... your props
  },
  async run(context) {
    // Implementation of the terminal action
  },
});
```

## Technical Impact

- **Metadata**: This property is included in the piece metadata.
- **Frontend**: The `FlowCanvas` component detects this property and instructs the graph generator (`flow-canvas-utils.ts`) to hide the add button for the succeeding edge.
- **Validation**: While currently enforced primarily in the UI, it serves as a clear signal for both users and the engine that no further execution is expected after this step.
