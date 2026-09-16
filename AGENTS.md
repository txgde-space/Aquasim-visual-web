# AGENTS.md

本文件记录仓库约定，供后续开发会话（人或 AI）遵守。与代码冲突时以代码为准，发现偏差请更新本文件。

## 验证门槛

- 任何提交前必须 `yarn typecheck && yarn build` 全绿；红灯不进主干。
- 无测试基建（现状），验证靠 typecheck / build / 手动场景。纯函数层（`features/replay/lib`、`features/canvas2d/lib/coordinate.ts`、`features/experiment/lib`）保持无副作用，便于日后补 vitest。
- `server/` 不在 `tsconfig.app.json` 内（其只覆盖 `src/**`），typecheck 不查 server；server 代码靠 vite 打包转译验证，改动后务必 `yarn build` + 手动冒烟 `/api/run`。
- dev 冒烟约定：`yarn dev --port <port> --strictPort` 后台启动，curl 验证后必须 kill，不得留下运行中的 dev server。

## 目录约定与功能域边界

```
src/
├── pages/         # 路由页面：只做状态持有与组装（胶水层），不写业务逻辑
├── features/
│   ├── canvas2d/  # 2D Canvas 渲染：draw/* 纯绘制函数 + composables + themes
│   ├── scene3d/   # Babylon.js：NodeScene3D.vue + 场景库（themes3d/factories/worldAxes/useBabylonScene）
│   ├── replay/    # 回放：lib/ 纯函数（解析/规范化/合并/几何）+ composables + 面板组件
│   └── experiment/# 实验：lib/（spec/catalog/scratch 生成）+ useTopologyEditor/useRunExperiment
├── components/    # 跨功能域共享的 Vue 组件（NodeCanvas/ExperimentPanel/ProtocolDrawer）
├── shared/        # 准入标准见下
└── styles/        # 全局 CSS：main.css（令牌/重置）、themes.css（关键帧）、pages/*.css（按域）
```

- **功能域单向依赖**：pages → features → shared；features 之间不互相 import（replay 不依赖 experiment，反之亦然）。跨域需求下沉到 `shared/` 或 props/emit。
- **组件私有样式**写在 SFC `<style scoped>`；只有跨组件的全局规则才进 `src/styles/`。
- 删除/新增全局 CSS 规则时，先用 `grep -r` 确认选择器在全仓库（含模板动态 `:class`、模板字符串拼接）无引用。

## shared/ 准入标准

进入 `shared/` 的代码必须同时满足：

1. **无副作用**：不操作 DOM / canvas / Babylon / 网络 / 定时器；纯函数或纯常量。
2. **无框架依赖**：不 import vue、@babylonjs 等（类型 import 除外）。
3. **通用性**：被 ≥2 个功能域使用，或明确是领域无关的基础类型/工具。

`shared/types/` 放跨域共享类型；单一功能域专属的类型放该 feature 内部。

## 语言与工具约定

- 包管理只用 Yarn v1，只保留 `yarn.lock`。
- Composable / lib / 新页面用 TypeScript（`<script setup lang="ts">`）。
- 遗留 JS SFC（尚未迁 TS，改它们时不要写 TS 语法）：`components/NodeCanvas.vue`、`components/ExperimentPanel.vue`、`components/ProtocolDrawer.vue`、`features/scene3d/NodeScene3D.vue`、`main.js`、`router.js`。server/ 为 TS。
- 提交用 conventional commit（`refactor(scope): ...` / `feat(server): ...` 风格），每阶段/每逻辑单元独立提交。

## 已知风险与现状（有意保留）

- **`allowedHosts: true`**（`vite.config.js`，dev 与 preview 各一处）：为 LAN 演示功能保留（README 宣称 `yarn dev:public`）。后果：任何能访问该端口的设备都可加载页面并触发 `/api/run` 在本机执行仿真。请勿在不可信网络环境中使用 `dev:public` / `preview --host`。
- `AQUA_SIM_HOME` 指向的 aqua-sim-dev 未配置时，运行仿真返回明确错误（不影响回放功能）。
- build 的 chunk size 警告（rolldown，>500 kB）为现状，不阻断；是否 code-split 属产品决策。
- 日志格式与解析语义冻结：别名兼容逻辑保留，只收敛写法，不改语义。
- Out of scope（重构计划明确不做）：不引入 Pinia / 测试框架 / UI 组件库；不改 Babylon 与 tailwind 大版本；不做视觉 redesign。

## vue-tsc 已知坑（踩过）

- `Object.freeze([...])` 赋给显式数组类型报 TS4104 —— 去掉 freeze。
- 联合类型用 `||` 右操作数会并回已排除分支 —— 用类型守卫函数（见 `experimentSpec.ts` 的 `isActiveTraffic` 模式）。
- 模板里可选属性（如 `Point3D` 的 `z?`）要 `?? 0`。
- `yarn typecheck` 只查 `src/**`；server 改动另需 build 验证。
