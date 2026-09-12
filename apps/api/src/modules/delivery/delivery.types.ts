export type DeliveryStatus = 'scheduled' | 'in_transit' | 'delivered' | 'cancelled';
export type InstallationStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface DeliveryOrderRecord {
  id: string;
  jobOrderReference: string;
  orgNodeId: string | null;
  deliveryNumber: string;
  scheduledDate: Date;
  actualDate: Date | null;
  status: DeliveryStatus;
  vehiclePlate: string | null;
  driverName: string | null;
  notes: string | null;
}

export interface CreateDeliveryOrderInput {
  jobOrderReference: string;
  scheduledDate: Date;
  vehiclePlate?: string;
  driverName?: string;
  notes?: string;
}

export interface UpdateDeliveryOrderInput {
  actualDate?: Date;
  status?: DeliveryStatus;
  vehiclePlate?: string;
  driverName?: string;
  notes?: string;
}

export interface InstallationRecord {
  id: string;
  deliveryOrderId: string;
  scheduledDate: Date;
  actualStartDate: Date | null;
  actualEndDate: Date | null;
  status: InstallationStatus;
  technicianNames: string | null;
  location: string | null;
  notes: string | null;
}

export interface CreateInstallationInput {
  deliveryOrderId: string;
  scheduledDate: Date;
  technicianNames?: string;
  location?: string;
  notes?: string;
}

export interface UpdateInstallationInput {
  actualStartDate?: Date;
  actualEndDate?: Date;
  status?: InstallationStatus;
  technicianNames?: string;
  location?: string;
  notes?: string;
}

export interface DeliveryReceiptRecord {
  id: string;
  deliveryOrderId: string;
  receiptNumber: string;
  signedBy: string;
  signatureImage: string | null;
  receivedItems: string | null;
  notes: string | null;
  signedAt: Date;
}

export interface CreateDeliveryReceiptInput {
  deliveryOrderId: string;
  signedBy: string;
  signatureImage?: string;
  receivedItems?: string;
  notes?: string;
}

export interface InstallationReportRecord {
  id: string;
  installationId: string;
  reportNumber: string;
  performedBy: string;
  verifiedBy: string | null;
  completionNotes: string | null;
  issuesFound: string | null;
  correctiveActions: string | null;
  verifiedAt: Date | null;
}

export interface CreateInstallationReportInput {
  installationId: string;
  performedBy: string;
  verifiedBy?: string;
  completionNotes?: string;
  issuesFound?: string;
  correctiveActions?: string;
}
