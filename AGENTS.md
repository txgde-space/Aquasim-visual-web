# AGENTS.md

本文件记录仓库约定，供后续开发会话（人或 AI）遵守。现状描述与代码不符时，应核实代码并更新描述；用户明确提出的开发约束必须遵守，现有代码不符合约束时属于实现偏差，不能以现状为由忽略约束。

## 协议与功能扩展原则（强制）

- **统一接入、统一使用**：添加协议或功能时，统一使用协议发现、参数展示、配置保存、校验、代码生成和运行流程。协议自身的算法可以不同，平台接入与交互逻辑必须通用，不得为了某个协议单独优化、增加专用流程或按协议名称 / TypeId 写特殊分支。
- **动态读取接口与参数**：以实际注册接口和运行时元数据为依据，动态读取协议、继承关系、可配置参数及其类型、默认值和可提供的校验信息。不得用静态参数表、协议白名单或猜测替代真实接口；静态中文标签只能辅助展示，不能决定协议能否使用或参数如何执行。
- **各层独立选择**：选择 PHY、MAC、路由、Channel 或传播模型时，只修改用户选择的项目，不得针对某个协议隐式绑定或自动替换其他层，也不得顺带改写参数、安装应用。公共接口连接由统一装配逻辑处理；兼容性依据实际接口 / 元数据统一校验，不兼容时提示具体原因，不擅自改配置。
- **参数规则统一**：协议参数统一通过左侧协议属性编辑，节点应用参数继续使用同一属性机制在节点卡片编辑；右侧只放全局仿真设置。默认值、可编辑项和约束来自协议注册信息，不为个别协议硬编码默认值、范围、隐藏项或自动填写规则。导入、导出与运行使用同一份参数，不另设隐藏覆盖来源。
- **能力不足时扩展公共机制**：现有接口不能表达新协议所需能力时，扩展共用接口、元数据和通用装配逻辑，使同类协议均可使用；不得通过单协议特判绕过缺失能力，也不得静默忽略不支持的参数。
- **旧文件兼容隔离**：历史别名、全局流量预设、快捷参数及旧默认值只在 `legacyExperiment.ts` 中转换，当前编辑与运行不再沿用历史联动或自动填参。兼容迁移不得成为新协议接入的专属分支。

## 验证门槛

- 任何提交前必须 `yarn typecheck && yarn build` 全绿；红灯不进主干。
- `yarn check:regressions` 使用现有 Vite/Vue 与 Node assert 检查旧日志兼容、大日志边界、实验文件/校验、画布状态及异步请求，不引入测试框架、不监听端口。相关行为改动必须通过该检查，并按场景补手动验证。纯函数层（`features/replay/lib`、`features/canvas2d/lib/coordinate.ts`、`features/experiment/lib`）保持无副作用。
- `yarn typecheck` 同时执行 `typecheck:app`（vue-tsc，`src/**`）与 `typecheck:server`（tsc，`tsconfig.node.json`）。服务端改动仍需 `yarn build` + 手动冒烟 `/api/run`，类型检查不替代真实仿真验证。
- dev 冒烟约定：`yarn dev --port <port> --strictPort` 后台启动，curl 验证后必须 kill，不得留下运行中的 dev server。
- 若用户已有 dev 服务，修复后也要在该服务验证，不能只测新启动的隔离实例。出现“磁盘源码正确、浏览器仍报旧代码异常”时，对比服务返回模块的 sourcemap `sourcesContent` 与磁盘；确认陈旧后触发对应文件的变更通知，再刷新测试页核验。并行 dev 实例使用独立 `cacheDir`，不得共用依赖预构建缓存。
- 浏览器开发服务使用 `node_modules/.vite/aquasim-web` 缓存，并在启动时预构建 Babylon 与高亮 Worker 的依赖；SSR/回归工具使用独立临时缓存，不得删除正在运行的服务缓存。

## 目录约定与功能域边界

```
src/
├── pages/         # 路由页面：只做状态持有与组装（胶水层），不写业务逻辑
├── features/
│   ├── canvas2d/  # 2D Canvas 渲染：draw/* 纯绘制函数 + composables + themes
│   ├── scene3d/   # Babylon.js：NodeScene3D.vue + 场景库（themes3d/factories/worldAxes/useBabylonScene）
│   ├── replay/    # 回放：lib/ 纯函数（解析/规范化/合并/几何）+ composables + 面板组件
│   └── experiment/# 实验：lib/（spec/catalog/scratch 生成）+ useTopologyEditor/useRunExperiment
├── components/    # 跨功能域共享的 Vue 组件（NodeCanvas/ExperimentPanel/ProtocolDrawer/SplitPane + useUiTheme）
├── state/         # 应用级跨页响应式状态（replaySession），只由页面组装层消费
├── shared/        # 准入标准见下
└── styles/        # 全局 CSS：main.css（令牌/重置）、themes.css（关键帧）、pages/*.css（按域）
```

- **功能域单向依赖**：pages → features → shared；features 之间不互相 import（replay 不依赖 experiment，反之亦然）。跨域需求下沉到 `shared/` 或 props/emit。components/ 可引用 features 的 lib（NodeCanvas → canvas2d/themes 为先例）；features 不反向引用 components（跨域 UI 由 pages 组装）。
- 仿真 HTTP 请求统一经过 `features/experiment/api/simulator.ts`；`lib/` 保持纯逻辑。切换目录或卸载页面时忽略旧请求结果并停止轮询，离开实验页不得被迟到的运行结果自动导航。终止前端监听不会取消服务端任务，服务端仍受互斥锁和超时管理。
- **组件私有样式**写在 SFC `<style scoped>`；只有跨组件的全局规则才进 `src/styles/`。
- 删除/新增全局 CSS 规则时，先用 `grep -r` 确认选择器在全仓库（含模板动态 `:class`、模板字符串拼接）无引用。

## UI 约定（岛屿式布局与设计系统）

- **布局范式**：画布全幅（`.deck-canvas` 绝对铺满 `.deck`），所有面板为浮动岛屿 dock（`.dock` + `.dock-left/.dock-right/.dock-top` 绝对定位，圆角 + 半透明 + backdrop blur）；页面骨架 `.page` = deck + `.statusbar`（mono 字体状态栏）。旧的 `wb*` 三列 grid 外壳已废弃，不得恢复。
- **面板单元（dock-unit）**：侧栏面板与其小耳朵包在一个 `.dock-unit-r`/`.dock-unit-l` 里作为整体开收——收起是整单元 transform 平移到只露出耳朵（`--ear-w`），弹簧曲线 `--ease-spring`，面板与耳朵永远一体，禁止再拆成两个独立定位的元素。单元 `pointer-events: none`，子元素各自恢复，缝隙处事件穿透到画布。
- **画布安全边距**：NodeCanvas 的 `viewPadding` prop（额外 px inset，叠加在 `viewInsetsFor` 基础上）用于让默认视图避开浮动岛屿；值为按面板默认宽度定的**静态常量**，不随面板开收/拖宽变化——面板纯浮在画布上方，开收不得引起画布视图缩放或平移。
- **编辑视图**：进入编辑模式即固定画布范围（包括首次挂载）；添加、删除、拖动节点或修改坐标不触发自动缩放/平移。拖动快照使用当前显示范围；仅点击“回到默认位置”重新适配拓扑。空白或单节点实验默认使用以原点/节点为中心的 4 km 范围，避免退化为 1 m 视图。
- **2D 缩放与工具**：放大上限按实际比例控制（100 m/格，每格 56 px），初始适配和手动复位同样受限，工具栏用线段比例尺标注距离。“缩放调节”按钮带动画向上展开画布/节点两个竖向滑条，面板以尖角连接按钮；节点大小默认 0.7×，已有浏览器自定义值优先；画布缩放与滚轮共用比例限制，节点大小独立调节，点击外部或 Esc 收起。实验页空白处拖动平移、Shift/Ctrl/⌘ 拖动框选，已有节点可直接拖动；右键画布打开坐标菜单，填写 X/Y/Z 后添加节点。Esc 退出测距、框选和右键菜单并清除未完成手势，保留已完成测距和节点位置。测距线及端点绘制在节点下方，避免遮挡编号。节点卡片不使用循环流光效果。
- **节点选中外圈**：选中时只加粗节点原有外圈，不额外绘制选择环；普通左键点击画布空白处取消选中并恢复原线宽，拖动画布和编辑参数保留选中状态。
- **编辑多选**：实验页与回放编辑页统一支持 Shift 点选追加/取消单个节点、Shift 空白拖框追加选择；Shift 空白单击保留当前选择。Ctrl/⌘ 点选兼容切换选择，单独 Ctrl/⌘ 拖框替换当前集合。拖动已选节点移动整个选中组，点选微小抖动不改变坐标；普通空白单击清空选择，Esc 取消未完成手势但保留选择与已应用位置。回放多选时隐藏单点坐标表单，“恢复选中”作用于整个集合。
- **移动吸附**：实验页与回放编辑页共用网格、节点水平/垂直对齐和同排等间距吸附（中点及两端延伸），工具栏“吸附”可独立开关，设置保存于 `aquasim_node_snapping`。网格步长与当前画面一致，接近目标 4 px 内才触发；多选组只施加统一位移，保留相对位置与 Z。参考点排除选中组，候选在拖动开始时建立数值快照；每次从原始拖动位置计算，不累积吸附误差。按住 Alt 临时自由移动，松开即时恢复；松手、Esc、删除、退出编辑或隐藏画布清除辅助线与拖动状态。辅助线使用画布主题配色，绘制在节点下方。
- **吸附距离标注**：对齐线按同轴参考节点与移动组节点的实际 XY 位置分段，显示相邻间距；等距线分别标注两段间距，重叠位置不生成零长分段。网格线标注网格步长，不使用装饰线长作为距离。统一使用 m / km（最多两位小数），缩放不改变真实间距，标签避让端点与其他标签。
- **节点删除快捷键**：实验页与回放编辑页支持 Delete / Backspace 删除单个或多个选中节点；删除后清空选择，不自动选中其他节点。输入框、可编辑内容、弹窗、输入法组合输入、按键重复及 Ctrl/⌘/Alt 组合不触发删除，隐藏画布和普通回放不响应。删除前结束未完成手势并关闭节点卡片。回放删除仅影响编辑预览，同步排除已删除发送端及接收端的预览记录，原始日志和轨迹保留；“恢复全部”或退出编辑恢复节点。
- **Esc 退出**：测距、缩放调节、框选、拖动和右键坐标菜单响应 Esc，保留已完成测距和节点位置；焦点在画布工具内部时退出后回到画布，侧栏输入不被抢焦点。2D/3D 节点详情可用 Esc 关闭；隐藏视图、输入法组合输入和已被弹层处理的按键不响应。代码弹窗优先关闭自身，保留底层工具状态。
- **3D 视角**：保留鼠标拖动环绕、滚轮缩放和中键平移；点击 3D 画布聚焦后，WASD 按视角在水平面移动，Q/E 升降、Shift 加速。视角平移不改写拓扑中心，右上角轴向控件可重置；2D 或表单获得焦点时不响应这些移动键。
- **3D 加载**：`AsyncNodeScene3D` 保留懒加载；模块请求失败、20 秒超时或场景初始化/绘制异常显示错误与重试入口，不得无限显示加载动画。重试保留回放状态；刷新页面会重置回放并需要重新导入日志，必须明确提示。
- **渲染状态**：隐藏的 2D/3D 视图暂停数据深监听与绘制排帧，恢复时同步最新数据并保留视角。3D 选中按节点 ID 查当前对象，包链路按发送事件 `eventId` 区分，不能只用逻辑包 ID 合并多跳/重传。
- **双主题令牌**：`main.css` 定义 dark（默认）/ light 全套令牌，经 `document.documentElement[data-theme]` 切换；`components/useUiTheme.ts` 负责读写与持久化（`aquasim_ui_theme`）。新增颜色一律走令牌，禁止写死色值（canvas 内部绘制颜色由 `features/canvas2d/lib/themes.ts` 主题包管，不受 UI 主题影响）。
- **tailwind 已移除**：样式全部手写令牌 + 按域 CSS，不要重新引入工具类框架。
- **画布主题**：固定为工业监控（`industrial-scada`），2D/3D 共用 `shared/constants.ts` 的 `CANVAS_THEME_KEY` 传入 NodeCanvas/NodeScene3D；THEME_PROFILES / THEME_3D 各只保留这一套。主题选择器与 `aquasim_canvas_theme` 持久化已移除。
- **SplitPane**：右侧岛屿宽度容器（拖拽/双击复位/键盘方向键/localStorage），实验页 `aquasim_split_inspect`、回放页 `aquasim_split_log`；localStorage key 统一登记在 `shared/constants.ts` 的 `LOCAL_STORAGE_KEYS`（`aquasim_*` 前缀）。
- **面板小耳朵**：边缘竖排拉环 `.panel-ear`（app.css，两页共用），作为 `.dock-unit` 内的 flex 项贴在面板边缘，同背景/模糊、无独立阴影；左侧协议目录用镜像变体 `.ear-left`。不再在工具栏放开收按钮。
- **动效约定**：时长/缓动走 main.css 令牌（`--dur-fast/--dur-med/--ease-out/--ease-in`），位移类（dock-unit、控制台高度）用 `--ease-spring`；路由切换用 `page` 交叉淡入（旧页绝对定位覆盖淡出，新页轻微上浮，不用 out-in）；协议 flyout 用 `flyout`，控制台用 `console`（基础定位含 translateX(-50%)，过渡帧里必须保留）；拖拽调宽/调高的容器带 `.dragging` 类并关闭对应 transition。新增动效不得脱离这套时长与缓动。
- **z-index 刻度**：1-2 画布内图层；10 浮动 dock 与画布工具栏；30 弹层菜单；80 全屏弹层。
- **表单标签规范**：中文主标签 + mono 参数名辅标（`.field-param`），时间类参数接受带单位字符串（如 `30s`）；`txPower` 输入框已移除（生成器从未消费该字段，spec JSON 字段保留勿删）。
- **2D 节点卡片**：仅点击节点显示并固定，鼠标经过不弹出；关闭按钮、Esc、卡片外点击关闭。拖动和测距不打开卡片。`useNodeCard` 管理交互，`NodeCanvas` 的 `node-details` slot 由实验页注入节点应用编辑器；不在 canvas2d 内依赖 experiment。节点应用及其参数放卡片，统一 PHY/MAC/路由/信道属性留侧栏。

- **左侧协议抽屉**：`ProtocolDrawer` 上半部为“协议库”，下半部为“已应用协议”；协议库从上到下固定为应用层 → 路由层 → MAC 层 → 物理层 → 信道，由 `orderCatalogLayers` 统一排序动态目录与占位目录。同一 dock 外壳和拉环整体开收，两部分内容各自滚动。已应用协议各层默认折叠，展开后直接编辑统一 PHY/MAC/路由/信道及传播属性；应用参数仍在节点卡片编辑。协议栈由实验页通过 props 传入，属性编辑器通过 slot 注入，样式留在组件内；右侧保留实验设置，不重复展示协议属性。
- **协议源码**：协议库小眼睛是独立查看按钮，不触发应用协议或拖拽；无需预编译即可查看。实验页组装只读源码弹窗，按当前仿真目录和 TypeId 读取关联实现/头文件，支持切换、复制、关闭与重试。`/api/simulator/source` 仅限 Vite dev，不执行编译，不允许读取协议模块目录之外或非关联文件。内置源码包登记在 `builtinProtocols.ts`，按源码实际注册 TypeId 查找；只返回登记的常量源码，不增加文件系统读取入口或按协议名写白名单。
- **代码高亮**：实验 JSON、生成的 C++ 和协议实现/头文件统一使用 `HighlightedCode`，显式指定语言；仅在打开查看器时由 Worker 高亮，切换内容或关闭时取消旧任务。颜色使用双主题令牌，复制始终使用原始文本；失败或超时仍显示可选择的原文。

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

## 已知风险与实现现状

- **`allowedHosts: true`**（`vite.config.js`，dev 与 preview 各一处）：为 LAN 演示功能保留（README 宣称 `yarn dev:public`）。后果：任何能访问该端口的设备都可加载页面并触发 `/api/run` 在本机执行仿真。请勿在不可信网络环境中使用 `dev:public` / `preview --host`。
- 仿真目录优先级：前端设置（`aquasim_aqua_sim_home`，当前浏览器保存、随请求传递）→ `AQUA_SIM_HOME` → 同级 `../aqua-sim-dev`；显式目录无效时直接报错，不静默回退。路径基于服务器文件系统，相对路径基于本仓库根目录；检查接口只验证 `ns3` 可执行文件与 `src/aqua-sim-tg`，不保证构建成功。未 configure 时由 runner 自动配置。
- `/api/run`、`/api/simulator/build`、`/api/simulator/build-progress`、`/api/simulator/clean`、`/api/simulator/check` 与只读目录浏览 `/api/simulator/directories` 仅挂载于 Vite dev；preview / 静态部署不提供仿真后端。
- 「预编译」调用 `/api/simulator/build`：必要时 configure，再执行 `./ns3 build`；`build-progress` 返回当前阶段及 Ninja `[已完成/总任务]` 进度。配置与协议目录阶段显示不定进度。「清除构建」调用该目录的 `./ns3 clean`，清除构建产物与配置缓存，并使已缓存的协议目录失效。预编译、清除构建和仿真共用 runner 互斥锁；同一真实目录的并发预编译复用正在执行的任务和结果（含配置及协议目录阶段）。其他冲突返回 `409 + SIMULATOR_BUSY`，预编译前端只查询任务状态，空闲后再提交；等待时可切目录或离开页面取消，不向服务端排入迟到任务。`build-progress` 同时返回全局活动任务，历史构建进度不代表当前请求成功；进度请求有超时，等待中连续获取状态失败显示错误并允许手动重试。配置统一带 `--disable-werror`；已有缓存开启 `NS3_WARNINGS_AS_ERRORS` 时只重配该选项，保留构建模式与模块配置，避免新编译器的普通警告导致失败。进入实验页时，初次目录检查成功后自动发起一次增量预编译（已有协议目录也执行）；无效目录不启动，失败不循环重试，可手动重试。选择、恢复默认或导入其他目录仍只检查路径；切换目录或卸载时忽略旧检查和构建结果；初次检查返回前的手动编译/清除会取消该次自动触发。
- 预编译完成后通过 `server/templates/typeidCatalog.cc` 探针枚举实际注册、可构造的 Aqua-Sim 各层类型及继承属性；`typeIdCatalog.ts` 的静态表仅提供标签与初始化占位，不作为运行白名单。动态目录按仿真路径与 Aqua-Sim 库签名缓存在服务端内存中，页面在加载目录后才允许选协议、运行。新增已注册协议无需追加前端白名单；特殊构造或外部依赖应通过扩展共用接口与元数据表达，并由统一装配 / 校验流程处理，不增加按协议名称硬编码的安装分支。
- **理想陆地对比**：`terrestrialRadio.ts` 提供随目录探针和实验 scratch 编译的 Radio PHY、Channel、Propagation，不修改外部仿真源码。三者与其他模型均独立选择，传播模型正常显示，不自动配套或改写其他层。Radio PHY 的 DataRate 默认 1 Mbps，Radio Propagation 固定速度 299792458 m/s，使用发送端实际 transRange；范围内理想传播、半双工与重叠碰撞，无衰减/随机误码/能耗。协议算法由模型实现，属性展示和配置与其他注册类型完全共用；MAC 原有时隙/保护间隔保持所设值。不同接口组合可选择，不表示其物理假设必然合理。
- `generateScratch.ts` 按实际选择的 PHY/MAC/路由/信道/传播模型和节点应用生成代码；新草稿协议覆盖为空，所有属性留空使用实际注册默认值。旧 API 的 stack.attrs 仍兼容，显式 protocolAttributes 优先。统一 ObjectFactory 路径使用真实 AttributeChecker 转换/检查配置，再由公共设备接口装配；不依赖 AquaSimHelper 隐藏的 PHY 参数覆盖。属性按注册标记展示，不支持编辑的对象容器、非构造属性及托管连接只读可见，已有无效覆盖可清除。外部资源或应用所需的额外运行能力无法由 TypeId 属性完整证明，注册可选不代表任意组合都能运行；错误通过统一运行输出报告，不恢复 Bellhop/Modem 等按名字的预检。
- 应用只在节点卡片配置：源为应用所在节点，`appAttrs` 只作用于该节点，所有应用时间和其他参数均使用各自注册默认值或用户显式设置。Protocol:TypeIdValue 与 Remote:AddressValue 表达公共 Socket 配置入口，此类应用要求明确选择 appDestination，并由统一 Socket 装配连接；仅字段形状不保证应用接受 AquaSim 的 RAW Socket 语义。其他 Application 通过同一工厂安装，不强制目的地址。无隐式 Nsend、NodeCount、stopSend 覆盖，无全局应用表单或切 MAC 自动安装应用；新规格 traffic 固定 none，旧预设仅经隔离兼容入口转换。
- 实验页首次加载创建空白草稿；`features/experiment/composables/experimentDraft.ts` 在当前页面会话内保留拓扑、表单、协议属性与选中节点，路由切换不重置，刷新页面重新开始。无需 KeepAlive，画布随路由卸载。实验 JSON 仍使用 v0 schema，附加 `editor.version=3` 保存完整编辑状态；导入兼容 version=1、version=2 和不含 editor 的旧规格。旧 TDMA/Swarm/PHY 快捷值及环境距离迁入各 TypeId 的协议属性，显式属性优先；v0/v1 全局流量预设、隐式应用目的地址与默认属性迁移到节点，v2/v3 不重复迁移应用。先完整校验再原子替换，清空的属性与暂时无效的编辑输入可保存。读取协议目录不得静默覆盖草稿中的未知协议选择。
- build 的 chunk size 警告（rolldown，>500 kB）为现状，不阻断；是否 code-split 属产品决策。
- 新仿真统一优先返回 `replayTrace.ts` 的 PHY 成功收发日志，原生日志作为通用日志缺失、无有效内容或无发送事件时的回退；不按协议名切换日志路径。新日志声明 `time_precision_us=0.001`，回放按精度元数据选择小数微秒逻辑；旧 Radio medium 标记仅作历史兼容。传播速度从所选传播接口的 PDelay 查询，用于恒速编辑预览；复杂环境模型的真实事件时刻仍以原始日志为准。通用日志按每次 Tx 的 PacketTag 标识关联 Rx，避免同 UID 的转发/重传错连；不推测丢包/碰撞原因，回放面板显示此记录范围。
- 日志格式与解析语义冻结：别名兼容逻辑保留，只收敛写法，不改语义。
- 回放必须保留日志和实验拓扑的真实米制坐标，不通过修改节点坐标扩大间距；显示适配仅在画布投影/相机层处理。`scripts/regressions/replay-baseline.json` 固定现有八份样例的解析与合并语义。
- 回放每帧只更新时间相关状态：包标签、接收结果和生命周期分组不依赖播放时钟；无移动记录时保持拓扑引用稳定。全局日志内容由 Vue 缓存，`usePacketListProgress` 独占进度条 transform 与活动行 class 的差分更新，避免重新引入整表逐帧渲染；进度条用 transform 而非 width 动画，避免触发布局。超过 300 条记录时按可变行高渲染可视窗口，保留滚动、时间定位与面板变宽后的锚点。收起面板停止进度更新，展开时完整同步。2D/3D 高频输入按引用监听，节点坐标等绘制字段单独跟踪，3D 链路线顶点仅端点变化时更新。
- 播放时钟已由 RAF 驱动：2D 在时钟对应的 Vue post-flush 中立即绘制并取消待绘 RAF，不能再串联一层 RAF，否则可能隔帧绘制；指针/缩放仍合并到 RAF。3D 由 Babylon 每次 render 前消费 dirty 状态，不另建刷新 RAF。性能验收同时统计浏览器 RAF 与实际画布绘制/场景刷新次数，并记录浏览器渲染配置，不能将强制 SwiftShader 的结果混作默认配置帧率。
- 实验编辑与运行统一最多 64 个节点，编号为 1–65534。未知协议选择原样保留，运行时报未注册，不静默替换。无效的非空时间参数明确报错；可选应用时间留空仍使用默认值。草稿导出保留暂时无效的编辑输入，不以运行校验阻止保存。
- 实验“发送到回放”只预览拓扑，必须通过 `applyTopology` 同时清空旧包记录、移动轨迹、元数据与播放进度，并标记“实验拓扑（尚未仿真）”；不得只替换节点而沿用默认示例/旧日志。真实仿真日志优先于待预览拓扑，示例切换则完整替换对应节点和记录。
- Out of scope（重构计划明确不做）：不引入 Pinia / 测试框架 / UI 组件库 / 图标库；不改 Babylon 大版本。

## vue-tsc 已知坑（踩过）

- `Object.freeze([...])` 赋给显式数组类型报 TS4104 —— 去掉 freeze。
- 联合类型用 `||` 右操作数会并回已排除分支 —— 用类型守卫函数（见 `experimentSpec.ts` 的 `isActiveTraffic` 模式）。
- 模板里可选属性（如 `Point3D` 的 `z?`）要 `?? 0`。
- 前后端类型检查分开配置；server 改动除 `yarn typecheck` 外仍需 build 和接口冒烟。
