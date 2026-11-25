import type { ApiCatalogSpec } from './api-types';

export const apiSpecZh: ApiCatalogSpec = {
  project: 'PVSSPW · 工作台门禁、自适应 SMP、同设备 AI 后处理与对测探针 API 参考',
  subtitle:
    '覆盖 web/ 浏览器能力门禁与 pvsspw-library 锁、thread-policy.js 自适应选核、frameflow-worker.js 三槽同设备环、serve.py 同源启动及 worker-probe.js。',
  environments: [
    { label: '固定 Vitaslop 本地工作台 (serve.py --fixed)', value: 'http://127.0.0.1:18747' },
    { label: '基线 Vitaslop / Vita3K Web', value: 'http://127.0.0.1:18741' },
  ],
  searchPlaceholder: '搜索 checkPlatform、chooseThreadPolicy、frameflow-worker、Fsr1、open-edge、pvsspw-submit…',
  emptyText: '没有找到匹配的 PVSSPW 工作台接口、参数或探针约定。',
  labels: {
    allGroups: '全部',
    canDo: '✅ 能做到',
    cannotDo: '⛔ 明确限制 / 不做什么',
    params: '参数、环境变量与策略阈值',
    paramName: '字段 / 开关 / 请求头',
    paramLocation: '作用域',
    paramType: '类型 / 默认值',
    paramRequired: '要求',
    paramDesc: '边界语义与拦截阈值',
    responses: '状态分支与失败处理',
    examples: '标准调用 / 启动示例',
    responseSample: '协议 / 返回示例',
    copy: '复制',
    copied: '已复制',
    noParams: '无额外参数。',
    required: '必填',
    optional: '可选',
    deepDocs: '查看对应源码机制说明',
    totalItems: '组接口/组件',
    envLabel: '本地服务端口',
    mobilePicker: '切换组件/接口',
    defaultLabel: '默认',
    plainIndexToggle: '纯文本检索与打印索引（Ctrl+K 站内搜索定位）',
  },
  groups: [
    { id: 'workbench-gates', title: '工作台门禁、存储锁与显卡探测' },
    { id: 'smp-and-postfx', title: 'SMP 自适应调度与同设备 AI/FSR 1' },
    { id: 'harness-and-probes', title: '构建重编、回环服务与 GPU 探针' },
  ],
  items: [
    {
      id: 'platform-and-graphics',
      group: 'workbench-gates',
      kind: 'SDK',
      title: '启动前置环境与显卡探测 (checkPlatform / findGraphics)',
      signature: 'checkPlatform() + probeGraphics(preference)',
      auth: '安全上下文 + 专用探测 Worker',
      stability: '启动前硬门禁',
      summary:
        '启动游戏前验证安全上下文、WebAssembly、JSPI、OffscreenCanvas 与 OPFS 同步文件句柄（任一失败标记 fatal）；并在 Worker 内按 core -> compatibility -> fallback 搜索硬件 WebGPU 适配器。',
      relatedLink: '/docs/',
      relatedLabel: '查看概览与运行门槛',
      capabilities: [
        '通过 /probe-worker.js 实测 OPFS createSyncAccessHandle 可用性（5 秒超时保护）',
        '遇到 SwiftShader / llvmpipe 等软件渲染标记时尽量继续寻找硬件设备并保留全部尝试记录',
      ],
      limitations: [
        '缺失安全上下文（例如局域网明文 HTTP IP）、JSPI 或 OPFS 同步句柄时阻断启动',
        '若仅剩软件适配器，engine.js 将注入 uiPresent=software 并强制禁止 GameFI 与 GameSR',
      ],
      params: [
        { name: 'preference', location: 'config', type: "'high-performance' | 'low-power' | ''", defaultValue: "'high-performance'", description: '适配器功耗偏好，按顺序尝试不同特征模式' },
        { name: 'storageLock', location: 'method', type: 'navigator.locks (pvsspw-library)', description: 'ifAvailable: true 非阻塞互斥锁，防止同源多标签同时读写库内文件' },
      ],
      responses: [
        { status: 'OK · HardwareAdapter', tone: 'ok', summary: '全部 fatal 检查通过且选定非软件 WebGPU 设备' },
        { status: 'Warn · SoftwareFallback', tone: 'warn', summary: '无硬件适配器时回退至 software 模式并使用二维 Canvas 呈递' },
        { status: 'Fatal · MissingCapability', tone: 'err', summary: '缺少 JSPI / OPFS / OffscreenCanvas 时阻断启动并输出修复说明' },
      ],
      examples: [
        {
          label: '平台与图形探针调用顺序',
          lang: 'js',
          code: "import { checkPlatform } from '/ui/platform.js';\nimport { probeGraphics } from '/ui/graphics.js';\n\nconst checks = await checkPlatform();\nif (checks.some(c => c.level === 'fatal')) throw new Error('Missing fatal capability');\nconst gfx = await probeGraphics('high-performance');",
        },
      ],
    },
    {
      id: 'save-zip-validation',
      group: 'workbench-gates',
      kind: 'SDK',
      title: '存档 ZIP 导出与写入前结构校验 (exportSaves / restoreSaves)',
      signature: 'exportSaves(titleId?) / restoreSaves(file, titleId?)',
      auth: '/gamedata-worker.js 离线结构校验',
      stability: '存档一致性保护',
      summary:
        '支持按单个游戏或整个当前档案导出 ZIP 存档；恢复写入本地前把每个条目独立交由 /gamedata-worker.js 检验并在弹窗确认后覆盖。',
      relatedLink: '/docs/performance',
      relatedLabel: '查看存档读回对测规则',
      capabilities: [
        '统一命名约束 [A-Za-z0-9_-]+.zip，拒绝重复项与跨游戏误覆盖',
      ],
      limitations: [
        '工作台不上传云存档；导出/恢复结果不能替代“重开页面并确认游戏内实际读回进进度”的功能验证',
      ],
      params: [
        { name: 'id', location: 'arg', type: 'string (optional)', description: '为空时打包全部已存游戏；指定时仅操作单个标题编号' },
      ],
      responses: [
        { status: 'OK · Confirmed', tone: 'ok', summary: '经 Worker 摘要检查且 confirm 同意后写回 OPFS' },
        { status: 'Error · CorruptOrMismatch', tone: 'err', summary: '格式非法或缺失对应存档时当场抛错终止覆盖' },
      ],
      examples: [
        {
          label: '导出与恢复调用',
          lang: 'js',
          code: "import { exportSaves, restoreSaves } from '/ui/files.js';\nawait exportSaves('PCSG00214');",
        },
      ],
    },
    {
      id: 'thread-policy',
      group: 'smp-and-postfx',
      kind: 'CONFIG',
      title: '自适应 SMP 线程池决策 (chooseThreadPolicy)',
      signature: 'chooseThreadPolicy(knobs, device, { titleId, adapter, measure })',
      auth: '启动前计算 guestWorkerLimit 与并行微测速',
      stability: '核心并发策略',
      summary:
        '核心调度器仅在启动瞬间绑定线程池。决策顺序依次检查 VITASLOP_SMP=0、手动 1..8 开关、实测最优特例（如 Intel Xe-LPG 下 PCSG00214 固定 3 线程），以及最多 6 线程微测速峰值九折阈值。',
      relatedLink: '/docs/contracts',
      relatedLabel: '查看线程决策流程图与补丁细节',
      capabilities: [
        'guestWorkerLimit 扣除 2 颗宿主/浏览器核并按内存（2G->2, 4G->4, >4G->6）限幅',
        'selectWorkerCount() 取吞吐达到峰值 >= 90% 的最少工作线程，抑制核间争用',
      ],
      limitations: [
        '并行微测速设置 1200 ms 超时，超时或失败时退回 budget 模式而不阻塞启动',
      ],
      params: [
        { name: 'VITASLOP_SMP', location: 'config', type: "'0' | '1'", defaultValue: "'1'", description: "为 '0' 时强制单线程" },
        { name: 'VITASLOP_SMP_WORKERS', location: 'config', type: '1..8', description: '合法 1..8 数值强制锁定手动线程池数量' },
      ],
      responses: [
        { status: 'OK · PolicySelected', tone: 'ok', summary: '返回 { mode: single|manual|game|measured|budget, workers? }' },
      ],
      examples: [
        {
          label: '策略单元测试验证命令',
          lang: 'bash',
          code: 'node --test tests/thread-policy.test.mjs tests/graphics.test.mjs tests/probe.test.mjs',
        },
      ],
    },
    {
      id: 'frameflow-worker-bridge',
      group: 'smp-and-postfx',
      kind: 'HOOK',
      title: '同设备零拷贝后处理环与原生 FSR 1 互斥 (/worker.js 链路)',
      signature: 'web/frameflow-worker.js -> bench/worker-probe.js -> worker.js',
      auth: '拦截 GPUAdapter / GPUCanvasContext / swapchain',
      stability: '零拷贝 WebGPU 管线',
      summary:
        '以模块顺序最先导入并请求 shader-f16；启用插帧或超分时通过 frameflow-ring-0..2 三槽环在同 GPUDevice 内完成 GameFI(2x/3x) 与 GameSR(2x)，并在开启 GameSR 时抑制原生 FSR 1。',
      relatedLink: '/docs/performance',
      relatedLabel: '查看 FSR 1 与纹理环细节',
      capabilities: [
        '支持在游玩过程中经 window.vitaPlayer.setFrameflow() / setGameSr() 动态切换预设',
        '超过 1280x720 或降档 tier 时动态下调光流工作网格尺寸（384x224 / 256x160）',
      ],
      limitations: [
        'uiPresent=software 时全部 AI 预设强制关闭；开启 GameSR 时 engine.js 显式置 output-size.fsr1 = false',
        '严禁引入跨 GPUDevice 纹理复制或热路径阻塞回读',
      ],
      params: [
        { name: 'uiFrameflow', location: 'query', type: "'off'|'lite-2x'|'std-2x'|'lite-3x'|'std-3x'", defaultValue: "'off'", description: '工作线程 URL 查询参数注入插帧档位' },
        { name: 'uiSr', location: 'query', type: "'off'|'sr-lite'|'sr-std'", defaultValue: "'off'", description: '工作线程 URL 查询参数注入 2× AI 超分档位' },
      ],
      responses: [
        { status: 'OK · RingActive', tone: 'ok', summary: '以零拷贝共享纹理环呈递并周期发出 pvsspw-frameflow-stats' },
      ],
      examples: [
        {
          label: '运行期即时切换后处理预设',
          lang: 'js',
          code: "window.vitaPlayer.setFrameflow('lite-2x');\nwindow.vitaPlayer.setGameSr('sr-lite');",
        },
      ],
    },
    {
      id: 'serve-and-probes',
      group: 'harness-and-probes',
      kind: 'POST',
      title: 'COOP/COEP 回环服务、后端启动与 GPU 提交探针',
      signature: 'python3 scripts/serve.py vitaslop --fixed --port 18747  |  POST /__local/open-edge',
      auth: '仅回环 + 同源四重头校验（防跨域探测）',
      stability: '对测基础设施',
      summary:
        '隔离端口为两个核心提供 COOP/COEP 响应头；/__local/open-edge 严格验证 Host/Origin/Sec-Fetch-Site/X-PVSSPW-Action；worker-probe.js 只统计写入主显示表面的独特提交信号 pvsspw-submit。',
      relatedLink: '/docs/deployment',
      relatedLabel: '查看构建与回环启动步骤',
      capabilities: [
        'report.py 对全部对比截图和实验 JSON 强核对 SHA-256 指纹后再刷新 results/COMPARISON.md',
        'battle.mjs 支持 PV_FSR_COMPARE=1 同游戏帧抓取 native / off / on 无损对比图',
      ],
      limitations: [
        '不含商业游戏包、固件或任何公网远程管理接口',
      ],
      params: [
        { name: 'X-PVSSPW-Action', location: 'header', type: "'open-edge'", required: true, description: '/__local/open-edge 必需同源定制请求头（载荷上限 256B）' },
        { name: 'backend', location: 'body', type: "'webgpu'|'vulkan'|'nvidia'|'opengl'|'software'", required: true, description: '对应 edge_backends.py 的本地浏览器驱动参数表' },
      ],
      responses: [
        { status: '202 Accepted', tone: 'ok', summary: '校验全部通过后独立拉起对应后端浏览器窗口' },
        { status: '403 / 400 Forbidden', tone: 'err', summary: '任意 Host / Origin / Sec-Fetch-Site 不一致或驱动缺失即拒绝' },
      ],
      examples: [
        {
          label: '还原基线、启动服务与集成回归',
          lang: 'bash',
          code: "python3 scripts/prepare.py players\nnode --test tests/*.test.mjs\npython3 scripts/serve.py vitaslop --fixed --port 18747\n# 另一终端（Intel Xe-LPG）：\nVK_DRIVER_FILES=/usr/share/vulkan/icd.d/intel_icd.json node tests/workbench.mjs --intel",
        },
      ],
    },
  ],
};

export const apiSpecEn: ApiCatalogSpec = {
  project: 'PVSSPW · Workbench Gates, Adaptive SMP, Zero-Copy Post-FX & Probe API',
  subtitle:
    'Documents pre-launch capability checks & Web Locks, thread-policy.js adaptive pooling, frameflow-worker.js 3-slot sharing, serve.py loopback checks, and worker-probe.js.',
  environments: [
    { label: 'Patched Vitaslop Workbench (serve.py --fixed)', value: 'http://127.0.0.1:18747' },
    { label: 'Locked Baseline Vitaslop / Vita3K Web', value: 'http://127.0.0.1:18741' },
  ],
  searchPlaceholder: 'Search checkPlatform, chooseThreadPolicy, frameflow-worker, Fsr1, open-edge, pvsspw-submit…',
  emptyText: 'No matching PVSSPW workbench API, backend flag, or probe found.',
  labels: {
    allGroups: 'All',
    canDo: '✅ Supported',
    cannotDo: '⛔ Explicit Non-Goals & Limits',
    params: 'Parameters, Knobs & Header Guards',
    paramName: 'Field / Knob / Header',
    paramLocation: 'Scope',
    paramType: 'Type / Default',
    paramRequired: 'Required',
    paramDesc: 'Behavior & Rejection Criteria',
    responses: 'Status & Guards',
    examples: 'Usage & CLI Samples',
    responseSample: 'Sample',
    copy: 'Copy',
    copied: 'Copied',
    noParams: 'No extra parameters.',
    required: 'Required',
    optional: 'Optional',
    deepDocs: 'Open Related Guide',
    totalItems: 'APIs / Components',
    envLabel: 'Local Origin',
    mobilePicker: 'Select Component',
    defaultLabel: 'Default',
    plainIndexToggle: 'Plaintext Search & Print Index (Ctrl+K target)',
  },
  groups: [
    { id: 'workbench-gates', title: 'Workbench Gates, Locks & Saves' },
    { id: 'smp-and-postfx', title: 'SMP Thread Policy & Zero-Copy Post-FX' },
    { id: 'harness-and-probes', title: 'Loopback Server & Benchmark Probes' },
  ],
  items: [
    {
      id: 'platform-and-graphics',
      group: 'workbench-gates',
      kind: 'SDK',
      title: 'Platform Readiness & Adapter Probe (checkPlatform / findGraphics)',
      signature: 'checkPlatform() + probeGraphics(preference)',
      auth: 'Secure Context + Worker Probes',
      stability: 'Pre-Launch Hard Gate',
      summary:
        'Flags missing Secure Context, WebAssembly, JSPI, OffscreenCanvas, or OPFS sync access handles as fatal; probes core -> compatibility -> fallback adapters preferring hardware GPUs.',
      relatedLink: '/en/docs/',
      relatedLabel: 'Open Scope Boundaries',
      capabilities: [
        'Probes OPFS createSyncAccessHandle inside /probe-worker.js with a 5s timeout',
        'Skips software rasterizers whenever a hardware adapter is available',
      ],
      limitations: [
        'Rejects non-secure HTTP LAN access or missing JSPI / OPFS sync handles',
        'Software-only adapters inject uiPresent=software and disable GameFI / GameSR',
      ],
      params: [
        { name: 'preference', location: 'config', type: "'high-performance' | 'low-power' | ''", defaultValue: "'high-performance'", description: 'Adapter power preference sequence' },
        { name: 'storageLock', location: 'method', type: 'navigator.locks (pvsspw-library)', description: 'Non-blocking ifAvailable lock preventing concurrent library corruption' },
      ],
      responses: [
        { status: 'OK · HardwareAdapter', tone: 'ok', summary: 'All fatal gates pass with hardware WebGPU adapter' },
        { status: 'Fatal · MissingCapability', tone: 'err', summary: 'Stops launch before core allocation with fix hint' },
      ],
      examples: [
        {
          label: 'Run Platform & GPU Preflight',
          lang: 'js',
          code: "import { checkPlatform } from '/ui/platform.js';\nimport { probeGraphics } from '/ui/graphics.js';\nconst checks = await checkPlatform();\nconst gfx = await probeGraphics('high-performance');",
        },
      ],
    },
    {
      id: 'save-zip-validation',
      group: 'workbench-gates',
      kind: 'SDK',
      title: 'Save Export & Worker ZIP Verification (exportSaves / restoreSaves)',
      signature: 'exportSaves(titleId?) / restoreSaves(file, titleId?)',
      auth: 'Validated inside /gamedata-worker.js',
      stability: 'Local Save Safety',
      summary:
        'Exports single-title or full-profile save archives and runs schema checks in /gamedata-worker.js before user confirmation on restore.',
      relatedLink: '/en/docs/performance',
      relatedLabel: 'Open Benchmark Protocol',
      capabilities: [
        'Enforces [A-Za-z0-9_-]+.zip naming and rejects duplicate archive entries',
      ],
      limitations: [
        'Pure local browser storage only — OPFS presence does not replace verifying real in-game load state',
      ],
      params: [
        { name: 'id', location: 'arg', type: 'string (optional)', description: 'Optional titleId scoping single-game save ZIP operations' },
      ],
      responses: [
        { status: 'OK · Confirmed', tone: 'ok', summary: 'Restores saves into current profile after worker validation + confirmation' },
      ],
      examples: [
        {
          label: 'Export Single Title Saves',
          lang: 'js',
          code: "import { exportSaves } from '/ui/files.js';\nawait exportSaves('PCSG00214');",
        },
      ],
    },
    {
      id: 'thread-policy',
      group: 'smp-and-postfx',
      kind: 'CONFIG',
      title: 'Adaptive Guest SMP Policy (chooseThreadPolicy)',
      signature: 'chooseThreadPolicy(knobs, device, { titleId, adapter, measure })',
      auth: 'Resolved pre-boot before core scheduler binds',
      stability: 'Core SMP Scheduler',
      summary:
        'Resolves single, manual (1..8), measured hardware case (3 workers for PCSG00214 on Linux Edge 157 Intel Xe-LPG), or smallest parallel pool within 90% of peak worker throughput (1.2s timeout -> budget fallback).',
      relatedLink: '/en/docs/contracts',
      relatedLabel: 'Open Patch & SMP Contracts',
      capabilities: [
        'Reserves 2 host cores and clamps guest workers between 2 and 6 based on RAM & CPU count',
      ],
      limitations: [
        'Worker pool count cannot be hot-swapped mid-session once core threads start',
      ],
      params: [
        { name: 'VITASLOP_SMP', location: 'config', type: "'0' | '1'", defaultValue: "'1'", description: 'Forces single-thread execution when set to 0' },
        { name: 'VITASLOP_SMP_WORKERS', location: 'config', type: '1..8', description: 'Overrides adaptive pool sizing with an explicit count' },
      ],
      responses: [
        { status: 'OK · PoolResolved', tone: 'ok', summary: 'Applies workers to VITASLOP_SMP_WORKERS before worker spawn' },
      ],
      examples: [
        {
          label: 'Run Thread Policy & Unit Checks',
          lang: 'bash',
          code: 'node --test tests/*.test.mjs',
        },
      ],
    },
    {
      id: 'frameflow-worker-bridge',
      group: 'smp-and-postfx',
      kind: 'HOOK',
      title: 'Shared-GPUDevice Zero-Copy Ring & FSR 1 Mutual Exclusion',
      signature: 'web/frameflow-worker.js -> bench/worker-probe.js -> worker.js',
      auth: 'Wraps GPUAdapter / GPUCanvasContext / swapchain',
      stability: 'Zero-Copy Post-FX',
      summary:
        'Enables shader-f16 when exposed on hardware adapters, intercepts swapchain writes into 3-slot frameflow-ring-0..2 for GameFI/GameSR, and suppresses native fsr1 whenever GameSR is active.',
      relatedLink: '/en/docs/performance',
      relatedLabel: 'Open Post-FX Pipeline',
      capabilities: [
        'Live preset switching via window.vitaPlayer.setFrameflow() and setGameSr()',
        'Adapts internal flow working size on >720p targets to sustain throughput',
      ],
      limitations: [
        'uiPresent=software forces AI presets off and falls back to 2D canvas frames',
      ],
      params: [
        { name: 'uiFrameflow', location: 'query', type: "'off'|'lite-2x'|'std-2x'|'lite-3x'|'std-3x'", defaultValue: "'off'", description: 'Interpolation preset query parameter injected by engine.js' },
        { name: 'uiSr', location: 'query', type: "'off'|'sr-lite'|'sr-std'", defaultValue: "'off'", description: '2x AI SR preset query parameter (mutually exclusive with native FSR 1)' },
      ],
      responses: [
        { status: 'OK · ZeroCopyRing', tone: 'ok', summary: 'Presents monotonically without blocking GPU->CPU readbacks' },
      ],
      examples: [
        {
          label: 'Toggle AI Presets at Runtime',
          lang: 'js',
          code: "window.vitaPlayer.setFrameflow('lite-2x');\nwindow.vitaPlayer.setGameSr('sr-lite');",
        },
      ],
    },
    {
      id: 'serve-and-probes',
      group: 'harness-and-probes',
      kind: 'POST',
      title: 'COOP/COEP Loopback Server, Backend Launcher & Submit Probe',
      signature: 'python3 scripts/serve.py vitaslop --fixed --port 18747  |  POST /__local/open-edge',
      auth: 'Loopback-only + Same-Origin 4-Header Guard',
      stability: 'Benchmark Infrastructure',
      summary:
        'Serves isolated origins with COOP/COEP headers, enforces same-origin validation on local backend launching, and hooks GPUQueue.submit to count unique swapchain draws via pvsspw-submit.',
      relatedLink: '/en/docs/deployment',
      relatedLabel: 'Open Setup & Build Guide',
      capabilities: [
        'report.py validates SHA-256 digests on every cited JSON trial and image before building COMPARISON.md',
        'PV_FSR_COMPARE=1 captures native/off/on texture triples from the same game frame',
      ],
      limitations: [
        'Ships zero commercial ROMs, firmware dumps, or remote HTTP admin panels',
      ],
      params: [
        { name: 'X-PVSSPW-Action', location: 'header', type: "'open-edge'", required: true, description: 'Required same-origin launcher header on /__local/open-edge (<=256B body)' },
        { name: 'backend', location: 'body', type: "'webgpu'|'vulkan'|'nvidia'|'opengl'|'software'", required: true, description: 'Selects launch flags from scripts/edge_backends.py' },
      ],
      responses: [
        { status: '202 Accepted', tone: 'ok', summary: 'Spawns the configured Edge/Chromium backend session locally' },
        { status: '403 / 400 Forbidden', tone: 'err', summary: 'Rejects cross-origin or invalid backend payloads immediately' },
      ],
      examples: [
        {
          label: 'Restore, Test & Launch Fixed Workbench',
          lang: 'bash',
          code: "python3 scripts/prepare.py players\nnode --test tests/*.test.mjs\npython3 scripts/serve.py vitaslop --fixed --port 18747",
        },
      ],
    },
  ],
};
