/**
 * Minimal Kysely dialect that wraps an @libsql/client Client.
 * Keeps better-auth on the same client (and therefore the same connection /
 * in-memory database) as the rest of the application.
 */
import {
  CompiledQuery,
  DefaultQueryCompiler,
  type Dialect,
  type Driver,
  type DatabaseConnection,
  type QueryResult,
  type DatabaseIntrospector,
  type DialectAdapter,
  type TransactionSettings,
  type MigrationLockOptions,
  type Kysely,
} from "kysely";
import type { Client } from "@libsql/client";

// ---------------------------------------------------------------------------
// Query compiler – standard SQLite dialect
// ---------------------------------------------------------------------------
class LibSqlQueryCompiler extends DefaultQueryCompiler {
  getCurrentParameterPlaceholder() {
    return "?";
  }
  getLeftIdentifierWrapper() {
    return '"';
  }
  getRightIdentifierWrapper() {
    return '"';
  }
  getAutoIncrement() {
    return "autoincrement";
  }
}

// ---------------------------------------------------------------------------
// Connection – forwards compiled queries to the libsql Client
// ---------------------------------------------------------------------------
class LibSqlConnection implements DatabaseConnection {
  constructor(private readonly client: Client) {}

  async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
    const { sql, parameters } = compiledQuery;
    const result = await this.client.execute({
      sql,
      args: parameters as any[],
    });
    return { rows: result.rows as unknown as R[] };
  }

  async *streamQuery<R>(
    _compiledQuery: CompiledQuery,
    _chunkSize?: number,
  ): AsyncGenerator<QueryResult<R>> {
    throw new Error("Streaming queries are not supported by SQLite.");
  }
}

// ---------------------------------------------------------------------------
// Driver – lifecycle + transaction primitives
// ---------------------------------------------------------------------------
class LibSqlDriver implements Driver {
  private connection!: LibSqlConnection;

  constructor(private readonly client: Client) {}

  async init() {
    this.connection = new LibSqlConnection(this.client);
  }
  async acquireConnection() {
    return this.connection;
  }
  async beginTransaction(
    connection: DatabaseConnection,
    _settings: TransactionSettings,
  ) {
    await connection.executeQuery(CompiledQuery.raw("BEGIN"));
  }
  async commitTransaction(connection: DatabaseConnection) {
    await connection.executeQuery(CompiledQuery.raw("COMMIT"));
  }
  async rollbackTransaction(connection: DatabaseConnection) {
    await connection.executeQuery(CompiledQuery.raw("ROLLBACK"));
  }
  async releaseConnection() {}
  async destroy() {
    this.client.close();
  }
}

// ---------------------------------------------------------------------------
// Adapter – capability flags
// ---------------------------------------------------------------------------
class LibSqlAdapter implements DialectAdapter {
  get supportsCreateIfNotExists() {
    return true;
  }
  get supportsTransactionalDdl() {
    return false;
  }
  get supportsReturning() {
    return true;
  }
  async acquireMigrationLock(_db: Kysely<any>, _options: MigrationLockOptions) {}
  async releaseMigrationLock(_db: Kysely<any>, _options: MigrationLockOptions) {}
}

// ---------------------------------------------------------------------------
// Dialect – public entry point
// ---------------------------------------------------------------------------
export class LibSqlDialect implements Dialect {
  constructor(private readonly config: { client: Client }) {}

  createDriver(): Driver {
    return new LibSqlDriver(this.config.client);
  }
  createQueryCompiler() {
    return new LibSqlQueryCompiler();
  }
  createAdapter() {
    return new LibSqlAdapter();
  }
  createIntrospector(_db: Kysely<any>): DatabaseIntrospector {
    return {
      async getSchemas() {
        return [];
      },
      async getTables() {
        return [];
      },
      async getMetadata() {
        return { tables: [] };
      },
    };
  }
}
