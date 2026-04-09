export type OptionSetValueType = 'STRING' | 'NUMBER' | 'BOOLEAN';

export interface OptionSetItem {
  label: string;
  value: string | number | boolean;
}

export interface MasterDataOptionSetPayload {
  name: string;
  description?: string;
  valueType: OptionSetValueType;
  options: OptionSetItem[];
  isActive?: boolean;
}
