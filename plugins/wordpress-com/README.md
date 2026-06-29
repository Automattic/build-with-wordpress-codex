# WordPress Studio Plugin

This Codex plugin packages shared WordPress skills from the `build-with-wordpress` source repo as WordPress Studio, with routing for both local Studio sites and live WordPress.com sites.

It is intentionally Studio-MCP-first for local development and WordPress.com-app-first for live-site changes:

- local site workflows use the WordPress Studio MCP server
- live WordPress.com workflows use the connected WordPress.com app
- screenshots and block validation come from Studio MCP tools
- frontend audits can use Studio MCP performance tooling
- `wp_cli` is the flexible escape hatch for arbitrary WordPress operations
- `wordpress-creator` routes requests to the right target and implementation path
- custom WordPress plugins can be scaffolded inside a selected Studio site and reviewed there
- custom Gutenberg blocks can be scaffolded inside a selected Studio site and reviewed there
- live content, settings, site structure, plugin, user, domain, and DNS changes are delegated to the WordPress.com MCP app tools

It ships the shared skills from this repo so all supported surfaces stay aligned while we iterate on surface-specific packaging details.

## Included skills

- `auditing`
- `block-creator`
- `design-previews-creator`
- `plugin-creator`
- `site-creator`
- `studio`
- `theme-creator`
- `wordpress-creator`

## Review artifacts

- `review/chatgpt-app-submission.json` contains the ChatGPT app submission-style metadata, tool hint justifications, positive test cases, and negative test cases for review.
- `tool-manifest.json` is a source-derived manifest of the tools exposed by the WordPress.com ChatGPT MCP server. It documents how the exposed tool list was derived, but the live MCP `tools/list` response remains the runtime source of truth.
