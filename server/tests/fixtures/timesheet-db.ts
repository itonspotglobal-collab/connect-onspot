/** Native binding for the explicitly owned disposable timesheet database only. */
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../../shared/schema";

const address = process.env.TIMESHEET_TEST_DATABASE_URL;
if (!address || address !== process.env.DATABASE_URL)
  throw new Error("Timesheet tests require matching owned fixture database URLs");
const parsed = new URL(address);
if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/onspot_timesheet_fixture"
  || parsed.username !== "timesheet_fixture")
  throw new Error("Timesheet tests require the disposable local fixture database");
export const pool = new pg.Pool({ connectionString: address });
export const applicantEmailLedgerPool = new pg.Pool({ connectionString: address, max: 2 });
export const applicantEmailLedgerQuery = (sql: string, params?: any[]) => applicantEmailLedgerPool.query(sql, params);
export const db = drizzle(pool, { schema });
export const query = (sql: string, params?: any[]) => pool.query(sql, params);
export const getClient = () => pool.connect();
