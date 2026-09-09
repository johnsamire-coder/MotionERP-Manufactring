import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database.service';

export interface DatabaseHealth {
  status: 'up' | 'down';
  error?: string;
}

@Injectable()
export class DatabaseHealthIndicator {
  constructor(private readonly database: DatabaseService) {}

  async check(): Promise<DatabaseHealth> {
    try {
      await this.database.ping();
      return { status: 'up' };
    } catch (error) {
      return {
        status: 'down',
        error: error instanceof Error ? error.message : 'unknown error',
      };
    }
  }
}
