import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("agent index is current and covers calculator entry points", () => {
  execFileSync(process.execPath, ["scripts/generate-agent-index.mjs", "--check"], {
    cwd: root,
    stdio: "pipe",
  });
  const routes = readFileSync(path.join(root, "docs/agent-index/routes.md"), "utf8");
  const pages = readFileSync(path.join(root, "docs/agent-index/pages.md"), "utf8");
  const schema = readFileSync(path.join(root, "docs/agent-index/schema.md"), "utf8");
  const modules = readFileSync(path.join(root, "docs/agent-index/modules.md"), "utf8");

  assert.match(routes, /\| `\/api\/buildings` \| GET \|/);
  assert.match(routes, /\| `\/api\/registry` \| (?:GET|POST) \|/);
  assert.match(pages, /\| `\/` \|/);
  assert.match(schema, /\| table \| `feedback_reports` \|/);
  assert.match(modules, /\| `handleBuildings` \|/);
});
