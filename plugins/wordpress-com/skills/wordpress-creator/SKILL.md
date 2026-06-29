---
name: wordpress-creator
description: Route WordPress build, management, and audit requests to the right target and implementation path. Use when the user wants WordPress work and it is not yet clear whether the task should use a local WordPress Studio site, a live WordPress.com site, site creation, theme work, a custom block, a plugin, or an audit.
---

# WordPress Creator

Use this skill as the top-level decision maker for WordPress target selection, implementation, and audit work.

## Ownership

This skill owns:

- choosing between local WordPress Studio and live WordPress.com work
- choosing between `site-creator`, `theme-creator`, `block-creator`, `plugin-creator`, and `auditing`
- picking the smallest fitting WordPress abstraction
- handing execution off to the specialist skill once the approach is clear

## Target rules

- Use local WordPress Studio when the user asks to build locally, create or modify theme/plugin/block files, run local screenshots, validate serialized blocks, use `wp_cli`, or prepare work before publishing.
- Use live WordPress.com when the user asks to edit an existing live site, manage pages/posts/media, change site settings, update navigation or templates, manage users, install or update live plugins, or configure domains, DNS, or email.
- If the user names a specific Studio site, local path, localhost URL, or Studio workflow, treat the target as local.
- If the user names a WordPress.com URL, custom production domain, live site, account, domain, DNS, plan, user, or collaborator workflow, treat the target as live WordPress.com.
- If both local and live targets are plausible and the action has real visitor impact, ask which target to use before writing.
- Do not silently modify a live WordPress.com site when the user likely meant a local Studio site.
- Do not use local file edits when the user asks to change an existing live WordPress.com site.
- For live WordPress.com work, start by resolving the user's site through the WordPress.com app tools, then follow those tools' own schemas and confirmation requirements. Do not duplicate their detailed operation guidance here.

## Routing rules

- Use `site-creator` when the user wants a new site, homepage, landing page, or a full site built from a brief.
- Use `theme-creator` when the main work is theme templates, layout, styling, presentation, or a visual redesign.
- Use `block-creator` when the main deliverable is an editor-insertable content block that can't be achieved with existing core blocks or already installed custom blocks.
- Use `plugin-creator` when the request is reusable site functionality, admin/settings UI, REST endpoints, scheduled tasks, integrations, or backend behavior that should survive theme changes, and that can't be achieved with an existing plugin.
- Use `auditing` when the main request is performance review, accessibility review, frontend QA, or optimization guidance on an existing site.
- If the request could fit more than one path, choose the smallest abstraction that cleanly solves it.
- For live WordPress.com work, prefer the WordPress.com app tools directly unless the user explicitly asks to first prototype or develop the change locally in Studio.
- For moving work between Studio and WordPress.com, use the Studio sync, preview, push, or pull capabilities when available and confirm the source and destination before changing either side.

## Guardrails

- Do not reach for a plugin when a theme or block would solve the request more directly.
- Do not reach for a plugin when an existing installed, or well known plugin is available. For example, `Set up an ecommerce system` could be accomplished with the WooCommerce plugin.
- Do not route pure presentation work into `plugin-creator`.
- Do not route reusable backend behavior into `theme-creator`.
- Do not duplicate WordPress.com MCP tool documentation in this skill. Use this skill for target selection and routing judgment, then rely on the app tools for operation-specific details.
- Respect live-site safety. Before live create, update, delete, publish, role, plugin, theme, domain, or DNS changes, inspect current state where possible, describe the intended change, and wait for the confirmation required by the selected WordPress.com tool.
- Once the path is clear, rely on the specialist skill instead of restating its workflow here.
