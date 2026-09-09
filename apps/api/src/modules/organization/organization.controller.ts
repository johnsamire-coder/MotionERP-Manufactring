import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseFilters,
} from '@nestjs/common';
import { CreateOrgNodeDto, UpdateOrgNodeDto } from './organization.dto';
import { OrganizationExceptionFilter } from './organization.exception-filter';
import { OrganizationService } from './organization.service';
import type {
  OrgNodeRecord,
  OrgNodeTypeSummary,
  OrgNodeWithAncestors,
  OrgTreeNode,
  UpdateOrgNodeInput,
} from './organization.types';

@Controller({ path: 'organization', version: '1' })
@UseFilters(OrganizationExceptionFilter)
export class OrganizationController {
  constructor(private readonly service: OrganizationService) {}

  /** Read-only view of the whole organizational structure. */
  @Get('tree')
  async tree(): Promise<{ tree: OrgTreeNode[] }> {
    return { tree: await this.service.getTree() };
  }

  /** The node-type vocabulary, each with the parent types it is allowed under. */
  @Get('node-types')
  async nodeTypes(): Promise<{ nodeTypes: OrgNodeTypeSummary[] }> {
    return { nodeTypes: await this.service.getNodeTypes() };
  }

  /** A single node by id. */
  @Get('nodes/:id')
  async node(@Param('id', ParseUUIDPipe) id: string): Promise<{ node: OrgNodeRecord }> {
    return { node: await this.service.getNode(id) };
  }

  /** The node plus its descendants, nested. */
  @Get('nodes/:id/subtree')
  async subtree(@Param('id', ParseUUIDPipe) id: string): Promise<{ subtree: OrgTreeNode }> {
    return { subtree: await this.service.getSubtree(id) };
  }

  /** The node together with its ancestor chain (root first, excludes the node). */
  @Get('nodes/:id/ancestors')
  async ancestors(@Param('id', ParseUUIDPipe) id: string): Promise<OrgNodeWithAncestors> {
    return this.service.getAncestors(id);
  }

  /** Create a node. Omit `parentId` (or send null) for a root node. */
  @Post('nodes')
  @HttpCode(201)
  async create(@Body() dto: CreateOrgNodeDto): Promise<{ node: OrgNodeRecord }> {
    const node = await this.service.createNode({
      nodeType: dto.nodeType,
      name: dto.name,
      parentId: dto.parentId ?? null,
      position: dto.position,
    });
    return { node };
  }

  /**
   * Update a node: rename, reposition and/or move. Only fields present in the
   * body are changed. `parentId: null` moves the node to the root.
   */
  @Patch('nodes/:id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrgNodeDto,
  ): Promise<{ node: OrgNodeRecord }> {
    const patch: UpdateOrgNodeInput = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.position !== undefined) patch.position = dto.position;
    if (dto.parentId !== undefined) patch.parentId = dto.parentId;

    const node = await this.service.updateNode(id, patch);
    return { node };
  }

  /** Archive a node (soft removal — no hard delete). */
  @Post('nodes/:id/archive')
  @HttpCode(200)
  async archive(@Param('id', ParseUUIDPipe) id: string): Promise<{ node: OrgNodeRecord }> {
    return { node: await this.service.archiveNode(id) };
  }
}
