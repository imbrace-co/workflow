import { createPiece, PieceAuth } from "@activepieces/pieces-framework";
import { createBoard } from "./lib/actions/create-board";
import { getBoard } from "./lib/actions/get-board";
import { getBoardDetails } from "./lib/actions/get-board-details";
import { updateBoard } from "./lib/actions/update-board";
import { deleteBoard } from "./lib/actions/delete-board";

export const databoard = createPiece({
  displayName: "Databoard",
  auth: PieceAuth.None(),
  minimumSupportedRelease: '0.36.1',
  logoUrl: '/node-icons/icon_automation.svg',
  authors: [],
  actions: [createBoard, getBoard, getBoardDetails, updateBoard, deleteBoard],
  triggers: [],
});
