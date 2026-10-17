# agentprose demo: Agentic Engineering in Action

**Live:** https://vibeprogrammer.github.io/agentprose-demo/

A small Hugo blog that shows [agentprose](https://github.com/vibeprogrammer/agentprose) at work: AI agents in a WebMCP-capable browser can read, search and cite the posts through tools, with one `<script>` line added to the theme.

> **Demo only, not for search engines.** `robots.txt` disallows all crawlers and every page has `<meta name="robots" content="noindex, nofollow">`. The CI build fails if any page is missing it.

## Content and attribution

The posts are the 12 issues of **[Agentic Engineering in Action](https://www.linkedin.com/newsletters/agentic-engineering-in-action-6864516245006376960/)**, the LinkedIn newsletter by [Maxim Salnikov](https://www.linkedin.com/in/webmax/), published June 29 – September 30, 2026. They are republished unchanged as a technical demo. Each post keeps its author, its original date and a link to the original LinkedIn article at the top and bottom. Issue 11 is a guest post by Einar Ingebrigtsen and is credited to him. All articles © their authors.

| # | Date | Title |
|---|---|---|
| 1 | 2026-06-29 | [Stop Putting a Raw LLM in Your CI Pipeline — Put a Sandbox Around It](https://www.linkedin.com/pulse/stop-putting-raw-llm-your-ci-pipeline-put-sandbox-around-salnikov-qtwme) |
| 2 | 2026-06-30 | [The model is a commodity. The harness is your advantage. A hands-on experiment with GitHub Copilot app's Canvas](https://www.linkedin.com/pulse/model-commodity-harness-your-advantage-hands-on-github-maxim-salnikov-s9mke) |
| 3 | 2026-07-01 | [Design, but with tests: an engineering approach to UX with Impeccable](https://www.linkedin.com/pulse/design-tests-engineering-approach-ux-impeccable-maxim-salnikov-f2rle) |
| 4 | 2026-07-08 | [You can't tune what you can't see: prompt‑cache observability for GitHub Copilot with OpenTelemetry](https://www.linkedin.com/pulse/you-cant-tune-what-see-promptcache-observability-github-salnikov-gstye) |
| 5 | 2026-07-13 | [The First 80% Takes Nine Minutes. The Last 20% Takes Two Days.](https://www.linkedin.com/pulse/first-80-takes-nine-minutes-last-20-two-days-maxim-salnikov-ingde) |
| 6 | 2026-07-15 | [The Best AI Coding Model Is a Moving Target. Build a Selection System Instead](https://www.linkedin.com/pulse/best-ai-coding-model-moving-target-build-selection-system-salnikov-idvfe) |
| 7 | 2026-07-23 | [Giving AI agents a real computer](https://www.linkedin.com/pulse/giving-ai-agents-real-computer-maxim-salnikov-zexxe) |
| 8 | 2026-09-08 | [Your Agent’s Context Has a Supply Chain. Manage It.](https://www.linkedin.com/pulse/your-agents-context-has-supply-chain-manage-maxim-salnikov-n2e7e) |
| 9 | 2026-09-21 | [GitHub Agentic Workflows: The Five-Minute Version + Free Book](https://www.linkedin.com/pulse/github-agentic-workflows-five-minute-version-free-book-maxim-salnikov-6nhre) |
| 10 | 2026-09-25 | [What I learned building 6 apps and solving 10 related engineering problems for the OpenAI WebMCP Challenge](https://www.linkedin.com/pulse/what-i-learned-building-6-apps-solving-10-related-openai-salnikov-r0f9e) |
| 11 | 2026-09-28 | [One corpus, many harnesses: what it took to keep our AI consistent](https://www.linkedin.com/pulse/one-corpus-many-harnesses-what-took-keep-our-ai-maxim-salnikov-vs6pe) |
| 12 | 2026-09-30 | [Where Is the Gate? A Practical Look at AI Engineering Systems](https://www.linkedin.com/pulse/where-gate-practical-look-ai-engineering-systems-maxim-salnikov-g1snc) |

## The one-line install

In [`layouts/partials/agentprose.html`](layouts/partials/agentprose.html):

```html
<script src="/agentprose-demo/js/agentprose.min.js" defer
        data-base="https://vibeprogrammer.github.io/agentprose-demo/" data-index="/agentprose-demo/agentprose.json"
        data-subscribe="https://www.linkedin.com/newsletters/agentic-engineering-in-action-6864516245006376960/" data-about="https://vibeprogrammer.github.io/agentprose-demo/about/" data-inspector></script>
```

On a site served from its domain root, `<script src="/agentprose.min.js" defer></script>` is the whole thing. This demo lives under `/agentprose-demo/`, so it passes `data-base` and `data-index`; the other attributes add the newsletter link and the 🔌 inspector. (`static/js/demo.js` is demo-site glue that makes the header button open the inspector; it is not part of agentprose.) The bundle is vendored in `static/js/` because agentprose isn't on npm yet; after the npm release the `src` becomes `https://cdn.jsdelivr.net/npm/agentprose@0.1/dist/agentprose.min.js`.

Tools the page registers (all read-only): `get_current_article`, `search_posts`, `list_posts`, `get_post`, `get_table_of_contents`, `get_section`, `get_related_posts`, `list_taxonomies`, `get_site_info`, `get_citation`, `get_subscribe_link`.

## Try it

- Open any page and click **Try the agent tools** (or add `?agentprose-inspect` to the URL) to call the tools from the inspector.
- In Chrome, turn on `chrome://flags/#enable-webmcp-testing` and the tools register natively on `document.modelContext`.

## Build

```bash
hugo --gc --minify
npm ci --prefix tools/agentprose-cli
node tools/agentprose-cli/cli.js build public --base-url https://vibeprogrammer.github.io/agentprose-demo/ --include '^/posts/'
```

The second step writes `agentprose.json` and one Markdown file per post, so `search_posts` and `get_post` cover the whole archive from any page. [`.github/workflows/pages.yml`](.github/workflows/pages.yml) runs the same steps (Hugo 0.168.0 extended) and deploys to GitHub Pages.

The theme is in `layouts/` and `assets/css/site.css`. It has no dependencies and emits BlogPosting JSON-LD, OpenGraph tags, RSS (`index.xml`), `sitemap.xml` and `llms.txt`.
