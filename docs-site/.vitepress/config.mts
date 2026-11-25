import { defineConfig } from 'vitepress'
import { guideLinks } from './guide-links.mts'

const guideRouteMap: Record<string, string> = {
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
          { text: '起步与复现', link: '/docs/' },
          { text: '补丁与后处理', link: '/docs/patching-smp' },
          { text: '架构与源码', link: '/docs/architecture' },
          { text: 'API 与探针', link: '/api-reference/' },
        ],
        sidebar: {
          '/docs/': [
            {
              text: '起步与复现基准',
              items: [
                { text: '概览与能力边界', link: '/docs/' },
                { text: '准备、重编与本地服务', link: '/docs/setup' },
                { text: '对测方法与战斗复现', link: '/docs/benchmarks' },
                { text: '工作台参数、后端与探针 API', link: '/api-reference/' },
              ],
            },
            {
              text: '核心补丁与画质管线',
              items: [
                { text: 'Vitaslop 补丁与自适应线程', link: '/docs/patching-smp' },
                { text: 'FSR 1 与 FrameFlow 后处理', link: '/docs/postfx' },
              ],
            },
            {
              text: '架构与源码导览',
              items: [
                { text: '架构全景与源码指南总览', link: '/docs/architecture' },
                { text: '一次真实运行走查（源码）', link: '/docs/walkthrough' },
                { text: '代码地图（按职责定位）', link: '/docs/code-map' },
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
          { text: 'Patches & Post FX', link: '/en/docs/patching-smp' },
          { text: 'Architecture', link: '/en/docs/architecture' },
          { text: 'API & Probes', link: '/en/api-reference/' },
        ],
        sidebar: {
          '/en/docs/': [
            {
              text: 'Getting Started & Benchmarks',
              items: [
                { text: 'Overview & Scope Boundaries', link: '/en/docs/' },
                { text: 'Setup, Rebuilding & Local Server', link: '/en/docs/setup' },
                { text: 'Benchmark Protocol & Battle Runs', link: '/en/docs/benchmarks' },
                { text: 'Workbench Params, Backends & Probes', link: '/en/api-reference/' },
              ],
            },
            {
              text: 'Core Patches & Post-Processing',
              items: [
                { text: 'Vitaslop Patch Stack & SMP Policy', link: '/en/docs/patching-smp' },
                { text: 'FSR 1 & FrameFlow Zero-Copy Ring', link: '/en/docs/postfx' },
              ],
            },
            {
              text: 'Architecture & Source Guide',
              items: [
                { text: 'Architecture & Source Guide Index', link: '/en/docs/architecture' },
                { text: 'End-to-End Walkthrough', link: '/en/docs/walkthrough' },
                { text: 'Code Map by Responsibility', link: '/en/docs/code-map' },
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
