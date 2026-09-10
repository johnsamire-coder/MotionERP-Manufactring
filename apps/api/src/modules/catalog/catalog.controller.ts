import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseFilters } from '@nestjs/common';
import { CreateItemCategoryDto, CreateItemDto, CreateUomDto, UpdateItemCategoryDto, UpdateItemDto } from './catalog.dto';
import { CatalogExceptionFilter } from './catalog.exception-filter';
import { CatalogService, type UpdateItemCategoryInput, type UpdateItemInput } from './catalog.service';
import type { ItemCategoryRecord, ItemCategoryTreeNode, ItemRecord, Language, UomClassRecord, UomRecord } from './catalog.types';

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
    const created = await this.service.createItem({
      code: dto.code, name: dto.name, nameAr: dto.nameAr, nameEn: dto.nameEn,
      description: dto.description, itemType: dto.itemType, categoryId: dto.categoryId, baseUnitId: dto.baseUnitId,
    });
    return { item: created };
  }

  @Patch('items/:id')
  async updateItem(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateItemDto): Promise<{ item: ItemRecord }> {
    const patch: UpdateItemInput = {};
    if (dto.name !== undefined) patch.name = dto.name;
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
}
