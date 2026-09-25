import { Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, ne } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { CrmNotFoundError, CrmValidationError } from './crm.errors';
import { address, contact, customer, lead, partyLink, supplier } from './crm.schema';

export type PartyType = 'customer' | 'supplier' | 'lead';
export type OwnerType = 'contact' | 'address';
export const PARTY_TYPES: PartyType[] = ['customer', 'supplier', 'lead'];
export const ADDRESS_TYPES = [
  'billing',
  'shipping',
  'office',
  'warehouse',
  'site',
  'other',
] as const;

type ContactRow = typeof contact.$inferSelect;
type AddressRow = typeof address.$inferSelect;
type LinkRow = typeof partyLink.$inferSelect;
export interface PartyLinkRecord {
  id: string;
  partyType: PartyType;
  partyId: string;
  isPrimary: boolean;
}
export type ContactRecord = ContactRow & { links: PartyLinkRecord[] };
export type AddressRecord = AddressRow & { links: PartyLinkRecord[] };
export interface LinkInput {
  partyType: PartyType;
  partyId: string;
  isPrimary?: boolean;
}
export interface ContactInput {
  firstName: string;
  lastName?: string;
  designation?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  notes?: string;
  links?: LinkInput[];
}
export interface AddressInput {
  title: string;
  addressType?: (typeof ADDRESS_TYPES)[number];
  line1: string;
  line2?: string;
  city: string;
  governorate?: string;
  country?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  links?: LinkInput[];
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Plan item 26: contacts and addresses are records of their own, linked to any number of parties
 * (customer / supplier / lead) by type + UUID. A party has at most one primary contact and one
 * primary address; making a link primary clears the previous one.
 */
@Injectable()
export class ContactService {
  constructor(private readonly database: DatabaseService) {}

  // ── contacts ──
  async createContact(input: ContactInput): Promise<ContactRecord> {
    const firstName = input.firstName?.trim();
    if (!firstName) throw new CrmValidationError('firstName is required');
    this.checkEmail(input.email);
    for (const l of input.links ?? []) await this.checkParty(l.partyType, l.partyId);
    const row = (
      await this.database.db
        .insert(contact)
        .values({
          firstName,
          lastName: input.lastName?.trim() || null,
          designation: input.designation?.trim() || null,
          email: input.email?.trim().toLowerCase() || null,
          phone: input.phone?.trim() || null,
          mobile: input.mobile?.trim() || null,
          notes: input.notes ?? null,
        })
        .returning()
    )[0]!;
    for (const l of input.links ?? []) await this.link('contact', row.id, l);
    return this.getContact(row.id);
  }

  async updateContact(
    id: string,
    input: Partial<Omit<ContactInput, 'links'>> & { status?: 'active' | 'inactive' },
  ): Promise<ContactRecord> {
    await this.getContact(id);
    this.checkEmail(input.email);
    if (input.firstName !== undefined && !input.firstName.trim())
      throw new CrmValidationError('firstName cannot be empty');
    await this.database.db
      .update(contact)
      .set({
        ...(input.firstName !== undefined ? { firstName: input.firstName.trim() } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName.trim() || null } : {}),
        ...(input.designation !== undefined ? { designation: input.designation || null } : {}),
        ...(input.email !== undefined ? { email: input.email.trim().toLowerCase() || null } : {}),
        ...(input.phone !== undefined ? { phone: input.phone.trim() || null } : {}),
        ...(input.mobile !== undefined ? { mobile: input.mobile.trim() || null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        updatedAt: new Date(),
      })
      .where(eq(contact.id, id));
    return this.getContact(id);
  }

  async getContact(id: string): Promise<ContactRecord> {
    const row = (await this.database.db.select().from(contact).where(eq(contact.id, id)))[0];
    if (!row) throw new CrmNotFoundError(`contact ${id} does not exist`);
    return { ...row, links: await this.linksOf('contact', id) };
  }

  async listContacts(partyType?: PartyType, partyId?: string): Promise<ContactRecord[]> {
    const ids = await this.ownerIds('contact', partyType, partyId);
    const q = this.database.db.select().from(contact);
    const rows = ids ? (ids.length ? await q.where(inArray(contact.id, ids)) : []) : await q;
    return Promise.all(
      rows.map(async (r) => ({ ...r, links: await this.linksOf('contact', r.id) })),
    );
  }

  // ── addresses ──
  async createAddress(input: AddressInput): Promise<AddressRecord> {
    const title = input.title?.trim();
    const line1 = input.line1?.trim();
    const city = input.city?.trim();
    if (!title || !line1 || !city)
      throw new CrmValidationError('title, line1 and city are required');
    this.checkEmail(input.email);
    for (const l of input.links ?? []) await this.checkParty(l.partyType, l.partyId);
    const row = (
      await this.database.db
        .insert(address)
        .values({
          title,
          addressType: input.addressType ?? 'billing',
          line1,
          line2: input.line2?.trim() || null,
          city,
          governorate: input.governorate?.trim() || null,
          country: input.country?.trim() || 'Egypt',
          postalCode: input.postalCode?.trim() || null,
          phone: input.phone?.trim() || null,
          email: input.email?.trim().toLowerCase() || null,
        })
        .returning()
    )[0]!;
    for (const l of input.links ?? []) await this.link('address', row.id, l);
    return this.getAddress(row.id);
  }

  async getAddress(id: string): Promise<AddressRecord> {
    const row = (await this.database.db.select().from(address).where(eq(address.id, id)))[0];
    if (!row) throw new CrmNotFoundError(`address ${id} does not exist`);
    return { ...row, links: await this.linksOf('address', id) };
  }

  async listAddresses(partyType?: PartyType, partyId?: string): Promise<AddressRecord[]> {
    const ids = await this.ownerIds('address', partyType, partyId);
    const q = this.database.db.select().from(address);
    const rows = ids ? (ids.length ? await q.where(inArray(address.id, ids)) : []) : await q;
    return Promise.all(
      rows.map(async (r) => ({ ...r, links: await this.linksOf('address', r.id) })),
    );
  }

  // ── links ──
  async addLink(
    ownerType: OwnerType,
    ownerId: string,
    input: LinkInput,
  ): Promise<PartyLinkRecord[]> {
    if (ownerType === 'contact') await this.getContact(ownerId);
    else await this.getAddress(ownerId);
    await this.checkParty(input.partyType, input.partyId);
    await this.link(ownerType, ownerId, input);
    return this.linksOf(ownerType, ownerId);
  }

  async removeLink(ownerType: OwnerType, ownerId: string, linkId: string): Promise<void> {
    const deleted = await this.database.db
      .delete(partyLink)
      .where(
        and(
          eq(partyLink.id, linkId),
          eq(partyLink.ownerType, ownerType),
          eq(partyLink.ownerId, ownerId),
        ),
      )
      .returning({ id: partyLink.id });
    if (deleted.length === 0) throw new CrmNotFoundError(`link ${linkId} does not exist`);
  }

  /** Everything linked to one party, with its primary contact and address first. */
  async party(
    partyType: PartyType,
    partyId: string,
  ): Promise<{
    contacts: ContactRecord[];
    addresses: AddressRecord[];
    primaryContactId: string | null;
    primaryAddressId: string | null;
  }> {
    await this.checkParty(partyType, partyId);
    const contacts = await this.listContacts(partyType, partyId);
    const addresses = await this.listAddresses(partyType, partyId);
    const primaryOf = (rows: Array<{ id: string; links: PartyLinkRecord[] }>): string | null =>
      rows.find((r) =>
        r.links.some((l) => l.partyType === partyType && l.partyId === partyId && l.isPrimary),
      )?.id ?? null;
    const primaryContactId = primaryOf(contacts);
    const primaryAddressId = primaryOf(addresses);
    const first = <T extends { id: string }>(rows: T[], id: string | null): T[] =>
      [...rows].sort((a, b) => Number(b.id === id) - Number(a.id === id));
    return {
      contacts: first(contacts, primaryContactId),
      addresses: first(addresses, primaryAddressId),
      primaryContactId,
      primaryAddressId,
    };
  }

  // ── helpers ──
  private checkEmail(email?: string): void {
    if (email && email.trim() && !EMAIL.test(email.trim()))
      throw new CrmValidationError(`"${email}" is not a valid e-mail address`);
  }

  private async checkParty(partyType: PartyType, partyId: string): Promise<void> {
    if (!PARTY_TYPES.includes(partyType))
      throw new CrmValidationError(`partyType must be one of ${PARTY_TYPES.join(', ')}`);
    const table = { customer, supplier, lead }[partyType];
    const found = await this.database.db
      .select({ id: table.id })
      .from(table)
      .where(eq(table.id, partyId))
      .limit(1);
    if (found.length === 0) throw new CrmNotFoundError(`${partyType} ${partyId} does not exist`);
  }

  private async link(ownerType: OwnerType, ownerId: string, l: LinkInput): Promise<void> {
    await this.database.db.transaction(async (tx) => {
      if (l.isPrimary) {
        await tx
          .update(partyLink)
          .set({ isPrimary: false })
          .where(
            and(
              eq(partyLink.ownerType, ownerType),
              eq(partyLink.partyType, l.partyType),
              eq(partyLink.partyId, l.partyId),
              ne(partyLink.ownerId, ownerId),
            ),
          );
      }
      await tx
        .insert(partyLink)
        .values({
          ownerType,
          ownerId,
          partyType: l.partyType,
          partyId: l.partyId,
          isPrimary: l.isPrimary ?? false,
        })
        .onConflictDoUpdate({
          target: [partyLink.ownerType, partyLink.ownerId, partyLink.partyType, partyLink.partyId],
          set: { isPrimary: l.isPrimary ?? false },
        });
    });
  }

  private async linksOf(ownerType: OwnerType, ownerId: string): Promise<PartyLinkRecord[]> {
    const rows: LinkRow[] = await this.database.db
      .select()
      .from(partyLink)
      .where(and(eq(partyLink.ownerType, ownerType), eq(partyLink.ownerId, ownerId)))
      .orderBy(asc(partyLink.createdAt));
    return rows.map((r) => ({
      id: r.id,
      partyType: r.partyType as PartyType,
      partyId: r.partyId,
      isPrimary: r.isPrimary,
    }));
  }

  /** Owner ids linked to the party, or null when no party filter was given. */
  private async ownerIds(
    ownerType: OwnerType,
    partyType?: PartyType,
    partyId?: string,
  ): Promise<string[] | null> {
    if (!partyType && !partyId) return null;
    if (!partyType || !partyId) throw new CrmValidationError('partyType and partyId go together');
    const rows = await this.database.db
      .select({ ownerId: partyLink.ownerId })
      .from(partyLink)
      .where(
        and(
          eq(partyLink.ownerType, ownerType),
          eq(partyLink.partyType, partyType),
          eq(partyLink.partyId, partyId),
        ),
      );
    return rows.map((r) => r.ownerId);
  }
}
