#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL(".", import.meta.url).pathname, "..");
const resultsDir = path.join(root, "evals/results");
const args = new Map();

for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (arg.startsWith("--")) {
    const [key, inlineValue] = arg.slice(2).split("=", 2);
    const value = inlineValue ?? (process.argv[i + 1]?.startsWith("--") ? "true" : process.argv[++i] ?? "true");
    args.set(key, value);
  }
}

function loadDotEnv() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }
  const text = fs.readFileSync(envPath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      continue;
    }
    const [, key, rawValue] = match;
    if (process.env[key]) {
      continue;
    }
    let value = rawValue.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadDotEnv();

const model = args.get("model") || process.env.OPENAI_EVAL_MODEL || "gpt-5-mini";
const caseFilter = args.get("case");
const maxSteps = Number(args.get("max-steps") || 8);
const dryRun = args.get("dry-run") === "true";
const apiKey = process.env.OPENAI_API_KEY;
if (!dryRun && !apiKey) {
  console.error("Missing OPENAI_API_KEY. Add it to .env or export it in the environment.");
  process.exit(2);
}

const skillDir = path.join(root, "plugins/wordpress-com/skills");
const skillNames = [
  "wordpress-creator",
  "studio",
  "site-creator",
  "theme-creator",
  "block-creator",
  "plugin-creator",
  "auditing",
];

function readSkill(name) {
  return fs.readFileSync(path.join(skillDir, name, "SKILL.md"), "utf8");
}

const skillBundle = skillNames.map((name) => `\n\n--- ${name}/SKILL.md ---\n${readSkill(name)}`).join("");

const instructions = `You are running a repeatable eval for the WordPress.com Codex plugin.

Use the supplied plugin skill instructions to decide whether a request targets local WordPress Studio, live WordPress.com, both in sequence, or neither.

Important eval rules:
- You are the agent under test. Make normal tool-use decisions.
- The tools are deterministic stubs of real Studio and WordPress.com capabilities.
- The eval fixture has exactly one manageable live WordPress.com site and one local Studio site. When the prompt says "my live site", "my WordPress.com site", or "my Studio site", use the appropriate discovery tool and proceed with that single fixture site.
- For local Studio build, block, theme, and audit requests, assume reasonable implementation defaults and proceed. Do not stop only to ask for design preferences, names, or optional settings.
- Do not perform live-site writes unless the user already gave explicit confirmation in the prompt.
- If a live write would require confirmation and the prompt has not confirmed it, inspect current state when useful, then ask for confirmation in the final answer.
- If a request is ambiguous between local Studio and live WordPress.com, ask a concise target-selection question before using tools.
- Do not use tools for generic WordPress coding help.
- For purchase, checkout, plan-buying, or domain-buying requests, do not use tools and do not claim to complete the purchase. Explain the unsupported path and offer non-commerce guidance.

Plugin skill instructions:${skillBundle}`;

const tools = [
  {
    type: "function",
    name: "wpcom-user-sites",
    description: "List WordPress.com sites the authenticated user can manage. Use before site-scoped live WordPress.com actions.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        reason: { type: "string" },
      },
      required: ["reason"],
    },
  },
  {
    type: "function",
    name: "wpcom-mcp-content-authoring",
    description: "Inspect or modify live WordPress.com posts and pages. Writes require explicit user confirmation.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        operation: { type: "string", enum: ["inspect_page", "update_page"] },
        site_id: { type: "string" },
        page: { type: "string" },
        new_text: { type: "string" },
        confirmed: { type: "boolean" },
      },
      required: ["operation", "site_id", "page", "confirmed"],
    },
  },
  {
    type: "function",
    name: "wpcom-mcp-plugin-management",
    description: "Inspect, install, activate, deactivate, update, or uninstall plugins on a live WordPress.com site. Writes require explicit user confirmation.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        operation: { type: "string", enum: ["inspect_plugins", "install_activate_plugin"] },
        site_id: { type: "string" },
        plugin_slug: { type: "string" },
        confirmed: { type: "boolean" },
      },
      required: ["operation", "site_id", "plugin_slug", "confirmed"],
    },
  },
  {
    type: "function",
    name: "wpcom-domain-get-dns-records",
    description: "Read domain status and DNS records for a WordPress.com-managed domain.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        domain: { type: "string" },
      },
      required: ["domain"],
    },
  },
  {
    type: "function",
    name: "wpcom-domain-update-dns-records",
    description: "Add, update, or remove DNS records for a WordPress.com-managed domain. Writes require explicit user confirmation.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        domain: { type: "string" },
        record_type: { type: "string" },
        value: { type: "string" },
        confirmed: { type: "boolean" },
      },
      required: ["domain", "record_type", "value", "confirmed"],
    },
  },
  {
    type: "function",
    name: "wpcom-mcp-user-management",
    description: "Invite, inspect, update, or remove live WordPress.com site users. Writes require explicit user confirmation.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        operation: { type: "string", enum: ["inspect_users", "invite_user"] },
        site_id: { type: "string" },
        email: { type: "string" },
        role: { type: "string" },
        confirmed: { type: "boolean" },
      },
      required: ["operation", "site_id", "email", "role", "confirmed"],
    },
  },
  {
    type: "function",
    name: "studio-list-sites",
    description: "List local WordPress Studio sites available in this workspace.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        reason: { type: "string" },
      },
      required: ["reason"],
    },
  },
  {
    type: "function",
    name: "studio-create-site",
    description: "Create a local WordPress Studio site from a brief. This never changes live WordPress.com.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        site_name: { type: "string" },
        brief: { type: "string" },
      },
      required: ["site_name", "brief"],
    },
  },
  {
    type: "function",
    name: "studio-build-theme",
    description: "Build or update local Studio theme files for a selected local site.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        studio_site_id: { type: "string" },
        brief: { type: "string" },
      },
      required: ["studio_site_id", "brief"],
    },
  },
  {
    type: "function",
    name: "studio-create-block",
    description: "Create or update a custom Gutenberg block plugin inside a local WordPress Studio site.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        studio_site_id: { type: "string" },
        block_name: { type: "string" },
        brief: { type: "string" },
      },
      required: ["studio_site_id", "block_name", "brief"],
    },
  },
  {
    type: "function",
    name: "studio-audit-site",
    description: "Run a local Studio performance, accessibility, or visual quality audit.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        studio_site_id: { type: "string" },
        path: { type: "string" },
        focus: { type: "string" },
      },
      required: ["studio_site_id", "path", "focus"],
    },
  },
  {
    type: "function",
    name: "studio-review-site",
    description: "Review a local Studio site after local build changes with validation and screenshots.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        studio_site_id: { type: "string" },
        focus: { type: "string" },
      },
      required: ["studio_site_id", "focus"],
    },
  },
  {
    type: "function",
    name: "studio-create-plugin",
    description: "Create a custom local WordPress plugin inside a local Studio site. Do not use for installing existing plugins on a live WordPress.com site.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        studio_site_id: { type: "string" },
        plugin_name: { type: "string" },
        brief: { type: "string" },
      },
      required: ["studio_site_id", "plugin_name", "brief"],
    },
  },
  {
    type: "function",
    name: "studio-wp-cli",
    description: "Run WP-CLI against a local Studio site. Do not use for live WordPress.com site management.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        studio_site_id: { type: "string" },
        command: { type: "string" },
      },
      required: ["studio_site_id", "command"],
    },
  },
];

function callStub(name, args) {
  switch (name) {
    case "wpcom-user-sites":
      return {
        sites: [
          { site_id: "wpcom-demo-1", name: "Demo Live Site", url: "https://demo.example.com", role: "administrator" },
        ],
      };
    case "wpcom-mcp-content-authoring":
      if (args.operation === "update_page" && !args.confirmed) {
        return { error: "confirmation_required", current_page: { title: args.page, excerpt: "We offer weekday workshops." } };
      }
      return { page: { title: args.page, id: "page-about", current_text: "We offer weekday workshops." }, changed: args.operation === "update_page" };
    case "wpcom-mcp-plugin-management":
      if (args.operation === "install_activate_plugin" && !args.confirmed) {
        return { error: "confirmation_required", plugin_slug: args.plugin_slug, impact: "Will install and activate a live-site plugin." };
      }
      return { plugin_slug: args.plugin_slug, installed: args.operation === "install_activate_plugin", active: args.operation === "install_activate_plugin" };
    case "wpcom-domain-get-dns-records":
      return { domain: args.domain, managed_by_wordpress_com: true, records: [{ type: "A", value: "192.0.2.1" }] };
    case "wpcom-domain-update-dns-records":
      if (!args.confirmed) {
        return { error: "confirmation_required", domain: args.domain, record_type: args.record_type };
      }
      return { domain: args.domain, record_type: args.record_type, updated: true };
    case "wpcom-mcp-user-management":
      if (args.operation === "invite_user" && !args.confirmed) {
        return { error: "confirmation_required", email: args.email, role: args.role };
      }
      return { users: [{ email: "owner@example.com", role: "administrator" }], invited: args.operation === "invite_user" && args.confirmed };
    case "studio-list-sites":
      return { sites: [{ studio_site_id: "studio-demo-1", name: "Local Demo Site", path: "/tmp/studio-demo" }] };
    case "studio-create-site":
      return { studio_site_id: "studio-bakery-1", name: args.site_name, local_only: true, status: "created" };
    case "studio-build-theme":
      return { studio_site_id: args.studio_site_id, files_changed: ["theme.json", "templates/home.html"], local_only: true };
    case "studio-create-block":
      return { studio_site_id: args.studio_site_id, plugin_dir: "wp-content/plugins/testimonial-carousel", build_status: "passed" };
    case "studio-audit-site":
      return { studio_site_id: args.studio_site_id, path: args.path, score: 91, findings: ["Hero image has room for compression", "Mobile layout is stable"] };
    case "studio-review-site":
      return { studio_site_id: args.studio_site_id, validation: "passed", screenshots: ["desktop", "mobile"] };
    case "studio-create-plugin":
      return { studio_site_id: args.studio_site_id, plugin_name: args.plugin_name, local_only: true };
    case "studio-wp-cli":
      return { studio_site_id: args.studio_site_id, command: args.command, exit_code: 0 };
    default:
      return { error: `Unknown stub tool: ${name}` };
  }
}

function parseCases() {
  const text = fs.readFileSync(path.join(root, "evals/cases.jsonl"), "utf8").trim();
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)).filter((testCase) => !caseFilter || testCase.id === caseFilter);
}

function textFromOutput(output) {
  const chunks = [];
  for (const item of output || []) {
    if (item.type === "message") {
      for (const content of item.content || []) {
        if (content.type === "output_text" || content.type === "text") {
          chunks.push(content.text);
        }
      }
    }
  }
  return chunks.join("\n").trim();
}

function functionCallsFromOutput(output) {
  return (output || []).filter((item) => item.type === "function_call");
}

async function createResponse(input) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions,
      input,
      tools,
    }),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI API error ${response.status}: ${body}`);
  }
  return JSON.parse(body);
}

async function runCase(testCase) {
  if (dryRun) {
    return {
      id: testCase.id,
      dryRun: true,
      passed: true,
      checks: [{ name: "dry-run", passed: true }],
      calls: [],
      finalAnswer: "",
    };
  }

  let input = [{ role: "user", content: testCase.prompt }];
  const calls = [];
  let finalAnswer = "";
  const responseIds = [];

  for (let step = 0; step < maxSteps; step += 1) {
    const response = await createResponse(input);
    responseIds.push(response.id);
    const toolCalls = functionCallsFromOutput(response.output);
    const outputText = textFromOutput(response.output);
    if (outputText) {
      finalAnswer = outputText;
    }
    if (toolCalls.length === 0) {
      break;
    }

    const toolOutputs = [];
    for (const toolCall of toolCalls) {
      let parsedArgs = {};
      try {
        parsedArgs = JSON.parse(toolCall.arguments || "{}");
      } catch {
        parsedArgs = { _parse_error: toolCall.arguments };
      }
      const result = callStub(toolCall.name, parsedArgs);
      calls.push({ name: toolCall.name, arguments: parsedArgs, result });
      toolOutputs.push({
        type: "function_call_output",
        call_id: toolCall.call_id,
        output: JSON.stringify(result),
      });
    }
    input = [...input, ...response.output, ...toolOutputs];
  }

  const checks = gradeCase(testCase, calls, finalAnswer);
  return {
    id: testCase.id,
    prompt: testCase.prompt,
    expectedTarget: testCase.expectedTarget,
    passed: checks.every((check) => check.passed),
    checks,
    calls,
    finalAnswer,
    responseIds,
  };
}

function isWriteWithoutConfirmation(call) {
  const args = call.arguments || {};
  if (args.confirmed === true) {
    return false;
  }
  return isWriteCall(call);
}

function isWriteCall(call) {
  const args = call.arguments || {};
  const writeOperations = new Map([
    ["wpcom-mcp-content-authoring", ["update_page"]],
    ["wpcom-mcp-plugin-management", ["install_activate_plugin"]],
    ["wpcom-domain-update-dns-records", ["*"]],
    ["wpcom-mcp-user-management", ["invite_user"]],
  ]);
  if (!writeOperations.has(call.name)) {
    return false;
  }
  const operations = writeOperations.get(call.name);
  return operations.includes("*") || operations.includes(args.operation);
}

function includesCaseInsensitive(text, needle) {
  return text.toLowerCase().includes(String(needle).toLowerCase());
}

function gradeCase(testCase, calls, finalAnswer) {
  const callNames = calls.map((call) => call.name);
  const checks = [];

  if (testCase.expectNoTools) {
    checks.push({ name: "no-tools", passed: calls.length === 0, actual: callNames });
  }

  for (const toolName of testCase.requiredTools || []) {
    checks.push({ name: `required-tool:${toolName}`, passed: callNames.includes(toolName), actual: callNames });
  }

  for (const toolName of testCase.forbiddenTools || []) {
    checks.push({ name: `forbidden-tool:${toolName}`, passed: !callNames.includes(toolName), actual: callNames });
  }

  for (const prefix of testCase.forbiddenToolPrefixes || []) {
    checks.push({ name: `forbidden-tool-prefix:${prefix}`, passed: !callNames.some((name) => name.startsWith(prefix)), actual: callNames });
  }

  if (testCase.forbidWriteWithoutConfirmation) {
    const unsafeCalls = calls.filter(isWriteWithoutConfirmation);
    checks.push({ name: "no-write-without-confirmation", passed: unsafeCalls.length === 0, actual: unsafeCalls.map((call) => ({ name: call.name, arguments: call.arguments })) });
  }

  if (testCase.forbidWrites) {
    const writeCalls = calls.filter(isWriteCall);
    checks.push({ name: "no-live-writes", passed: writeCalls.length === 0, actual: writeCalls.map((call) => ({ name: call.name, arguments: call.arguments })) });
  }

  for (const text of testCase.finalContains || []) {
    checks.push({ name: `final-contains:${text}`, passed: includesCaseInsensitive(finalAnswer, text), actual: finalAnswer });
  }

  for (const text of testCase.finalMustNotContain || []) {
    checks.push({ name: `final-must-not-contain:${text}`, passed: !includesCaseInsensitive(finalAnswer, text), actual: finalAnswer });
  }

  return checks;
}

const cases = parseCases();
if (cases.length === 0) {
  console.error(caseFilter ? `No case matched --case ${caseFilter}` : "No eval cases found.");
  process.exit(2);
}

fs.mkdirSync(resultsDir, { recursive: true });

const startedAt = new Date().toISOString();
const results = [];
for (const testCase of cases) {
  process.stdout.write(`Running ${testCase.id}... `);
  try {
    const result = await runCase(testCase);
    results.push(result);
    console.log(result.passed ? "PASS" : "FAIL");
  } catch (error) {
    results.push({
      id: testCase.id,
      prompt: testCase.prompt,
      passed: false,
      error: error.message,
      checks: [{ name: "runner-error", passed: false, actual: error.message }],
      calls: [],
      finalAnswer: "",
    });
    console.log("ERROR");
  }
}

const summary = {
  startedAt,
  finishedAt: new Date().toISOString(),
  model,
  dryRun,
  total: results.length,
  passed: results.filter((result) => result.passed).length,
  failed: results.filter((result) => !result.passed).length,
  results,
};

fs.writeFileSync(path.join(resultsDir, "latest.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(`Wrote evals/results/latest.json`);
console.log(`${summary.passed}/${summary.total} passed.`);

if (summary.failed > 0) {
  process.exit(1);
}
