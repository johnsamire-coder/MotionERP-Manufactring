import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseFilters } from '@nestjs/common';
import {
  ConvertUomQueryDto,
  CreateItemCategoryDto,
  CreateItemDto,
  CreateUomConversionDto,
  CreateUomDto,
  UpdateItemCategoryDto,
  UpdateItemDto,
} from './catalog.dto';
import { CatalogExceptionFilter } from './catalog.exception-filter';
import { CatalogService, type UpdateItemCategoryInput, type UpdateItemInput } from './catalog.service';
import type {
  ConvertUomResult,
  ItemCategoryRecord,
  ItemCategoryTreeNode,
  ItemRecord,
  Language,
  UomClassRecord,
  UomConversionRecord,
  UomRecord,
} from './catalog.types';

function parseLang(lang?: string): Language { return lang === 'ar' ? 'ar' : 'en'; }

@Controller({ path: 'catalog', version: '1' })
@UseFilters(CatalogExceptionFilter)
export class CatalogController {
  constructor(private readonly service: CatalogService) {}

  @Get('uom-classes')
  async uomClasses(): Promise<{ uomClasses: UomClassRecord[] }> { return { uomClasses: await this.service.getUomClasses() }; }

  @Get('uoms')
  async uoms(@Query('lang') lang?: string): Promise<{ uoms: UomRecord[] }> { return { uoms: await this.service.getUoms(parseLang(lang)) }; }

  @Get('uoms/:code')
  async uom(@Param('code') code: string, @Query('lang') lang?: string): Promise<{ uom: UomRecord }> {
    return { uom: await this.service.getUomByCode(code, parseLang(lang)) };
  }

  @Post('uoms') @HttpCode(201)
  async createUom(@Body() dto: CreateUomDto): Promise<{ uom: UomRecord }> {
    const created = await this.service.createUom({
      code: dto.code, name: dto.name, nameAr: dto.nameAr, nameEn: dto.nameEn,
      symbol: dto.symbol, classCode: dto.classCode, decimalPrecision: dto.decimalPrecision,
    });
    return { uom: created };
  }

  @Get('categories/tree')
  async categoryTree(@Query('lang') lang?: string): Promise<{ tree: ItemCategoryTreeNode[] }> {
    return { tree: await this.service.getCategoryTree(parseLang(lang)) };
  }

  @Get('categories/:id')
  async category(@Param('id', ParseUUIDPipe) id: string, @Query('lang') lang?: string): Promise<{ category: ItemCategoryRecord }> {
    return { category: await this.service.getCategory(id, parseLang(lang)) };
  }

  @Post('categories') @HttpCode(201)
  async createCategory(@Body() dto: CreateItemCategoryDto): Promise<{ category: ItemCategoryRecord }> {
    const created = await this.service.createCategory({
      code: dto.code, name: dto.name, nameAr: dto.nameAr, nameEn: dto.nameEn,
      description: dto.description, parentId: dto.parentId ?? null, position: dto.position,
    });
    return { category: created };
  }

  @Patch('categories/:id')
  async updateCategory(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateItemCategoryDto): Promise<{ category: ItemCategoryRecord }> {
    const patch: UpdateItemCategoryInput = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.position !== undefined) patch.position = dto.position;
    if (dto.parentId !== undefined) patch.parentId = dto.parentId;
    return { category: await this.service.updateCategory(id, patch) };
  }

  @Post('categories/:id/archive') @HttpCode(200)
  async archiveCategory(@Param('id', ParseUUIDPipe) id: string): Promise<{ category: ItemCategoryRecord }> {
    return { category: await this.service.archiveCategory(id) };
  }

  @Get('items')
  async items(@Query('lang') lang?: string): Promise<{ items: ItemRecord[] }> { return { items: await this.service.getItems(parseLang(lang)) }; }

  @Get('items/:id')
  async itemById(@Param('id', ParseUUIDPipe) id: string, @Query('lang') lang?: string): Promise<{ item: ItemRecord }> {
    return { item: await this.service.getItem(id, parseLang(lang)) };
  }

  @Post('items') @HttpCode(201)
  async createItem(@Body() dto: CreateItemDto): Promise<{ item: ItemRecord }> {
    const created = await this.service.createItem(dto);
    return { item: created };
  }

  @Patch('items/:id')
  async updateItem(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateItemDto): Promise<{ item: ItemRecord }> {
    const patch: UpdateItemInput = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.nameAr !== undefined) patch.nameAr = dto.nameAr;
    if (dto.nameEn !== undefined) patch.nameEn = dto.nameEn;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.itemType !== undefined) patch.itemType = dto.itemType;
    if (dto.categoryId !== undefined) patch.categoryId = dto.categoryId;
    if (dto.baseUnitId !== undefined) patch.baseUnitId = dto.baseUnitId;
    return { item: await this.service.updateItem(id, patch) };
  }

  @Post('items/:id/archive') @HttpCode(200)
  async archiveItem(@Param('id', ParseUUIDPipe) id: string): Promise<{ item: ItemRecord }> {
    return { item: await this.service.archiveItem(id) };
  }

  // --- UOM Conversion Endpoints ---
  @Get('uom-conversions')
  async uomConversions(@Query('itemId') itemId?: string): Promise<{ uomConversions: UomConversionRecord[] }> {
    return { uomConversions: await this.service.getUomConversions(itemId) };
  }

  @Post('uom-conversions')
  @HttpCode(201)
  async createUomConversion(@Body() dto: CreateUomConversionDto): Promise<{ uomConversion: UomConversionRecord }> {
    return { uomConversion: await this.service.createUomConversion(dto) };
  }

  @Get('convert-uom')
  async convertUom(@Query() query: ConvertUomQueryDto): Promise<ConvertUomResult> {
    return this.service.convertQuantity(
      query.itemId,
      query.fromUnitId,
      query.toUnitId,
      Number(query.quantity),
    );
  }
}