import { mock } from "node:test";
const deny = () => { throw new Error("External database access is forbidden in isolated regressions"); };
mock.module(process.cwd() + "/server/db.ts", {
  namedExports: { query: deny, getClient: deny, db: {}, pool: { query: deny, connect: deny, on() {} } },
});
// storage's inherited memory implementation constructs this KV client even
// when the test never uses it. Keep initialization independent of real URLs.
mock.module("@replit/database", { defaultExport: class IsolatedKV {
  get = deny; set = deny; delete = deny; list = deny;
} });