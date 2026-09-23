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
- CSS design tokens and component styles

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

- Keep aqua-sim-dev as a sibling checkout; it does not need to be copied into this repository. The directory must contain an executable `ns3` script and `src/aqua-sim-tg`. Missing configuration is created on the first run; a working native build toolchain is required.
- The experiment page’s **仿真环境** panel lets you browse and select a directory on the server machine or enter its path, remembers it in the current browser, and provides a **预编译** button that configures the checkout when needed and runs `./ns3 build`. The input placeholder shows the actual server default path. Initial loading and directory selection only check paths; they never start compilation.
- Selection priority: browser setting → `AQUA_SIM_HOME` → `../aqua-sim-dev` relative to the repository root. Clear the field or use **恢复默认** to restore server defaults. An invalid explicit path produces an error instead of silently selecting another checkout.
- Configuration uses `--disable-werror` so warnings from newer compilers remain visible without becoming fatal errors. Existing checkouts with `NS3_WARNINGS_AS_ERRORS=ON` are reconfigured once, preserving their cached profile and module selection.
- Precompilation and simulation share a server-side lock. Configure and build each have a 15-minute timeout. Precompilation builds the existing ns-3 targets without running a simulation; newly generated experiment code is still compiled when running an experiment.
- Absolute paths, `~/` paths, and paths relative to this repository root are accepted. Browser settings apply to each request; they do not modify the server environment or other browsers.
- When no valid checkout is found, clicking "运行仿真" returns a clear error and all replay features keep working unaffected.

`AQUA_SIM_HOME` is read from the dev server process environment (`server/simulatorConfig.ts`); it is not needed for building or replaying logs. Simulation endpoints are available through `yarn dev`, not through `yarn preview` or a static `dist/` deployment.

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
- CSS 设计令牌与组件样式

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

- 首次打开实验页会创建空白实验；在画布空白处单击即可添加节点，拖动空白处平移画布，也可在「实验文件」中导入参数。实验与回放之间切换会保留当前拓扑、协议选择、协议属性和全部表单参数；刷新页面会重新创建空白实验，需要跨会话保存时请导出参数。
- 顶部「新建实验」清空当前实验；「实验文件」中的「导出参数」下载 `experiment.json`，「导入参数」恢复实验，也兼容以前导出的 v0 规格。新文件额外保存未启用的流量/MAC 参数、完整坐标及仿真目录；导入不自动运行或编译。文件校验失败不影响当前草稿。
- aqua-sim-dev 保持为同级独立仓库，无需复制进本项目。目录必须包含可执行的 `ns3` 脚本与 `src/aqua-sim-tg`；首次运行时自动补充 configure，仍需安装本机编译工具链。
- 实验页右侧的「仿真环境」可通过「选择目录」浏览并选用**运行服务的机器上的目录**，也可手动填写路径；设置自动保存在当前浏览器，输入框占位提示显示服务器实际默认路径。点击「预编译」会在必要时执行 configure，再执行 `./ns3 build`，完成后可查看编译输出；打开页面和选择目录只检查路径，不自动编译。
- 优先级：前端目录 → `AQUA_SIM_HOME` → 仓库根目录的 `../aqua-sim-dev`。清空输入或点击「恢复默认」使用服务器默认值；显式设置的路径无效时直接报错，不静默切换到其他仓库。
- 配置时使用 `--disable-werror`，保留编译警告但不将其升级为错误。已有目录若启用了 `NS3_WARNINGS_AS_ERRORS`，会先重新配置关闭它，保留原有构建模式、模块选择等缓存选项。
- 预编译与仿真共用服务端互斥锁；configure 与 build 各限时 15 分钟。预编译构建已有 ns-3 目标，并编译运行 TypeId 元数据探针（不创建仿真节点）；新生成的实验代码仍会在运行实验时编译。
- 预编译成功后，协议目录按当前运行库的 TypeId 继承关系和构造函数动态列出物理层、MAC、路由、Aqua-Sim 应用、信道及传播模型。仅有源码、尚未编译注册的协议，以及抽象基类、报头等辅助类型，不作为可选协议。目录缓存在开发服务器内存中，服务重启后重新预编译即可加载。
- 「协议属性」读取所选类型及其父类的构造属性，支持标量与应用的随机时间分布；节点应用可以独立选择、设置属性。填写属性会覆盖实验表单参数，清空则使用实验参数或协议默认值。应用在节点卡片中独立设置，发送源就是所在节点，目的节点需明确选择；不再设置全局应用、源节点或目的节点。节点属性留空使用注册默认值，启动时间默认 0s，停止时间默认仿真结束。旧实验导入时将全局流量预设和目的地址迁移到节点设置。设备连接、Socket 协议与远端地址由生成器按拓扑连接。
- 点击 2D 节点显示并固定小卡片，鼠标经过不弹出；点关闭、按 Esc 或点击卡片外部关闭。实验页卡片中可配置该节点的应用、独立目的节点及发送间隔等属性；未指定目的节点时沿用实验默认。节点参数会随草稿和参数文件保存，统一 PHY/MAC/路由/信道属性仍在侧栏。
- Bellhop / Bellhop3D 需要所选目录内相应的可执行程序与节点环境文件；Phy Modem 需要实际可读写的串口设备（`devName`）。注册成功表示可被选择，不代表任意协议组合或外部资源都可用；运行前会检查这些依赖。
- 回放优先使用协议自身生成的本次 `net.*` 日志；没有专用日志时生成通用 PHY 收发日志，包含发射与实际成功接收事件，不推测丢包或冲突原因。
- 支持绝对路径、`~/` 路径和相对本仓库根目录的路径。前端设置随每次请求传递，不修改服务器环境变量，也不影响其他浏览器。
- 找不到有效目录时，点击「运行仿真」会返回明确错误，其余回放功能不受影响。

`AQUA_SIM_HOME` 从开发服务器进程环境读取（`server/simulatorConfig.ts`）；构建项目或回放日志都不需要它。仿真接口仅在 `yarn dev` 下提供，`yarn preview` 或静态部署 `dist/` 不提供仿真接口。

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
