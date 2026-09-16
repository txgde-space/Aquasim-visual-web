# Aquasim Visual Web

Aquasim Visual Web is a web-based visualization and replay platform for Aqua-Sim / ns-3 underwater acoustic network simulations.

It helps researchers observe dynamic underwater network behavior more intuitively, including node topology, packet transmission, collisions, propagation delay, and protocol execution over time. Instead of relying only on raw logs or numerical outputs, users can replay structured simulation events through an interactive web interface.

This project addresses a tooling gap in the underwater acoustic network research ecosystem. While Aqua-Sim / ns-3 provides powerful simulation capabilities, mature and easy-to-use visualization tools for underwater network experiments are still limited. Aquasim Visual Web is designed as a lightweight and extensible companion tool for protocol debugging, experiment analysis, and result presentation.

The app includes both a 2D Canvas replay view and a Babylon.js 3D view, so it can be used for quick packet-level debugging as well as spatial inspection of acoustic network behavior.

## Features

- Replay underwater acoustic packet transmission over a simulation timeline.
- Switch between 2D Canvas and 3D Babylon.js visualizations.
- Inspect node status, packet paths, receiver results, and collision reasons.
- Load bundled demo logs or import custom log files from the browser.
- Merge node-level logs into a packet-level replay.
- Use global replay mode or packet lifecycle mode.
- Adjust playback speed, visual theme, and visualization quality.
- Measure distances directly in the 2D view.
- Edit node topology and run real Aqua-Sim / ns-3 simulations from the experiment page (requires a local aqua-sim-dev checkout, see below).

## Tech Stack

- Vue 3
- Vite
- Babylon.js
- Tailwind CSS

## Getting Started

Install dependencies:

```bash
yarn install
```

Start the development server:

```bash
yarn dev
```

Expose the development server on the LAN / public interface (`0.0.0.0`):

```bash
yarn dev:public
```

Vite will print a Network URL. Other devices can open that address; the machine firewall must allow the port (default `5173`).

Build for production:

```bash
yarn build
```

Preview the production build:

```bash
yarn preview
```

This project uses Yarn v1 and keeps `yarn.lock` as the only dependency lockfile.

## Running Real Simulations (optional)

The experiment page can generate a scratch simulation and run it against a local [aqua-sim-dev](https://github.com/GuanlunMu/aqua-sim-dev) checkout (ns-3 + Aqua-Sim). Set the `AQUA_SIM_HOME` environment variable to that checkout's path:

```bash
export AQUA_SIM_HOME=/path/to/aqua-sim-dev
yarn dev
```

Requirements and behavior:

- The directory must contain the `ns3` executable script (i.e. aqua-sim-dev is configured/built).
- When unset, the server falls back to `../aqua-sim-dev` relative to the repository root.
- When no valid checkout is found, clicking "运行仿真" returns a clear error and all replay features keep working unaffected.

`AQUA_SIM_HOME` is read by the dev server (`server/runner.ts`); it is not needed for building or for replaying bundled/imported logs.

## Log Inputs

The app can parse structured JSON and JSON Lines logs. Bundled sample logs are located in `src/assets/`:

- `net.json`
- `net_multihop.json`
- `net_multihop_complex.json`
- `net_chain_5_no_conflict.log`
- `net-swarm.json`
- `net_moving.json`

Supported records include:

- `meta`: simulation metadata such as schema, time unit, distance unit, and simulation end time.
- `node`: node identity, role, and position.
- `movement`: node movement over time.
- `packet`: packet transmission and receiver outcomes.
- `tx` / `rx`: legacy transmission and receive rows.
- `tx_start`, `tx_blocked`, `rx_success`, `rx_drop`, `drop`, `node_event`: node-level events that can be merged into packet-level replay data.

Times are treated as microseconds and distances as meters.

## Project Structure

```text
.
├── index.html
├── package.json
├── yarn.lock
├── vite.config.js
├── server/
│   ├── runner.ts           # /api/run backend: scratch generation, ns-3 run, log collection
│   └── ns3RunPlugin.ts     # Vite middleware wiring the runner into the dev server
├── public/
│   ├── favicon.svg
│   └── icons.svg
└── src/
    ├── main.js
    ├── App.vue             # app shell + navigation
    ├── router.js
    ├── assets/             # bundled sample logs (net*.json / net*.log)
    ├── components/         # cross-feature Vue components
    │   ├── NodeCanvas.vue  # interactive 2D canvas (pan/zoom, tooltip, measure tool)
    │   ├── ExperimentPanel.vue
    │   └── ProtocolDrawer.vue
    ├── features/
    │   ├── canvas2d/       # 2D rendering: composables + draw libraries + themes
    │   ├── scene3d/        # Babylon.js 3D scene: NodeScene3D.vue + scene libraries
    │   ├── replay/         # replay state, log parsing/normalization, playback, log panel
    │   └── experiment/     # topology editor, experiment spec, run composables
    ├── pages/              # route-level pages (ExperimentPage, ReplayPage)
    ├── shared/             # pure helpers + shared types (no Vue / Babylon / DOM deps)
    └── styles/             # global CSS, split per domain (main, themes, pages/*)
```

## Notes

- `pages/ReplayPage.vue` owns replay state and wires the replay feature together; `features/replay/lib` holds the pure log parsing / normalization / merge code.
- `pages/ExperimentPage.vue` owns the workbench layout and delegates to `features/experiment` composables (`useTopologyEditor`, `useRunExperiment`).
- `server/` is plain TypeScript executed by the Vite dev server; it is outside `tsconfig.app.json` (which only covers `src/**`) and is verified through `yarn build`.

---

# Aquasim Visual Web 中文说明

Aquasim Visual Web 是一个基于 Vue 3 + Vite 的水下声学网络仿真回放前端。它可以从结构化仿真日志中可视化节点位置、包传播路径、接收结果、冲突原因和包生命周期。

应用同时提供 2D Canvas 视图和 Babylon.js 3D 视图，既适合快速调试包级事件，也适合观察水下声学网络的空间行为。

## 功能特性

- 按仿真时间线回放水下声学包传输过程。
- 支持 2D Canvas 和 3D Babylon.js 视图切换。
- 查看节点状态、包路径、接收结果和冲突原因。
- 使用内置示例日志，或在浏览器中导入自定义日志文件。
- 支持合并节点级日志并生成包级回放数据。
- 支持全局回放模式和包生命周期模式。
- 可调整播放倍速、视觉主题和可视化质量。
- 在 2D 视图中直接使用测距工具。
- 在实验页编辑节点拓扑并直接运行真实 Aqua-Sim / ns-3 仿真（需要本地 aqua-sim-dev，见下文）。

## 技术栈

- Vue 3
- Vite
- Babylon.js
- Tailwind CSS

## 快速开始

安装依赖：

```bash
yarn install
```

启动开发服务器：

```bash
yarn dev
```

在公网 / 局域网网卡上监听（绑定 `0.0.0.0`）：

```bash
yarn dev:public
```

启动后终端会打印 Network 地址，其他设备用该地址访问。本机防火墙需要放行对应端口（默认 `5173`）。

构建生产版本：

```bash
yarn build
```

预览生产构建：

```bash
yarn preview
```

本项目统一使用 Yarn v1，并只保留 `yarn.lock` 作为依赖锁文件。

## 运行真实仿真（可选）

实验页可以生成 scratch 仿真并调用本地 [aqua-sim-dev](https://github.com/GuanlunMu/aqua-sim-dev)（ns-3 + Aqua-Sim）运行。通过 `AQUA_SIM_HOME` 环境变量指定该仓库路径：

```bash
export AQUA_SIM_HOME=/path/to/aqua-sim-dev
yarn dev
```

要求与行为：

- 该目录必须包含 `ns3` 可执行脚本（即 aqua-sim-dev 已完成 configure/build）。
- 未设置时，服务器会回退到仓库根目录的 `../aqua-sim-dev`。
- 找不到有效目录时，点击「运行仿真」会返回明确错误，其余回放功能不受影响。

`AQUA_SIM_HOME` 由开发服务器（`server/runner.ts`）读取；构建项目或回放内置/导入日志都不需要它。

## 日志输入

应用可以解析结构化 JSON 和 JSON Lines 日志。内置示例日志位于 `src/assets/`：

- `net.json`
- `net_multihop.json`
- `net_multihop_complex.json`
- `net_chain_5_no_conflict.log`
- `net-swarm.json`
- `net_moving.json`

支持的记录类型包括：

- `meta`：仿真元信息，例如 schema、时间单位、距离单位和仿真结束时间。
- `node`：节点身份、角色和坐标。
- `movement`：节点随时间移动的信息。
- `packet`：包发送过程和各接收端结果。
- `tx` / `rx`：旧格式发送和接收记录。
- `tx_start`、`tx_blocked`、`rx_success`、`rx_drop`、`drop`、`node_event`：节点级事件，可合并为包级回放数据。

时间按微秒处理，距离按米处理。

## 项目结构

```text
.
├── index.html
├── package.json
├── yarn.lock
├── vite.config.js
├── server/
│   ├── runner.ts           # /api/run 后端：生成 scratch、运行 ns-3、收集 net.* 日志
│   └── ns3RunPlugin.ts     # Vite 中间件，把 runner 接入开发服务器
├── public/
│   ├── favicon.svg
│   └── icons.svg
└── src/
    ├── main.js
    ├── App.vue             # 应用外壳 + 导航
    ├── router.js
    ├── assets/             # 内置示例日志（net*.json / net*.log）
    ├── components/         # 跨功能域 Vue 组件
    │   ├── NodeCanvas.vue  # 交互式 2D 画布（平移缩放、提示、测距）
    │   ├── ExperimentPanel.vue
    │   └── ProtocolDrawer.vue
    ├── features/
    │   ├── canvas2d/       # 2D 渲染：composables + draw 库 + 主题
    │   ├── scene3d/        # Babylon.js 3D 场景：NodeScene3D.vue + 场景库
    │   ├── replay/         # 回放状态、日志解析/规范化、播放、日志面板
    │   └── experiment/     # 拓扑编辑器、实验规格、运行 composables
    ├── pages/              # 路由页面（ExperimentPage、ReplayPage）
    ├── shared/             # 纯函数助手 + 共享类型（不依赖 Vue / Babylon / DOM）
    └── styles/             # 全局 CSS，按域拆分（main、themes、pages/*）
```

## 说明

- `pages/ReplayPage.vue` 持有回放状态并组装 replay 功能域；`features/replay/lib` 是纯日志解析 / 规范化 / 合并代码。
- `pages/ExperimentPage.vue` 持有工作台布局，逻辑委托给 `features/experiment` 的 composables（`useTopologyEditor`、`useRunExperiment`）。
- `server/` 由 Vite 开发服务器直接执行的 TypeScript，不在 `tsconfig.app.json`（只覆盖 `src/**`）内，通过 `yarn build` 验证。
