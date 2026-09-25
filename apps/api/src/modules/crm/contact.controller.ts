import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseFilters,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CrmExceptionFilter } from './crm.exception-filter';
import {
  ADDRESS_TYPES,
  ContactService,
  PARTY_TYPES,
  type AddressRecord,
  type ContactRecord,
  type PartyLinkRecord,
  type PartyType,
} from './contact.service';

export class LinkDto {
  @IsIn(PARTY_TYPES) partyType!: PartyType;
  @IsUUID() partyId!: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}
export class ContactDto {
  @IsString() @MaxLength(100) firstName!: string;
  @IsOptional() @IsString() @MaxLength(100) lastName?: string;
  @IsOptional() @IsString() @MaxLength(100) designation?: string;
  @IsOptional() @IsString() @MaxLength(200) email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(40) mobile?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LinkDto)
  links?: LinkDto[];
}
export class UpdateContactDto {
  @IsOptional() @IsString() @MaxLength(100) firstName?: string;
  @IsOptional() @IsString() @MaxLength(100) lastName?: string;
  @IsOptional() @IsString() @MaxLength(100) designation?: string;
  @IsOptional() @IsString() @MaxLength(200) email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(40) mobile?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional() @IsIn(['active', 'inactive']) status?: 'active' | 'inactive';
}
export class AddressDto {
  @IsString() @MaxLength(200) title!: string;
  @IsOptional() @IsIn(ADDRESS_TYPES) addressType?: (typeof ADDRESS_TYPES)[number];
  @IsString() @MaxLength(300) line1!: string;
  @IsOptional() @IsString() @MaxLength(300) line2?: string;
  @IsString() @MaxLength(100) city!: string;
  @IsOptional() @IsString() @MaxLength(100) governorate?: string;
  @IsOptional() @IsString() @MaxLength(100) country?: string;
  @IsOptional() @IsString() @MaxLength(20) postalCode?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(200) email?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LinkDto)
  links?: LinkDto[];
}

/** Plan item 26: contacts, addresses and their links to customers / suppliers / leads. */
@Controller({ path: 'crm', version: '1' })
@UseFilters(CrmExceptionFilter)
export class ContactController {
  constructor(private readonly service: ContactService) {}

  @Get('contacts')
  async contacts(
    @Query('partyType') partyType?: PartyType,
    @Query('partyId') partyId?: string,
  ): Promise<{ contacts: ContactRecord[] }> {
    return { contacts: await this.service.listContacts(partyType, partyId) };
  }

  @Post('contacts')
  @HttpCode(201)
  async createContact(@Body() dto: ContactDto): Promise<{ contact: ContactRecord }> {
    return { contact: await this.service.createContact(dto) };
  }

  @Get('contacts/:id')
  async contact(@Param('id', ParseUUIDPipe) id: string): Promise<{ contact: ContactRecord }> {
    return { contact: await this.service.getContact(id) };
  }

  @Patch('contacts/:id')
  async updateContact(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContactDto,
  ): Promise<{ contact: ContactRecord }> {
    return { contact: await this.service.updateContact(id, dto) };
  }

  @Post('contacts/:id/links')
  @HttpCode(200)
  async linkContact(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkDto,
  ): Promise<{ links: PartyLinkRecord[] }> {
    return { links: await this.service.addLink('contact', id, dto) };
  }

  @Delete('contacts/:id/links/:linkId')
  @HttpCode(204)
  async unlinkContact(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
  ): Promise<void> {
    await this.service.removeLink('contact', id, linkId);
  }

  @Get('addresses')
  async addresses(
    @Query('partyType') partyType?: PartyType,
    @Query('partyId') partyId?: string,
  ): Promise<{ addresses: AddressRecord[] }> {
    return { addresses: await this.service.listAddresses(partyType, partyId) };
  }

  @Post('addresses')
  @HttpCode(201)
  async createAddress(@Body() dto: AddressDto): Promise<{ address: AddressRecord }> {
    return { address: await this.service.createAddress(dto) };
  }

  @Get('addresses/:id')
  async address(@Param('id', ParseUUIDPipe) id: string): Promise<{ address: AddressRecord }> {
    return { address: await this.service.getAddress(id) };
  }

  @Post('addresses/:id/links')
  @HttpCode(200)
  async linkAddress(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkDto,
  ): Promise<{ links: PartyLinkRecord[] }> {
    return { links: await this.service.addLink('address', id, dto) };
  }

  @Delete('addresses/:id/links/:linkId')
  @HttpCode(204)
  async unlinkAddress(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
  ): Promise<void> {
    await this.service.removeLink('address', id, linkId);
  }

  @Get('parties/:partyType/:partyId/contact-details')
  async party(
    @Param('partyType') partyType: PartyType,
    @Param('partyId', ParseUUIDPipe) partyId: string,
  ): Promise<Awaited<ReturnType<ContactService['party']>>> {
    return this.service.party(partyType, partyId);
  }
}
