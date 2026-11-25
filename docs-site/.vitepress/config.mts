import { defineConfig } from 'vitepress'
import { guideLinks } from './guide-links.mts'

const guideRouteMap: Record<string, string> = {
  'README.md': 'docs/architecture',
  'walkthroughs/one-real-run.md': 'docs/walkthrough',
  'code-map.md': 'docs/code-map',
  'modules/core-patching-and-smp.md': 'docs/contracts',
  'modules/frameflow-and-fsr1-pipeline.md': 'docs/performance',
  'modules/benchmark-and-workbench.md': 'docs/performance',
  'glossary.md': 'docs/architecture',
  'references/source-evidence.md': 'docs/architecture',
  'references/quality-review.md': 'docs/architecture',
  'change-log.md': 'docs/decisions',
}

export default defineConfig({
  title: 'PVSSPW',
  description: '基于 Vitaslop 的网页版 PS Vita 模拟器与性能对测平台：SMP 自适应线程、FSR 1 与同设备零拷贝 FrameFlow 后处理。',
  cleanUrls: true,
  lastUpdated: false,
  markdown: {
    config(md) {
      md.use(guideLinks(guideRouteMap))
    },
  },
  locales: {
    root: {
      label: '简体中文',
      lang: 'zh-CN',
      themeConfig: {
        nav: [
          { text: '首页', link: '/' },
          { text: '起步与部署', link: '/docs/' },
          { text: '契约与调优', link: '/docs/contracts' },
          { text: '架构与源码', link: '/docs/architecture' },
          { text: 'API 与组件', link: '/api-reference/' },
        ],
        sidebar: {
          '/docs/': [
            {
              text: '起步与复现部署',
              items: [
                { text: '概览与能力边界', link: '/docs/' },
                { text: '输入准备、重编与回环服务', link: '/docs/deployment' },
                { text: 'API 与探针参考（Apifox 视图）', link: '/api-reference/' },
                { text: '运行与对测排错 FAQ', link: '/docs/troubleshooting' },
              ],
            },
            {
              text: '契约与画质对测',
              items: [
                { text: 'Vitaslop 补丁、SMP 与输入契约', link: '/docs/contracts' },
                { text: 'FSR 1、FrameFlow 后处理与对测基准', link: '/docs/performance' },
              ],
            },
            {
              text: '原理与源码导览',
              items: [
                { text: '架构全景与交互图谱', link: '/docs/architecture' },
                { text: '一次真实运行走查（源码）', link: '/docs/walkthrough' },
                { text: '代码地图（按职责定位）', link: '/docs/code-map' },
                { text: '工程决策与对比口径', link: '/docs/decisions' },
              ],
            },
          ],
        },
        outline: { label: '本页目录', level: [2, 3] },
        docFooter: { prev: '上一页', next: '下一页' },
      },
    },
    en: {
      label: 'English',
      lang: 'en-US',
      link: '/en/',
      themeConfig: {
        nav: [
          { text: 'Home', link: '/en/' },
          { text: 'Getting Started', link: '/en/docs/' },
          { text: 'Contracts & Perf', link: '/en/docs/contracts' },
          { text: 'Architecture', link: '/en/docs/architecture' },
          { text: 'API & Probes', link: '/en/api-reference/' },
        ],
        sidebar: {
          '/en/docs/': [
            {
              text: 'Getting Started & Bench Setup',
              items: [
                { text: 'Overview & Scope Boundaries', link: '/en/docs/' },
                { text: 'Setup, Rebuilding & Loopback Server', link: '/en/docs/deployment' },
                { text: 'API & Probe Reference', link: '/en/api-reference/' },
                { text: 'Runtime & Benchmark FAQ', link: '/en/docs/troubleshooting' },
              ],
            },
            {
              text: 'Contracts & Post-FX Tuning',
              items: [
                { text: 'Patch Stack, SMP & Workbench Contracts', link: '/en/docs/contracts' },
                { text: 'FSR 1, FrameFlow & Battle Benchmarks', link: '/en/docs/performance' },
              ],
            },
            {
              text: 'Architecture & Decisions',
              items: [
                { text: 'Architecture & Interactive Diagram', link: '/en/docs/architecture' },
                { text: 'End-to-End Walkthrough', link: '/en/docs/walkthrough' },
                { text: 'Code Map by Responsibility', link: '/en/docs/code-map' },
                { text: 'Engineering Decisions & ADRs', link: '/en/docs/decisions' },
              ],
            },
          ],
        },
        outline: { label: 'On this page', level: [2, 3] },
      },
    },
  },
  themeConfig: {
    search: { provider: 'local' },
    socialLinks: [{ icon: 'github', link: 'https://github.com/CyberNova2333/pvsspw' }],
  },
})
