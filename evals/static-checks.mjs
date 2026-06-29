#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL(".", import.meta.url).pathname, "..");
const failures = [];

function fail(message) {
  failures.push(message);
}

function readJson(relativePath) {
  const fullPath = path.join(root, relativePath);
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (error) {
    fail(`${relativePath} is not valid JSON: ${error.message}`);
    return null;
  }
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

const gitignore = exists(".gitignore") ? fs.readFileSync(path.join(root, ".gitignore"), "utf8") : "";
if (!gitignore.split(/\r?\n/).includes(".env")) {
  fail(".gitignore must include .env");
}

const plugin = readJson("plugins/wordpress-com/.codex-plugin/plugin.json");
if (plugin) {
  const requiredTop = ["name", "version", "description", "author", "skills", "apps", "mcpServers", "interface"];
  for (const field of requiredTop) {
    if (!(field in plugin)) {
      fail(`plugin.json missing ${field}`);
    }
  }

  const iface = plugin.interface || {};
  for (const field of ["displayName", "shortDescription", "longDescription", "developerName", "category", "capabilities", "websiteURL", "defaultPrompt"]) {
    if (!(field in iface)) {
      fail(`plugin.json interface missing ${field}`);
    }
  }

  for (const assetField of ["composerIcon", "logo", "logoDark"]) {
    if (iface[assetField]) {
      const assetPath = iface[assetField].replace(/^\.\//, "plugins/wordpress-com/");
      if (!exists(assetPath)) {
        fail(`plugin.json interface.${assetField} points to missing file: ${iface[assetField]}`);
      }
      if (!iface[assetField].startsWith("./assets/")) {
        fail(`plugin.json interface.${assetField} should point under ./assets/`);
      }
    }
  }

  if (Array.isArray(iface.defaultPrompt) && iface.defaultPrompt.length > 3) {
    fail("plugin.json interface.defaultPrompt must contain at most 3 prompts");
  }
}

for (const relativePath of [
  ".agents/plugins/marketplace.json",
  "plugins/wordpress-com/.app.json",
  "plugins/wordpress-com/.mcp.json",
  "plugins/wordpress-com/review/chatgpt-app-submission.json",
]) {
  readJson(relativePath);
}

const skillsDir = path.join(root, "plugins/wordpress-com/skills");
for (const skillName of fs.readdirSync(skillsDir).sort()) {
  const skillPath = path.join(skillsDir, skillName, "SKILL.md");
  if (!fs.existsSync(skillPath)) {
    fail(`Missing SKILL.md for ${skillName}`);
    continue;
  }
  const content = fs.readFileSync(skillPath, "utf8");
  if (!content.startsWith("---")) {
    fail(`${skillName}/SKILL.md missing front matter`);
  }
  if (!/^name:\s*.+$/m.test(content)) {
    fail(`${skillName}/SKILL.md missing name in front matter`);
  }
  if (!/^description:\s*.+$/m.test(content)) {
    fail(`${skillName}/SKILL.md missing description in front matter`);
  }
}

const casesPath = path.join(root, "evals/cases.jsonl");
const seenCaseIds = new Set();
const cases = fs.readFileSync(casesPath, "utf8").trim().split(/\r?\n/).filter(Boolean).map((line, index) => {
  try {
    return JSON.parse(line);
  } catch (error) {
    fail(`evals/cases.jsonl line ${index + 1} is invalid JSON: ${error.message}`);
    return null;
  }
}).filter(Boolean);

for (const testCase of cases) {
  for (const field of ["id", "prompt", "expectedTarget"]) {
    if (!testCase[field]) {
      fail(`Case missing ${field}: ${JSON.stringify(testCase)}`);
    }
  }
  if (seenCaseIds.has(testCase.id)) {
    fail(`Duplicate case id: ${testCase.id}`);
  }
  seenCaseIds.add(testCase.id);
  if (!testCase.expectNoTools && !testCase.requiredTools && !testCase.finalContains) {
    fail(`Case ${testCase.id} has no meaningful grader fields`);
  }
}

if (cases.length < 10) {
  fail("Expected at least 10 eval cases");
}

if (failures.length > 0) {
  console.error(`Static checks failed (${failures.length}):`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Static checks passed (${cases.length} eval cases).`);
