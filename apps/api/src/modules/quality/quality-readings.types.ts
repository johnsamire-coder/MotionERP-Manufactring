import type { QualityInspectionRecord, QualityInspectionReferenceType } from './quality.types';

export interface TemplateParameterInput {
  parameterName: string;
  isNumeric: boolean;
  minValue?: string;
  maxValue?: string;
  acceptedValue?: string;
  readingsRequired?: number;
}
export interface TemplateParameterRecord extends Required<
  Pick<TemplateParameterInput, 'parameterName' | 'isNumeric'>
> {
  id: string;
  minValue: string | null;
  maxValue: string | null;
  acceptedValue: string | null;
  readingsRequired: number;
  position: number;
}
export interface InspectionTemplateRecord {
  id: string;
  code: string;
  name: string;
  itemId: string | null;
  createdAt: string;
  parameters: TemplateParameterRecord[];
}
export interface CreateInspectionTemplateInput {
  code: string;
  name: string;
  itemId?: string;
  parameters: TemplateParameterInput[];
}

export interface CreateInspectionFromTemplateInput {
  templateId: string;
  orgNodeId: string;
  itemId?: string;
  referenceType: QualityInspectionReferenceType;
  referenceId: string;
  notes?: string;
}

export interface ParameterCriteria {
  isNumeric: boolean;
  minValue: string | null;
  maxValue: string | null;
  acceptedValue: string | null;
  readingsRequired: number;
}
export interface ReadingRecord {
  readingNo: number;
  value: string;
  withinSpec: boolean;
}
export interface InspectionWithReadings extends Omit<QualityInspectionRecord, 'parameters'> {
  parameters: Array<
    QualityInspectionRecord['parameters'][number] &
      ParameterCriteria & { readings: ReadingRecord[] }
  >;
}
export interface RecordReadingsInput {
  readings: Array<{ parameterId: string; values: string[] }>;
  notes?: string;
}
