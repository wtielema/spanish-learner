/* Shared API response types matching the backend entities */

export interface Area {
  id: string;
  siteId: string;
  nameI18n: Record<string, string>;
  areaType: string;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface WorkCenter {
  id: string;
  areaId: string;
  nameI18n: Record<string, string>;
  descriptionI18n: Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  sku: string;
  nameI18n: Record<string, string>;
  descriptionI18n: Record<string, string> | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkOrder {
  id: string;
  orderNumber: string;
  productId: string;
  areaId: string;
  workCenterId: string;
  controlRecipeId: string | null;
  quantityTarget: number;
  quantityProduced: number;
  quantityRejected: number;
  status: string;
  priority: number;
  scheduledStart: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  product?: Product;
  area?: Area;
  workCenter?: WorkCenter;
}

export interface ProductionLog {
  id: string;
  workOrderId: string;
  workUnitId: string | null;
  timestamp: string;
  eventType: string;
  value: number | null;
  reasonCodeId: string | null;
  operatorId: string | null;
  comment: string | null;
}

export interface ReasonCode {
  id: string;
  areaId: string | null;
  category: string;
  nameI18n: Record<string, string>;
  requiresComment: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QcTemplate {
  id: string;
  areaId: string | null;
  productId: string | null;
  nameI18n: Record<string, string>;
  trigger: string;
  triggerValue: number | null;
  isMandatory: boolean;
  applicableWorkCenters: string[];
  createdAt: string;
  updatedAt: string;
  params?: QcTemplateParam[];
}

export interface QcTemplateParam {
  id: string;
  templateId: string;
  nameI18n: Record<string, string>;
  paramType: string;
  unit: string | null;
  targetValue: number | null;
  lowerLimit: number | null;
  upperLimit: number | null;
  optionsI18n: Record<string, string[]> | null;
  sequence: number;
}

export interface QcCheck {
  id: string;
  workOrderId: string;
  templateId: string;
  status: string;
  scheduledAt: string | null;
  completedAt: string | null;
  operatorId: string | null;
  createdAt: string;
  template?: QcTemplate;
  results?: QcResult[];
  workOrder?: WorkOrder;
}

export interface QcResult {
  id: string;
  checkId: string;
  paramId: string;
  value: string | null;
  isInSpec: boolean | null;
  comment: string | null;
  param?: QcTemplateParam;
}

export interface QcDeviation {
  id: string;
  checkId: string | null;
  workOrderId: string;
  severity: string;
  description: string;
  actionTaken: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdBy: string;
  createdAt: string;
  workOrder?: WorkOrder;
}

export interface QcHold {
  id: string;
  workOrderId: string;
  deviationId: string | null;
  holdType: string;
  placedBy: string;
  placedAt: string;
  releasedBy: string | null;
  releasedAt: string | null;
  disposition: string | null;
  justification: string | null;
  workOrder?: WorkOrder;
}
