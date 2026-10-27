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
- Adjust playback speed, light/dark UI theme, and visualization quality; the canvas uses a fixed industrial theme.
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

Validate changes with `yarn typecheck && yarn check:regressions && yarn build`. Type checking covers both the Vue app and the simulation server. The regression command uses the existing Vite/Vue runtime and Node assertions without opening a port or adding a test framework.

Replay scheduling regressions count actual canvas draws for consecutive playback frames, including pause, seek, hide/show and the final frame. They also play the default log through its full 12 seconds, covering moving nodes, collisions and the successful-reception hold immediately after 1.54 seconds. For browser performance measurements, record both animation-frame callbacks and actual draws, along with the rendering backend; callback frequency alone can conceal skipped canvas updates.

The 3D view loads on demand and offers retry controls if loading or initialization fails. Development dependencies use a separate browser cache and Babylon is prebundled at startup.

Click the eye beside a protocol in the experiment library to read its C++ implementation and header from the selected simulator directory. The read-only viewer supports file switching and copying without compiling or applying the protocol. This requires `yarn dev`; static hosting and `yarn preview` do not expose local source files.

Experiment JSON, generated C++, and protocol source previews share syntax highlighting in both UI themes. Highlighting runs in a background worker; copying preserves the original text.

The protocol library is ordered Application → Routing → MAC → PHY → Channel. PHY, channel, and propagation models are selected independently, including the built-in ideal terrestrial models. Selecting one never changes another layer. The right sidebar manages global simulation settings; protocol parameters are edited on the left and application parameters on node cards. Defaults, types, and editability come from registered TypeId metadata. The ideal radio PHY defaults to 1 Mbps; radio propagation uses 299,792,458 m/s and the configured transmission range. At 1 km, propagation alone is about 667 ms at 1,500 m/s versus 3.34 μs at light speed. Finite airtime and half-duplex collisions are modeled; path loss, random errors, and energy consumption are not. MAC slot/guard times remain as configured. This is a simple comparison model, not a Wi-Fi or terrain model.

## Running Real Simulations (optional)

The experiment page can generate a scratch simulation and run it against a local [aqua-sim-dev](https://github.com/GuanlunMu/aqua-sim-dev) checkout (ns-3 + Aqua-Sim). Set the `AQUA_SIM_HOME` environment variable to that checkout's path:

```bash
export AQUA_SIM_HOME=/path/to/aqua-sim-dev
yarn dev
```

Requirements and behavior:

- Keep aqua-sim-dev as a sibling checkout; it does not need to be copied into this repository. The directory must contain an executable `ns3` script and `src/aqua-sim-tg`. Missing configuration is created on the first run; a working native build toolchain is required.
- The experiment page’s **仿真环境** panel lets you browse and select a directory on the server machine or enter its path, remembers it in the current browser, and provides a **预编译** button that configures the checkout when needed and runs `./ns3 build`, with live build progress. **清除构建** runs `./ns3 clean` on the selected checkout. The input placeholder shows the actual server default path. On entering the experiment page, a successful initial directory check automatically starts one incremental precompile. Requests for the same directory share an active precompile. If a simulation, clean, or another directory’s build is running, the page waits and continues automatically once it finishes; changing the directory or leaving the page cancels that wait. Invalid directories do not start a build; failures remain visible for manual retry. Selecting or importing a different directory only checks its path.
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
    ├── state/              # page-level reactive replay handoff
    ├── shared/             # pure helpers + shared types (no Vue / Babylon / DOM deps)
    └── styles/             # global CSS, split per domain (main, themes, pages/*)
```

## Notes

- `pages/ReplayPage.vue` owns replay state and wires the replay feature together; `features/replay/lib` holds the pure log parsing / normalization / merge code.
- `pages/ExperimentPage.vue` owns the workbench layout and delegates to `features/experiment` composables (`useTopologyEditor`, `useRunExperiment`).
- `server/` is TypeScript executed by the Vite dev server; `yarn typecheck` checks it with `tsconfig.node.json` in addition to the frontend configuration. Server changes also require a build and `/api/run` smoke check.

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
- 可调整播放倍速、界面明暗主题和可视化质量；画布固定使用工业监控主题。
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

改动后执行 `yarn typecheck && yarn check:regressions && yarn build`。类型检查覆盖前端与服务端；回归检查使用现有 Vite/Vue 和 Node assert，不监听端口、不引入测试框架，覆盖旧日志兼容、实验文件、画布状态及异步请求。

回放调度回归以实际画布绘制次数检查连续播放、暂停、定位、隐藏/恢复及最后一帧。浏览器性能测量应同时记录 RAF 回调次数、实际绘制次数和渲染后端；仅统计 RAF 频率无法发现画布漏帧。

3D 视图按需加载；加载或初始化失败时显示错误和重试入口。开发服务单独保存浏览器依赖缓存，并在启动时预构建 Babylon。

实验页协议库每项右侧的小眼睛可查看当前仿真目录中的 C++ 实现与头文件，支持切换文件和复制。查看为只读操作，无需预编译，也不会应用协议。此功能需使用 `yarn dev`；静态部署和 `yarn preview` 不提供本地源码读取接口。

实验 JSON、生成的 C++ 与协议源码预览均支持明暗主题语法高亮。高亮在后台线程处理，复制保留原始文本。

协议库从上到下按 **应用层 → 路由层 → MAC 层 → 物理层 → 信道** 排列。PHY、信道和传播模型独立选择，包括内置的理想陆地模型；选择一项不会改动其他层。右侧仅管理全局仿真设置，协议参数在左侧已应用协议中编辑，节点应用参数在节点卡片中编辑。Radio PHY 的 DataRate 注册默认值为 1 Mbps，Radio Propagation 以 299,792,458 m/s 传播并按发送端通信距离筛选：1 km 单程传播约为水下 667 ms（按 1,500 m/s）与陆地 3.34 μs。发送占用时间、半双工碰撞及所设 MAC 时隙仍生效；不加入路径损耗、随机误码或能耗模型。此模型用于突出传播速度差异，不代表完整 Wi-Fi 或真实地形模型。

## 运行真实仿真（可选）

实验页可以生成 scratch 仿真并调用本地 [aqua-sim-dev](https://github.com/GuanlunMu/aqua-sim-dev)（ns-3 + Aqua-Sim）运行。通过 `AQUA_SIM_HOME` 环境变量指定该仓库路径：

```bash
export AQUA_SIM_HOME=/path/to/aqua-sim-dev
yarn dev
```

要求与行为：

- 首次打开实验页会创建空白实验；拖动画布空白处可平移，拖动已有节点可移动，右键画布可填写 X/Y/Z 坐标精确添加节点，也可在「实验文件」中导入参数。实验与回放之间切换会保留当前拓扑、协议选择、协议属性和全部表单参数；刷新页面会重新创建空白实验，需要跨会话保存时请导出参数。
- 顶部「新建实验」清空当前实验；右侧抽屉底部「实验文件」中的「导出参数」下载 `experiment.json`，「导入参数」恢复实验，也兼容以前导出的 v0 规格。新文件使用 editor.version=3 保存完整编辑状态，包括未启用协议的属性、完整坐标及仿真目录；兼容导入旧 v0/v1/v2 文件，并将旧右侧快捷参数迁入左侧对应协议，显式协议属性优先。导入不自动运行或编译。文件校验失败不影响当前草稿。
- aqua-sim-dev 保持为同级独立仓库，无需复制进本项目。目录必须包含可执行的 `ns3` 脚本与 `src/aqua-sim-tg`；首次运行时自动补充 configure，仍需安装本机编译工具链。
- 实验页右侧的「仿真环境」可通过「选择目录」浏览并选用**运行服务的机器上的目录**，也可手动填写路径；设置自动保存在当前浏览器，输入框占位提示显示服务器实际默认路径。进入实验页时，初次目录检查通过后会自动预编译一次；同一目录已有预编译时复用其进度和结果；其他构建、清理或仿真任务运行时显示等待，任务结束后自动继续，切换目录或离开页面可取消等待。目录无效不会开始，失败显示原因并可点击「预编译」手动重试。预编译在必要时执行 configure，再执行增量 `./ns3 build`；构建中显示阶段和编译进度，完成后可查看输出。「清除构建」执行 `./ns3 clean` 清除所选目录的构建产物和配置缓存，之后需重新预编译。选择、恢复默认或导入其他目录仍只检查路径。
- 优先级：前端目录 → `AQUA_SIM_HOME` → 仓库根目录的 `../aqua-sim-dev`。清空输入或点击「恢复默认」使用服务器默认值；显式设置的路径无效时直接报错，不静默切换到其他仓库。
- 配置时使用 `--disable-werror`，保留编译警告但不将其升级为错误。已有目录若启用了 `NS3_WARNINGS_AS_ERRORS`，会先重新配置关闭它，保留原有构建模式、模块选择等缓存选项。
- 预编译与仿真共用服务端互斥锁；configure 与 build 各限时 15 分钟。预编译构建已有 ns-3 目标，并编译运行 TypeId 元数据探针（不创建仿真节点）；新生成的实验代码仍会在运行实验时编译。
- 预编译成功后，协议目录按 TypeId 继承关系和构造函数动态列出各层及 Application 类型，并读取继承属性、类型、默认值和读写/构造标记。尚未编译注册的源码、抽象类和辅助类型不作为可选协议。目录缓存在开发服务器内存中，服务重启后重新预编译即可加载。
- 「协议属性」展示所选类型及其父类的注册参数。可构造属性统一交给 ns-3 的真实 AttributeChecker 校验，留空使用注册默认值；对象容器、非构造属性和托管连接只读显示，不静默隐藏。新实验不自动填写某个协议的节点数、时隙、首轮延迟或应用时间。具有 Protocol/Remote Socket 配置入口的应用需明确选择目的节点，设备和 Socket 连接由公共装配负责；其他应用不强制目的节点。旧文件的快捷参数、别名与流量预设在导入时兼容转换。
- 点击 2D 节点显示并固定小卡片，鼠标经过不弹出；点关闭、按 Esc 或点击卡片外部关闭。实验页卡片中可配置该节点的应用、独立目的节点及发送间隔等属性；应用必须明确选择目的节点。节点参数会随草稿和参数文件保存，统一 PHY/MAC/路由/信道属性仍在侧栏。
- 注册成功表示类型可选择，不表示任意协议组合、Socket 语义或外部资源都可用。需要外部程序、环境文件、设备或不同传输服务的模型仍须具备相应运行条件；平台不按协议名称增加特殊预检或静默修改配置，运行错误统一显示在输出中。
- 所有协议统一优先返回本次生成的 PHY 收发日志，缺失或无发送事件时回退到原生日志。新日志用 `time_precision_us=0.001` 声明纳秒精度，并从所选传播接口读取传播速度；回放不按协议名称选择时间处理路径。通用日志记录实际发射与成功接收，不推测丢包或冲突原因。旧日志导入兼容保持不变。
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
    ├── state/              # 页面层跨路由回放交接状态
    ├── shared/             # 纯函数助手 + 共享类型（不依赖 Vue / Babylon / DOM）
    └── styles/             # 全局 CSS，按域拆分（main、themes、pages/*）
```

## 说明

- `pages/ReplayPage.vue` 持有回放状态并组装 replay 功能域；`features/replay/lib` 是纯日志解析 / 规范化 / 合并代码。
- `pages/ExperimentPage.vue` 持有工作台布局，逻辑委托给 `features/experiment` 的 composables（`useTopologyEditor`、`useRunExperiment`）。
- `server/` 由 Vite 开发服务器直接执行；`yarn typecheck` 分别通过前端配置与 `tsconfig.node.json` 检查前后端。服务端改动还需构建及 `/api/run` 冒烟验证。
