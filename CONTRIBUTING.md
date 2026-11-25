# 贡献指南 / Contributing

## 贡献许可与附加条款约定 / Contribution Licensing & Additional Terms

依据 [`LICENSE-ADDITIONAL_TERMS-zh-CN.md`](LICENSE-ADDITIONAL_TERMS-zh-CN.md)（v1.6.7-r4）第 1.7—1.9 款，向本项目提交拉取请求（PR）、补丁或其他贡献时，你须确认对所提交内容享有合法授权权利并同意按对应基础许可证（第一方原创代码为 [GNU AGPLv3](LICENSE)）提供。如你希望将个人享有版权的贡献纳入 [`LICENSE-ADDITIONAL_TERMS-zh-CN.md`](LICENSE-ADDITIONAL_TERMS-zh-CN.md)（英文参考：[`LICENSE-ADDITIONAL_TERMS-en.md`](LICENSE-ADDITIONAL_TERMS-en.md)，实施指南：[`IMPLEMENTATION-GUIDE.zh-en.md`](IMPLEMENTATION-GUIDE.zh-en.md)）适用范围，请在 PR 说明或可核实记录中**分别明确声明**对附加要求以及对第 9.5–9.6 款有条件附加许可的授权范围；未作明确声明的贡献将如实记为 `[附加条款：未发表意见]` 并按原适用基础许可证处理。引入第三方组件或独立美术、字体资产的，须按 [`ASSETS_LICENSES.md`](ASSETS_LICENSES.md) 如实登记来源、原始作者与有效许可原文；**严禁提交任何商业 PS Vita 游戏镜像、解密固件文件、密钥或来源不明二进制文件**。

Pursuant to Sections 1.7–1.9 of [`LICENSE-ADDITIONAL_TERMS-zh-CN.md`](LICENSE-ADDITIONAL_TERMS-zh-CN.md) (v1.6.7-r4; English reference: [`LICENSE-ADDITIONAL_TERMS-en.md`](LICENSE-ADDITIONAL_TERMS-en.md); implementation guide: [`IMPLEMENTATION-GUIDE.zh-en.md`](IMPLEMENTATION-GUIDE.zh-en.md)), submitting a pull request, patch, or other contribution confirms that you hold the requisite rights to license your submission under the applicable base license ([GNU AGPLv3](LICENSE) for first-party code). Express authorization for the Additional Requirements and for the conditional additional permission in Sections 9.5–9.6 is verified separately; submissions without an express verifiable statement are recorded as `[Additional terms: No recorded position]` and remain governed by their base license. Never commit commercial PS Vita game dumps, decrypted firmware files, PSN keys, or unverified binaries.

## 提交与核验 / Commits and Verification

- 提交标题采用 Conventional Commits：`type(scope): 描述`，不超过 100 个字符；其余协作规范见 [`AGENTS.md`](AGENTS.md)。
- 修改工作台逻辑或调度策略后运行 `node --test tests/*.test.mjs`；涉及界面与 WebGPU 后处理流程时，配合 `python3 scripts/serve.py vitaslop --fixed --port 18747` 与 `node tests/workbench.mjs --intel` 验证无报错通过。
