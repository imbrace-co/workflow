export type BoardType =
  | 'Contacts'
  | 'Companies'
  | 'Opportunities'
  | 'Tasks'
  | 'Products'
  | 'General'
  | 'OptOut'
  | 'System'
  | 'KnowledgeHub';

export interface IDataPair {
  value: string;
  _id: string;
}

export interface IBoardField {
  _id: string;
  name: string;
  type: string;
  is_default: boolean;
  default_field_name: string;
  hidden: boolean;
  data: IDataPair[];
  [key: string]: string | boolean | IDataPair[];
}

export interface IBoard {
  _id: string;
  doc_name: string;
  business_unit_id: string;
  organization_id: string;
  name: string;
  description: string;
  type: BoardType;
  fields: IBoardField[];
  [key: string]: string | IBoardField[];
}