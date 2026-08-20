import { Static, Type } from '@sinclair/typebox'
import { FlowStatus, FlowOperationStatus } from '../flow'

export const CountFlowsRequest = Type.Object({
    folderId: Type.Optional(Type.String()),
    status: Type.Optional(Type.Enum(FlowStatus)),
    tags: Type.Optional(Type.Array(Type.String())),
    operationStatus: Type.Optional(Type.Array(Type.Enum(FlowOperationStatus))),
})

export type CountFlowsRequest = Static<typeof CountFlowsRequest>
