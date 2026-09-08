import { PieceMetadataSchema } from './piece-metadata-entity'

// Community edition: piece filtering per platform/project is an enterprise
// feature, so nothing is filtered here.
export const enterpriseFilteringUtils = {
    async filter(params: FilterParams): Promise<PieceMetadataSchema[]> {
        return params.pieces
    },
    async isFiltered(_params: IsFilteredParams): Promise<boolean> {
        return false
    },
}

type IsFilteredParams = {
    piece: PieceMetadataSchema
    projectId: string | undefined
    platformId: string | undefined
}

type FilterParams = {
    pieces: PieceMetadataSchema[]
    platformId?: string
    projectId?: string
    includeHidden?: boolean
}
