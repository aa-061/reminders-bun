/**
 * Minimal Kysely dialect for Bun's native bun:sqlite Database.
 * Adapted from better-auth's internal BunSqliteDialect.
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
import type { Database } from "bun:sqlite";

// ---------------------------------------------------------------------------
// Query compiler — uses ? placeholders like standard SQLite
// ---------------------------------------------------------------------------
class BunSqliteQueryCompiler extends DefaultQueryCompiler {
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
// Connection — executes compiled queries against the Database
// ---------------------------------------------------------------------------
class BunSqliteConnection implements DatabaseConnection {
  readonly #db: Database;
  constructor(db: Database) {
    this.#db = db;
  }
  executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
    const { sql, parameters } = compiledQuery;
    const stmt = this.#db.prepare(sql);
    return Promise.resolve({ rows: stmt.all(...(parameters as any[])) as R[] });
  }
  async *streamQuery<R>(_compiledQuery: CompiledQuery, _chunkSize?: number): AsyncGenerator<QueryResult<R>> {
    throw new Error("Streaming queries are not supported by SQLite.");
  }
}

// ---------------------------------------------------------------------------
// Mutex — serialises access to the single SQLite connection
// ---------------------------------------------------------------------------
class ConnectionMutex {
  #promise?: Promise<void>;
  #resolve?: () => void;

  async lock() {
    while (this.#promise) await this.#promise;
    this.#promise = new Promise<void>((resolve) => {
      this.#resolve = resolve;
    });
  }

  unlock() {
    const resolve = this.#resolve;
    this.#promise = undefined;
    this.#resolve = undefined;
    resolve?.();
  }
}

// ---------------------------------------------------------------------------
// Driver — manages the connection lifecycle and transaction primitives
// ---------------------------------------------------------------------------
class BunSqliteDriver implements Driver {
  readonly #db: Database;
  readonly #mutex = new ConnectionMutex();
  #connection!: BunSqliteConnection;

  constructor(db: Database) {
    this.#db = db;
  }

  async init() {
    this.#connection = new BunSqliteConnection(this.#db);
  }
  async acquireConnection() {
    await this.#mutex.lock();
    return this.#connection;
  }
  async beginTransaction(connection: DatabaseConnection, _settings: TransactionSettings) {
    await connection.executeQuery(CompiledQuery.raw("begin"));
  }
  async commitTransaction(connection: DatabaseConnection) {
    await connection.executeQuery(CompiledQuery.raw("commit"));
  }
  async rollbackTransaction(connection: DatabaseConnection) {
    await connection.executeQuery(CompiledQuery.raw("rollback"));
  }
  async releaseConnection() {
    this.#mutex.unlock();
  }
  async destroy() {
    this.#db.close();
  }
}

// ---------------------------------------------------------------------------
// Adapter — capability flags queried by Kysely
// ---------------------------------------------------------------------------
class BunSqliteAdapter implements DialectAdapter {
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
// Dialect — the public entry point; wires everything together
// ---------------------------------------------------------------------------
export class BunSqliteDialect implements Dialect {
  readonly #db: Database;

  constructor(config: { database: Database }) {
    this.#db = config.database;
  }

  createDriver(): Driver {
    return new BunSqliteDriver(this.#db);
  }

  createQueryCompiler() {
    return new BunSqliteQueryCompiler();
  }

  createAdapter() {
    return new BunSqliteAdapter();
  }

  // Introspector is only used by migrations; return a no-op stub.
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
