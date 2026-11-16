# Aquasim Visual Web

Aquasim Visual Web is a web-based visualization and replay platform for Aqua-Sim / ns-3 underwater acoustic network simulations.

It helps researchers observe dynamic underwater network behavior more intuitively, including node topology, packet transmission, collisions, propagation delay, and protocol execution over time. Instead of relying only on raw logs or numerical outputs, users can replay structured simulation events through an interactive web interface.

This project addresses a tooling gap in the underwater acoustic network research ecosystem. While Aqua-Sim / ns-3 provides powerful simulation capabilities, mature and easy-to-use visualization tools for underwater network experiments are still limited. Aquasim Visual Web is designed as a lightweight and extensible companion tool for protocol debugging, experiment analysis, and result presentation.

The app includes both a 2D Canvas replay view and a Babylon.js 3D view, so it can be used for quick packet-level debugging as well as spatial inspection of acoustic network behavior.

## Features

- Replay underwater acoustic packet transmission over a simulation timeline.
- Switch between 2D Canvas and 3D Babylon.js visualizations.
- Choose an AUV, ROV, vessel, buoy or underwater sensor model in each node card; experiment files and simulation logs retain the choice independently of node role and coordinates.
- Inspect node status, packet paths, receiver results, and collision reasons.
- Load bundled demo logs or import custom log files from the browser.
- Return from the experiment page to the last replay, preserving its log, timeline position, filters and 2D/3D mode within the current page session. Playback returns paused; new simulation results replace the saved replay, and refreshing the browser resets it.
- Merge node-level logs into a packet-level replay.
- Use global replay mode or packet lifecycle mode.
- Adjust playback speed, light/dark UI theme, and visualization quality; the canvas uses a fixed industrial theme.
- Measure distances directly in the 2D view.
- Add independent replay scenery from the **场景** toolbar: shipwrecks, fish schools, submarines, warships, UAVs, large aircraft, coastlines and command posts. Place, rotate, scale, hide, duplicate or locate assets in 2D/3D; drag selected assets in 2D while the scene panel is open. Save and import a separate scene JSON. Scenery never becomes a network node or changes simulation events; route changes preserve the layout, while loading another log clears it.
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
- The experiment page’s **仿真环境** panel lets you browse and select a directory on the server machine or enter its path, remembers it in the current browser, and provides a **预编译** button that configures the checkout when needed and runs `./ns3 build`, with live build progress. **清除构建** runs `./ns3 clean` on the selected checkout. The input placeholder shows the actual server default path. The first entry in a browser page session automatically starts one incremental precompile after a successful directory check. Returning from replay reuses the completed directory check, registered protocols and build status immediately, without new initialization requests. Changing the directory, precompiling manually or clearing the build invalidates that snapshot; refreshing the page starts a new session. After editing external protocol sources, click **预编译** to refresh registration metadata. Requests for the same directory share an active precompile. If a simulation, clean, or another directory’s build is running, the page waits and continues automatically once it finishes; changing the directory or leaving the page cancels that wait. Invalid directories do not start a build; failures remain visible for manual retry. Selecting or importing a different directory only checks its path.
- Selection priority: browser setting → `AQUA_SIM_HOME` → `../aqua-sim-dev` relative to the repository root. Clear the field or use **恢复默认** to restore server defaults. An invalid explicit path produces an error instead of silently selecting another checkout.
- Configuration uses `--disable-werror` so warnings from newer compilers remain visible without becoming fatal errors. Existing checkouts with `NS3_WARNINGS_AS_ERRORS=ON` are reconfigured once, preserving their cached profile and module selection.
- Precompilation and simulation share a server-side lock. Configure and build each have a 15-minute timeout. Precompilation builds the existing ns-3 targets without running a simulation; newly generated experiment code is still compiled when running an experiment.
- Absolute paths, `~/` paths, and paths relative to this repository root are accepted. Browser settings apply to each request; they do not modify the server environment or other browsers.
- When no valid checkout is found, clicking "运行仿真" returns a clear error and all replay features keep working unaffected.

`AQUA_SIM_HOME` is read from the dev server process environment (`server/simulatorConfig.ts`); it is not needed for building or replaying logs. Simulation endpoints are available through `yarn dev`, not through `yarn preview` or a static `dist/` deployment.

## Log Inputs

The app can parse structured JSON and JSON Lines logs. Bundled sample logs are located in `src/assets/`:

- `net_surface_survey.json` (default: surface vessel and underwater moving observation, actual ns-3 trace)
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
- 节点卡片可选择 AUV、ROV、水面船、浮标和水下传感器模型，实验参数及仿真日志保留选择，模型与节点角色和坐标独立。
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

实验页协议库每项右侧的小眼睛可查看当前仿真目录中的 C++ 实现与头文件，支持切换文件和复制。查看为只读操作，无需预编译，也不会应用协议。此功能需使用开发服务或 Go 服务；纯静态部署和 `yarn preview` 不提供本地源码读取接口。

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
- 顶部「新建实验」清空当前实验；右侧「实验文件」统一提供 JSON/代码预览及导入导出，其中「导出参数」下载 `experiment.json`，「导入参数」恢复实验，也兼容以前导出的 v0 规格。新文件使用 editor.version=3 保存完整编辑状态，包括未启用协议的属性、完整坐标及仿真目录；兼容导入旧 v0/v1/v2 文件，并将旧右侧快捷参数迁入左侧对应协议，显式协议属性优先。导入不自动运行或编译。文件校验失败不影响当前草稿。
- aqua-sim-dev 保持为同级独立仓库，无需复制进本项目。目录必须包含可执行的 `ns3` 脚本与 `src/aqua-sim-tg`；首次运行时自动补充 configure，仍需安装本机编译工具链。
- 实验页右侧的「仿真环境」可通过「选择目录」浏览并选用**运行服务的机器上的目录**，也可手动填写路径；设置自动保存在当前浏览器，输入框占位提示显示服务器实际默认路径。当前浏览器页面会话首次进入实验页时会检查成功构建记录；源码、配置、工具链与编译产物均未变化时直接复用，否则目录检查通过后自动增量预编译一次。实验与回放往返立即复用已完成的目录检查、注册协议与构建状态，不重复发送初始化请求。切换目录、手动预编译或清除构建会使前端会话缓存失效；刷新页面重新校验服务端的成功构建记录。外部修改协议源码后，点击「预编译」更新注册信息；同一目录已有预编译时复用其进度和结果；其他构建、清理或仿真任务运行时显示等待，任务结束后自动继续，切换目录或离开页面可取消等待。目录无效不会开始，失败显示原因并可点击「预编译」手动重试。预编译在必要时执行 configure，再执行增量 `./ns3 build`；构建中显示阶段和编译进度，完成后可查看输出。「清除构建」执行 `./ns3 clean` 清除所选目录的构建产物和配置缓存，之后需重新预编译。选择、恢复默认或导入其他目录仍只检查路径。
- 优先级：前端目录 → `AQUA_SIM_HOME` → 仓库根目录的 `../aqua-sim-dev`。清空输入或点击「恢复默认」使用服务器默认值；显式设置的路径无效时直接报错，不静默切换到其他仓库。
- 配置时使用 `--disable-werror`，保留编译警告但不将其升级为错误。已有目录若启用了 `NS3_WARNINGS_AS_ERRORS`，会先重新配置关闭它，保留原有构建模式、模块选择等缓存选项。
- 预编译与仿真共用服务端互斥锁；configure 与 build 各限时 15 分钟。预编译构建已有 ns-3 目标，并编译运行 TypeId 元数据探针（不创建仿真节点）；新生成的实验代码仍会在运行实验时编译。
- 预编译成功后，协议目录按 TypeId 继承关系和构造函数动态列出各层及 Application 类型，并读取继承属性、类型、默认值和读写/构造标记。尚未编译注册的源码、抽象类和辅助类型不作为可选协议。预编译前仅显示层级导航与提示，不显示前端预设协议；新建实验各层为空，预编译成功后由用户分别选择。目录缓存在开发服务器内存中，并随成功构建记录持久化；服务重启后校验源码、配置、工具链和编译产物，未变化时直接恢复目录，否则需重新预编译。
- 「协议属性」展示所选类型及其父类的注册参数。可构造属性统一交给 ns-3 的真实 AttributeChecker 校验，留空使用注册默认值；对象容器、非构造属性和托管连接只读显示，不静默隐藏。新实验不自动填写某个协议的节点数、时隙、首轮延迟或应用时间。具有 Protocol/Remote Socket 配置入口的应用需明确选择目的节点，设备和 Socket 连接由公共装配负责；其他应用不强制目的节点。旧文件的快捷参数、别名与流量预设在导入时兼容转换。
- 点击画布节点，在弹出的节点面板中展开「节点协议属性」下的 PHY / MAC / 路由，即可单独设置该节点的注册属性。左侧仅编辑统一参数。留空或点击「恢复继承」使用统一设置，再回退到注册默认值。节点覆盖随实验 JSON 保存并用于真实仿真，共享信道和传播模型保持统一配置。例如 TDMA 的 `Token` 可逐节点指定（从 0 开始）；不设置时继续由协议按节点地址分配。
- 节点卡片名称旁的小笔可修改名称（备注），保留节点 ID；Enter 或勾号保存，Esc 取消。实验备注随参数文件保存，回放只在编辑预览中改名。X/Y/Z 坐标也在节点卡片编辑，不在右侧重复展示；单节点卡片只修改自身。
- 点击 2D 节点显示并固定小卡片，鼠标经过不弹出；点关闭、按 Esc 或点击卡片外部关闭。实验页卡片中可配置该节点的应用、独立目的节点及发送间隔等属性；应用必须明确选择目的节点。节点参数会随草稿和参数文件保存，统一 PHY/MAC/路由/信道属性仍在侧栏。
- 节点卡片中的「显示传播范围」可逐节点开关，并调节显示半径、淡色填充、距离标签和填充浓度。实验默认跟随所选 PHY 的实际注册 `transRange`，无范围信息时可手动填写显示半径；支持 `500m`、`1.5km`，纯数字按米。此为 XY 平面距离示意，不改仿真参数；实验页将这些显示设置与已完成测距、视角中心、米制比例、画布缩放、节点大小、导出时画布尺寸和吸附开关保存在可选的 `editor.canvas` 中（version=1），导入后恢复。不同窗口尺寸保留相同的视角中心与比例，画布仍适应当前窗口；这部分不参与 ns-3 运行，旧文件缺少该项仍可导入。
- 注册成功表示类型可选择，不表示任意协议组合、Socket 语义或外部资源都可用。需要外部程序、环境文件、设备或不同传输服务的模型仍须具备相应运行条件；平台不按协议名称增加特殊预检或静默修改配置，运行错误统一显示在输出中。
- 所有协议统一优先返回本次生成的 PHY 收发日志，缺失或无发送事件时回退到原生日志。新日志用 `time_precision_us=0.001` 声明纳秒精度，并从所选传播接口读取传播速度；回放不按协议名称选择时间处理路径。通用日志记录实际发射与成功接收，不推测丢包或冲突原因。旧日志导入兼容保持不变。
- 支持绝对路径、`~/` 路径和相对本仓库根目录的路径。前端设置随每次请求传递，不修改服务器环境变量，也不影响其他浏览器。
- 找不到有效目录时，点击「运行仿真」会返回明确错误，其余回放功能不受影响。

`AQUA_SIM_HOME` 从开发服务器进程环境读取（`server/simulatorConfig.ts`）；构建项目或回放日志都不需要它。仿真接口仅在 `yarn dev` 下提供，`yarn preview` 或静态部署 `dist/` 不提供仿真接口。

## 日志输入

已有 ns-3/Aqua-Sim 场景可使用独立 [VisualLogHelper](contrib/visual-logger/README.md)：在 main 配置日志开关、NETWORK/NODE/BOTH 范围及每个节点的 modelType，安装一次后在 Simulator::Destroy 自动输出。逐节点文件通过「导入节点日志」一次合并（最多 64 份、合计 64 MiB）；新 v2 节点日志检查 run_id 和事件归属，旧日志保持兼容。

应用可以解析结构化 JSON 和 JSON Lines 日志。内置示例日志位于 `src/assets/`：

- `net_surface_survey.json`（默认：海面科考船与水下移动观测，真实 ns-3 日志）
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

VBF 路由已从 [spinachAn/aqua-sim-dev](https://github.com/spinachAn/aqua-sim-dev) 引入内置源码包，经预编译动态注册为 `ns3::AquaSimVBF`。参数和来源、移植修复及真实多跳验证见 [VBF 说明](docs/protocols/vbf.md)。

用于教学的 **AquaSim Phy Simple** 继承水下 Phy Cmn，可直接设置 `DataRate`（默认 `10kbps`）和 `RxProcessingDelay`（默认 `0s`）。处理延迟指成功收包后到 MAC 交付的额外时间，范围、传播、噪声、碰撞、半双工和收发能耗沿用原有机制；选协议后在统一 PHY 属性或节点卡片中配置。模型定义与真实仿真验证见 [Simple PHY 说明](docs/protocols/simple-phy.md)。

新仿真会通过公共 PHY/信号缓存事件记录接收开始、实际碰撞与丢弃，回放可显示传播至节点后发生碰撞的过程。已有空接收列表的旧日志需要重新运行才能补齐；显式自定义模型未提供事件时保留成功收发记录，不猜测失败原因。[接收事件与兼容说明](docs/receive-events.md)。

重复事件的间隔与首次启动时间不同：例如 AquaSimTrafficGen 的 `Delay` 是每次产包的间隔（秒），设为 0 会在同一仿真时刻无限产包。平台对所有协议统一检测仿真时间停滞：同一时钟步处理超过 100000 个事件时终止并显示原因；时间推进后计数复位，不自动改写实验参数。

回放在 2D/3D 画布点击节点，在其卡片开启「关注节点」开关，可仅查看该节点的发送事件及接收分支（含失败和碰撞）；日志、统计及 2D/3D 链路同步更新。关闭开关恢复全部，开启另一个节点则切换关注对象。右侧不放节点筛选入口或记录范围解释文字。筛选不改变原始日志、节点位置或播放时间轴。

节点卡片的「模型类型」使用可选字段 `modelType`：`auv`、`rov`、`vessel`、`buoy`、`sensor`。2D 标准/增强视图与 3D 使用同一选择，2D 中显示带材质明暗的工业设备平面模型，下方保留数字编号；3D 使用金属、涂装、橡胶及玻璃材质。收发及碰撞状态通过独立颜色覆盖和进度弧表示，设备涂装保持稳定。新节点默认为 AUV；旧文件没有此字段时沿用旧类型判断。实验中的选择随导出参数及仿真日志保存；回放中也可临时切换外观，换日志时清空临时选择，可通过实验页「从回放导入」保存到实验。模型只影响显示，不改变移动轨迹、传播距离或协议行为。

3D 的「海洋环境」提供起伏海床、明亮砂纹、岩石群、海草、珊瑚、半透明海面、波光、渐变天空、云层和日光；轻雾从约 30 km 开始，远景可见范围扩展至至少 140 km，可随时关闭。海面对应物理 Z=500 m，Z 小于 500 m 在水下；海床基准 Z=-10,000 m，以连续多尺度噪声生成山脊、坡地和弯曲海沟；XYZ 使用一致的米制显示比例，轴刻度显示真实米数。水下额外提供蓝绿水体层次、柔和光束、512 个悬浮微粒和流动海床光斑；越过海面自动关闭水下覆盖，环境动画在暂停回放时仍缓慢流动，隐藏视图暂停。所有效果复用 Babylon 渲染循环。

这些环境几何仅用于观察，不修改 ns-3 的传播模型或水深参数。默认视图覆盖记录中完整的移动范围，播放时不反复缩放。

点击「漫游」后鼠标控制视线，WASD 水平移动、空格上升、Shift 下沉；Esc 释放鼠标并恢复环绕操作。回放播放/暂停使用 P 键，输入表单时不触发。「全屏」可独立使用。2D/3D 画布上的触控板捏合只缩放画布，不缩放网页。3D 左上角「坐标轴」可独立显示/隐藏场景刻度：XY 位于水面，Z 轴从水面向下延伸至海床，标签保留实际坐标和米单位。侧栏输入、失焦和隐藏视图会停止移动，退出后保留观察位置。

节点卡片的「节点协议属性 → 移动模型」从实际注册的 ns-3 MobilityModel 目录选择，属性使用同一动态编辑器。选择保存在可选 `node.mobility.type`，参数唯一存于该节点的 `protocolAttributes[TypeId]`；未选择时保持固定位置，初始位置仍在节点坐标中填写。内置匀速直线模型 `ns3::AquaVisualLinearMobilityModel` 的 `InitialVelocity` 接受 `x:y:z` 速度分量（默认单位 m/s，例如 `3:0:0`）。其他注册移动模型使用各自真实属性，切换移动模型不会改协议栈或安装应用。

运行时通过公共 CourseChange 事件和位置采样记录真实轨迹，2D/3D 共同插值显示，并随航向转动设备。移动实际参与仿真中的距离和传播计算。周期采样默认 100ms，长实验按时长与节点数自适应，采样周期写入日志 `mobility_sample_interval_us`；同速直线段合并，真实转向事件保留。超过 30000 段会明确终止并报告，不截断后假装成功。真实验证脚本：`node scripts/smoke-node-mobility.mjs`（复用现有开发服务）。


### 真实试验画布 GPS 模式

进入真实试验页面，在画布中央点击「选择卫星地图文件」，加载本地卫星影像或地图。加载后可通过「卫星地图设置」更换底图。支持 PNG、JPEG、WebP 栅格 MBTiles，暂不支持 PBF 矢量文件。支持 GB 级文件：通过 SQLite 只读文件接口按需读取数据库页和当前视野的瓦片，不把整份底图装进内存。文件仅在浏览器本地读取，无需地图服务密钥，也不会上传。影像内容、拍摄时间与精度由所选文件决定。

- 右侧属性抽屉底部为 GPS 按钮和坐标信息留出固定空间，抽屉展开时不遮挡入口。文件块缓存限制为 8 MiB，SQLite 页缓存为 8 MiB，解码图像缓存为 64 MiB；取消旧加载或离开页面会释放读取器与图像。
- 滚轮、触控板捏合和「缩放调节」均按底图真实范围与瓦片分辨率缩放，拖动画布不能移到覆盖范围外。缺少低层级总览的文件会限制缩小，以控制读取量；缺失瓦片优先回退已有父级，仍缺失则标出无瓦片区域。
- 坐标以 WGS84 为基准，默认底图中心为实验 XY 原点，X 向东、Y 向北，单位为米。GPS 设置可修改原点经纬度；调整原点会改变节点的地理位置，但不修改 XYZ 数值或仿真配置。鼠标位置和节点卡片显示经纬度。
- 比例尺按当前位置纬度换算真实地面米数，不将 Web Mercator 投影米直接当作地面米。测距、位置设置与吸附使用本地实验三维直线距离；传播范围按米制半径重新投影。大范围地表测地线距离与实验本地直线距离含义不同。
- 真实试验默认启用 GPS。底图文件、原点及地图视角在当前页面会话中保留，暂不写入实验 JSON；整页刷新后需重新选择。导入拓扑不改变地图来源。普通画布视角继续随实验保存。

格式与坐标转换依据：[MBTiles 1.3](https://github.com/mapbox/mbtiles-spec/blob/master/1.3/spec.md)、[PROJ 的地心到本地 ENU 转换说明](https://proj.org/en/stable/operations/conversions/topocentric.html)。


### 刷新与 ns-3 构建复用

刷新实验页面会重新检查仿真目录。若已有成功构建记录，且源码内容、CMake 配置、工具链、已编译库及协议探针均未变化，直接显示「构建未变化，已复用」，不会调用 `./ns3 build` 或重复编译协议探针。该记录保存在开发服务的 `node_modules/.cache/aquasim-build`，浏览器刷新和服务重启后仍需校验才可使用。

第一次建立记录、源码/配置/产物变化、清除构建或记录失效时，仍按原流程增量预编译。失败不会被当作成功缓存；手动「预编译」始终可以重新检查构建。此机制只复用仿真环境，不恢复刷新前的实验草稿、回放或本地底图。


### 仿真试验、真实试验与回放

导航依次为「仿真试验」（`/`）、「真实试验」（`/field`）和「回放」（`/replay`）。两种试验复用编辑器组件，但各自保存节点、协议参数、选择、画布状态、目录偏好和已完成的目录检查；节点大小、吸附和右侧面板宽度也分别保存。回放只通过明确的导入、发送到回放或运行结果交接获取数据，真实试验运行结束后需点击「查看运行回放」，不会自动替换当前回放。

GPS 地图入口迁至真实试验，仿真试验不再显示 GPS 按钮。真实试验首次在画布中央选择本机卫星 MBTiles，加载后自动启用地理坐标。底图文件、原点及地图视角在本次页面会话中独立保存，切换板块、新建或导入拓扑不需要重选底图；整页刷新仍需重新选择。修改地图原点不会改写节点 XYZ。真实试验首次打开只检查仿真目录，不自动构建。

真实试验右下角显示 GPS 定位与 UTC、原子钟实测 UTC、运行服务机器的系统时间；离线或过期读数有明确状态。设备设置连接服务端串口，默认 GPS 9600 8N1、原子钟 57600 8N1，允许修改串口参数和查询间隔。连接和校时均需明确操作，切换板块仅停止页面轮询，不断开现场设备；程序退出或点击断开才释放串口。GPS/原子钟读数不会自动改写地图原点、节点位置或操作系统时间。

Go 单文件版本及 N100 部署步骤见 [standalone/README.md](standalone/README.md)。构建机执行 `./scripts/build-standalone.sh`，N100 只需运行产物；网页、Worker、WASM 和串口后端均内嵌，不需要安装 Node.js、Go 或 Python。原生 ns-3 任意新场景仍依赖预先准备的 ns-3/CMake/C++ 环境，Go 程序不替代 ns-3 算法实现。开发模式将 `/api/field` 转发至 `http://127.0.0.1:8080`，可通过 `FIELD_DEVICE_URL` 调整；仅真实试验页面轮询设备 API。
