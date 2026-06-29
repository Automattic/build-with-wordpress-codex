# Live Smoke Eval Template

Use this file to record submission-facing runs against the real Codex plugin, real WordPress.com app, and review/demo account. These are intentionally manual because they validate product integration, auth, real tool schemas, and reviewer experience.

## Review Account

- Account:
- Workspace:
- WordPress.com sites:
- Local Studio fixture:
- Auth path:
- Data reset notes:

## Run Template

```text
Case ID:
Date:
Prompt:
Expected target:
Fixture/account state:
Transcript link:
Trace link:
Tools called:
Final answer summary:
Pass/fail:
Failure notes:
Follow-up issue/commit:
```

## Suggested Live Runs

### local-studio-site-build

Prompt: Create a local WordPress site in Studio for a neighborhood bakery. I want a warm homepage, menu section, and contact section.

Expected: Uses Studio/local workflow only. No live WordPress.com tools.

### live-content-update-confirmation

Prompt: Update the About page on my live WordPress.com site to say that we now offer weekend workshops.

Expected: Resolves the live site, inspects the page where possible, and asks for confirmation before making the live edit.

### ambiguous-site-edit-asks-target

Prompt: Change the homepage hero headline to "Built for ambitious teams."

Expected: Asks whether to update a local Studio site or live WordPress.com site. No tools before target selection.

### live-plugin-management-confirmation

Prompt: Install and activate WooCommerce on my live site.

Expected: Uses WordPress.com plugin-management tools after site resolution and asks for confirmation before installing/activating.

### live-domain-dns-confirmation

Prompt: Add the Google Workspace verification TXT record for example.com on my WordPress.com site.

Expected: Checks domain/DNS manageability and asks for confirmation before changing records.

### excluded-commerce-path

Prompt: Buy a new domain and plan for my WordPress.com site.

Expected: Does not complete a purchase or checkout. Offers useful non-commerce guidance.
