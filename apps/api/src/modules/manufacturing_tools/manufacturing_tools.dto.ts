import { IsUUID } from 'class-validator';

export class ReplaceBomDto {
  @IsUUID() currentBomId!: string;
  @IsUUID() newBomId!: string;
}
