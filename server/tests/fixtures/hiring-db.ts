/** Native PostgreSQL binding for the explicitly disposable hiring fixture only. */
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../../shared/schema";

const address = process.env.HIRING_FLOW_TEST_DATABASE_URL;
if (!address) throw new Error("HIRING_FLOW_TEST_DATABASE_URL is required; never use DATABASE_URL");
const parsed = new URL(address);
if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/onspot_hiring_test" ||
    parsed.username !== "hiring_fixture") throw new Error("Hiring tests require the disposable local fixture database");
export const pool = new pg.Pool({ connectionString: address });
export const db = drizzle(pool, { schema });
export const query = (sql: string, params?: any[]) => pool.query(sql, params);
export const getClient = () => pool.connect();
