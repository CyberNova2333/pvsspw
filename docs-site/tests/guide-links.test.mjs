import assert from 'node:assert/strict'
import test from 'node:test'
import { createMarkdownRenderer } from 'vitepress'
import { guideLinks } from '../.vitepress/guide-links.mts'

const routeMap = {
  'README.md': 'docs/architecture',
  'walkthroughs/one-real-run.md': 'docs/walkthrough',
  'code-map.md': 'docs/code-map',
  'modules/core-patching-and-smp.md': 'docs/patching-smp',
  'modules/frameflow-and-fsr1-pipeline.md': 'docs/postfx',
  'modules/benchmark-and-workbench.md': 'docs/benchmarks',
  'glossary.md': 'docs/architecture',
  'references/source-evidence.md': 'docs/architecture',
  'references/quality-review.md': 'docs/architecture',
  'change-log.md': 'docs/architecture',
}

test('guideLinks rewrites repo-docs links and marks repo source paths', async () => {
  const md = await createMarkdownRenderer(process.cwd(), {
    config(instance) {
      instance.use(guideLinks(routeMap))
    },
  })

  const html = md.render(
    '查看[主流程](walkthroughs/one-real-run.md#step-1)或[外壳](../web/shell.js)与[外部](https://example.org)。',
    { frontmatter: { repoGuideSource: 'repo-docs/code-map.md' } },
  )
  assert.match(html, /href="\/docs\/walkthrough(?:\.html)?#step-1"/)
  assert.match(html, /（仓库文件：<code>web\/shell\.js<\/code>）/)
  assert.doesNotMatch(html, /href="[^"]*shell\.js/)
  assert.match(html, /href="https:\/\/example\.org"/)

  assert.throws(() => {
    md.render('[unmapped](missing/page.md)', { frontmatter: { repoGuideSource: 'repo-docs/README.md' } })
  }, /no route/)

  assert.throws(() => {
    md.render('[escape](../../outside.txt)', { frontmatter: { repoGuideSource: 'repo-docs/README.md' } })
  }, /escapes repository/)
})
