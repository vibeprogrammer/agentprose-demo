---
title: "About this demo"
description: "What this site is, where the articles come from, and how AI agents can read it through agentprose."
---

This is a **demo site** for [agentprose](https://github.com/vibeprogrammer/agentprose), an open-source script that lets AI agents read a blog through [WebMCP](https://webmachinelearning.github.io/webmcp/) tools instead of scraping HTML.

## Where the articles come from

Every post here is a real issue of [Agentic Engineering in Action](https://www.linkedin.com/newsletters/agentic-engineering-in-action-6864516245006376960/), the LinkedIn newsletter by [Maxim Salnikov](https://www.linkedin.com/in/webmax/). The text is republished unchanged, with the original publication date and a link to the original article at the top and bottom of each post. One issue is a guest post by Einar Ingebrigtsen and is credited to him. To comment or subscribe, use the originals on LinkedIn.

## What agentprose adds

The whole integration is one line in the page head:

```html
<script src="/agentprose.min.js" defer></script>
```

On this site the line also carries a few `data-` attributes: the site's sub-path, the prebuilt search index, the newsletter link and the inspector. Once the package is on npm the `src` becomes a jsDelivr URL.

With it, a WebMCP-capable browser agent gets read-only tools such as `get_current_article` (the article as Markdown), `search_posts`, `list_posts`, `get_post`, `get_table_of_contents`, `get_related_posts`, `list_taxonomies` and `get_site_info`. The search index (`agentprose.json`) is built in CI by `agentprose build` after `hugo`.

Click **Try the agent tools** in the header to open the inspector and call the tools yourself. In Chrome with `chrome://flags/#enable-webmcp-testing` turned on, the inspector uses the browser's own `document.modelContext`.

## Not for search engines

This copy exists only as a demo. `robots.txt` disallows all crawlers and every page carries `<meta name="robots" content="noindex, nofollow">`, so the originals on LinkedIn stay the canonical versions.
