import { createPiece, PieceAuth } from '@activepieces/pieces-framework';
import { PieceCategory } from '@activepieces/shared';
import { listFlows } from './lib/actions/list-flows';
import { getFlow } from './lib/actions/get-flow';
import { createFlow } from './lib/actions/create-flow';
import { applyFlowOperation } from './lib/actions/apply-flow-operation';
import { deleteFlow } from './lib/actions/delete-flow';
import { listPieces } from './lib/actions/list-pieces';
import { getPieceDetails } from './lib/actions/get-piece-details';
import { listConnections } from './lib/actions/list-connections';
import { listFolders } from './lib/actions/list-folders';
import { getPieceOptions } from './lib/actions/get-piece-options';

export const workflow = createPiece({
  displayName: 'Workflow',
  description:
    'Manage flows, discover pieces, and check connections on the APWF backend. Designed for AI agent use via MCP.',
  auth: PieceAuth.None(),
  minimumSupportedRelease: '0.36.1',
  logoUrl: "https://cdn.activepieces.com/pieces/flow-helper.svg",
  categories: [PieceCategory.DEVELOPER_TOOLS],
  authors: ['imbrace'],
  actions: [
    listFlows,
    getFlow,
    createFlow,
    applyFlowOperation,
    deleteFlow,
    listPieces,
    getPieceDetails,
    listConnections,
    listFolders,
    getPieceOptions,
  ],
  triggers: [],
});
