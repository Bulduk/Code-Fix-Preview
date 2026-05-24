import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

let pool: pg.Pool | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

if (process.env.DATABASE_URL) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  _db = drizzle(pool, { schema });
}

// A chainable thenable that resolves to [] (empty array).
// This lets callers do: await db.select().from(table).where(...) → []
// and insert/update/delete → []
// All callers already have try/catch and fallback to mock data.
function makeChain(resolveValue: unknown = []): unknown {
  const handler: ProxyHandler<object> = {
    get(_t, prop: string | symbol) {
      if (prop === "then") {
        return (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
          Promise.resolve(resolveValue).then(onFulfilled, onRejected);
      }
      if (prop === "catch") {
        return (onRejected: (e: unknown) => unknown) =>
          Promise.resolve(resolveValue).catch(onRejected);
      }
      if (prop === "finally") {
        return (onFinally: () => void) =>
          Promise.resolve(resolveValue).finally(onFinally);
      }
      // Any method call returns another chain
      return (..._args: unknown[]) => makeChain(resolveValue);
    },
  };
  return new Proxy({}, handler);
}

// Mock db where every method returns a chainable that resolves to []
const mockDb = new Proxy(
  {} as ReturnType<typeof drizzle<typeof schema>>,
  {
    get(_target, _prop) {
      return (..._args: unknown[]) => makeChain([]);
    },
  }
);

export { pool };
export const db: ReturnType<typeof drizzle<typeof schema>> =
  _db ?? (mockDb as ReturnType<typeof drizzle<typeof schema>>);
export * from "./schema";
