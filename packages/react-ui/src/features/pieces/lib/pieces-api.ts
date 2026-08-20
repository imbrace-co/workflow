import {
  PieceMetadataModel,
  PieceMetadataModelSummary,
  PropertyType,
  ExecutePropsResult,
  InputPropertyMap,
} from '@activepieces/pieces-framework';
import {
  AddPieceRequestBody,
  GetPieceRequestParams,
  GetPieceRequestQuery,
  ListPiecesRequestQuery,
  PackageType,
  PieceOptionRequest,
} from '@activepieces/shared';
import { t } from 'i18next';

import { toast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';

export const piecesApi = {
  list(request: ListPiecesRequestQuery): Promise<PieceMetadataModelSummary[]> {
    return api.get<PieceMetadataModelSummary[]>('/v1/pieces', request);
  },
  get(
    request: GetPieceRequestParams & GetPieceRequestQuery,
  ): Promise<PieceMetadataModel> {
    return api.get<PieceMetadataModel>(`/v1/pieces/${request.name}`, {
      version: request.version ?? undefined,
      locale: request.locale ?? undefined,
    });
  },
  options<
    T extends
      | PropertyType.DROPDOWN
      | PropertyType.MULTI_SELECT_DROPDOWN
      | PropertyType.DYNAMIC,
  >(
    request: PieceOptionRequest,
    propertyType: T,
  ): Promise<ExecutePropsResult<T>> {
    try {
      const storedToken = window.localStorage.getItem('imbrace-access-token');
      if (storedToken && !request.imbraceToken) {
        (
          request as PieceOptionRequest & { imbraceToken?: string }
        ).imbraceToken = storedToken;
      }
    } catch (e) {
      // non-fatal
      // eslint-disable-next-line no-console
      console.warn('Failed to read imbraceToken from localStorage', e);
    }
    return api
      .post<ExecutePropsResult<T>>('/v1/pieces/options', request)
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error(error);
        toast({
          title: t('Error'),
          description: t(
            'An internal error occurred while fetching data, please contact support',
          ),
          variant: 'destructive',
        });
        const defaultStateForDynamicProperty: ExecutePropsResult<PropertyType.DYNAMIC> =
          {
            options: {} as InputPropertyMap,
            type: PropertyType.DYNAMIC,
          };
        const defaultStateForDropdownProperty: ExecutePropsResult<PropertyType.DROPDOWN> =
          {
            options: {
              options: [],
              disabled: true,
              placeholder: t(
                'An internal error occurred, please contact support',
              ),
            },
            type: PropertyType.DROPDOWN,
          };
        return (
          propertyType === PropertyType.DYNAMIC
            ? defaultStateForDynamicProperty
            : defaultStateForDropdownProperty
        ) as ExecutePropsResult<T>;
      });
  },
  syncFromCloud() {
    return api.post<void>(`/v1/pieces/sync`, {});
  },
  async install(params: AddPieceRequestBody) {
    const formData = new FormData();
    formData.set('packageType', params.packageType);
    formData.set('pieceName', params.pieceName);
    formData.set('pieceVersion', params.pieceVersion);
    formData.set('scope', params.scope);
    if (params.packageType === PackageType.ARCHIVE) {
      const buffer = await (
        params.pieceArchive as unknown as File
      ).arrayBuffer();
      formData.append('pieceArchive', new Blob([buffer]));
    }

    return api.post<PieceMetadataModel>('/v1/pieces', formData, undefined, {
      'Content-Type': 'multipart/form-data',
    });
  },
  delete(id: string) {
    return api.delete(`/v1/pieces/${id}`);
  },
};
