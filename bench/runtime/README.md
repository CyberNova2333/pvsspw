# 锁定的网页播放器

`players.tar.gz` 保存本轮使用的两份静态播放器快照。文件来自下列项目的公开部署。归档只含模拟器运行资源，游戏和固件由测试人员从本地准备。每个文件的相对路径和 SHA-256 见上一级的 `players.lock.json`。采样探针由本地服务在响应时加载。

| 项目 | 对应部署源码 | 公开部署 | 许可 |
|---|---|---|---|
| Vitaslop | [a6bd778](https://github.com/cretz/vitaslop/tree/a6bd7788c9205ab9208f1970bc2de8e49e3ccd2e) | [项目播放器](https://cretz.github.io/vitaslop/) | [MIT](vitaslop-LICENSE.txt) |
| Vita3K Web | [4c8ead3](https://github.com/notwindstone/vita3k-web/tree/4c8ead371ef4e6a1f2cef2504ef12a441bcb4ee2) | [项目播放器](https://notwindstone.github.io/vita3k-web/) | [GPL v2](vita3k-LICENSE.txt) |

归档保留着色器依赖随网页发布的许可证。源码、锁文件和构建工作流见对应提交。Vita3K Web 使用部署时的提交，仓库后续提交需要作为另一版本重新测试。
