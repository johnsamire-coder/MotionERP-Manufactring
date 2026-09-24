export interface CompanyProfileRecord {
  id: string;
  orgNodeId: string;
  displayName: string | null;
  logoUrl: string | null;
}
export interface UpsertCompanyProfileInput {
  displayName?: string | null;
  logoUrl?: string | null;
}
