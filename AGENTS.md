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
├── components/    # 跨功能域共享的 Vue 组件（NodeCanvas/ExperimentPanel/ProtocolDrawer/SplitPane + useUiTheme）
├── shared/        # 准入标准见下
└── styles/        # 全局 CSS：main.css（令牌/重置）、themes.css（关键帧）、pages/*.css（按域）
```

- **功能域单向依赖**：pages → features → shared；features 之间不互相 import（replay 不依赖 experiment，反之亦然）。跨域需求下沉到 `shared/` 或 props/emit。components/ 可引用 features 的 lib（NodeCanvas → canvas2d/themes 为先例）；features 不反向引用 components（跨域 UI 由 pages 组装）。
- **组件私有样式**写在 SFC `<style scoped>`；只有跨组件的全局规则才进 `src/styles/`。
- 删除/新增全局 CSS 规则时，先用 `grep -r` 确认选择器在全仓库（含模板动态 `:class`、模板字符串拼接）无引用。

## UI 约定（岛屿式布局与设计系统）

- **布局范式**：画布全幅（`.deck-canvas` 绝对铺满 `.deck`），所有面板为浮动岛屿 dock（`.dock` + `.dock-left/.dock-right/.dock-top` 绝对定位，圆角 + 半透明 + backdrop blur）；页面骨架 `.page` = deck + `.statusbar`（mono 字体状态栏）。旧的 `wb*` 三列 grid 外壳已废弃，不得恢复。
- **面板单元（dock-unit）**：侧栏面板与其小耳朵包在一个 `.dock-unit-r`/`.dock-unit-l` 里作为整体开收——收起是整单元 transform 平移到只露出耳朵（`--ear-w`），弹簧曲线 `--ease-spring`，面板与耳朵永远一体，禁止再拆成两个独立定位的元素。单元 `pointer-events: none`，子元素各自恢复，缝隙处事件穿透到画布。
- **画布安全边距**：NodeCanvas 的 `viewPadding` prop（额外 px inset，叠加在 `viewInsetsFor` 基础上）用于让默认视图避开浮动岛屿；值为按面板默认宽度定的**静态常量**，不随面板开收/拖宽变化——面板纯浮在画布上方，开收不得引起画布视图缩放或平移。
- **编辑视图**：进入编辑模式即固定画布范围（包括首次挂载）；添加、删除、拖动节点或修改坐标不触发自动缩放/平移。拖动快照使用当前显示范围；仅点击“回到默认位置”重新适配拓扑。空白或单节点实验默认使用以原点/节点为中心的 4 km 范围，避免退化为 1 m 视图。
- **2D 缩放与工具**：放大上限按实际比例控制（100 m/格，每格 56 px），初始适配和手动复位同样受限，工具栏用线段比例尺标注距离。“缩放调节”按钮带动画向上展开画布/节点两个竖向滑条，面板以尖角连接按钮；节点大小默认 0.7×，已有浏览器自定义值优先；画布缩放与滚轮共用比例限制，节点大小独立调节，点击外部或 Esc 收起。Esc 同时退出测距、放置、框选等工具并清除未完成手势，保留已完成测距和节点位置。测距线及端点绘制在节点下方，避免遮挡编号。节点卡片不使用循环流光效果。
- **节点选中外圈**：选中时只加粗节点原有外圈，不额外绘制选择环；普通左键点击画布空白处取消选中并恢复原线宽，拖动画布和编辑参数保留选中状态。
- **双主题令牌**：`main.css` 定义 dark（默认）/ light 全套令牌，经 `document.documentElement[data-theme]` 切换；`components/useUiTheme.ts` 负责读写与持久化（`aquasim_ui_theme`）。新增颜色一律走令牌，禁止写死色值（canvas 内部绘制颜色由 `features/canvas2d/lib/themes.ts` 主题包管，不受 UI 主题影响）。
- **tailwind 已移除**：样式全部手写令牌 + 按域 CSS，不要重新引入工具类框架。
- **画布主题**：固定为工业监控（`industrial-scada`），2D/3D 共用 `shared/constants.ts` 的 `CANVAS_THEME_KEY` 传入 NodeCanvas/NodeScene3D；THEME_PROFILES / THEME_3D 各只保留这一套。主题选择器与 `aquasim_canvas_theme` 持久化已移除。
- **SplitPane**：右侧岛屿宽度容器（拖拽/双击复位/键盘方向键/localStorage），实验页 `aquasim_split_inspect`、回放页 `aquasim_split_log`；localStorage key 统一登记在 `shared/constants.ts` 的 `LOCAL_STORAGE_KEYS`（`aquasim_*` 前缀）。
- **面板小耳朵**：边缘竖排拉环 `.panel-ear`（app.css，两页共用），作为 `.dock-unit` 内的 flex 项贴在面板边缘，同背景/模糊、无独立阴影；左侧协议目录用镜像变体 `.ear-left`。不再在工具栏放开收按钮。
- **动效约定**：时长/缓动走 main.css 令牌（`--dur-fast/--dur-med/--ease-out/--ease-in`），位移类（dock-unit、控制台高度）用 `--ease-spring`；路由切换用 `page` 交叉淡入（旧页绝对定位覆盖淡出，新页轻微上浮，不用 out-in）；协议 flyout 用 `flyout`，控制台用 `console`（基础定位含 translateX(-50%)，过渡帧里必须保留）；拖拽调宽/调高的容器带 `.dragging` 类并关闭对应 transition。新增动效不得脱离这套时长与缓动。
- **z-index 刻度**：1-2 画布内图层；10 浮动 dock 与画布工具栏；30 弹层菜单；80 全屏弹层。
- **表单标签规范**：中文主标签 + mono 参数名辅标（`.field-param`），时间类参数接受带单位字符串（如 `30s`）；`txPower` 输入框已移除（生成器从未消费该字段，spec JSON 字段保留勿删）。
- **2D 节点卡片**：仅点击节点显示并固定，鼠标经过不弹出；关闭按钮、Esc、卡片外点击关闭。拖动和测距不打开卡片。`useNodeCard` 管理交互，`NodeCanvas` 的 `node-details` slot 由实验页注入节点应用编辑器；不在 canvas2d 内依赖 experiment。节点应用及其参数放卡片，统一 PHY/MAC/路由/信道属性留侧栏。

- **左侧协议抽屉**：`ProtocolDrawer` 上半部为“协议库”，下半部为“已应用协议”；同一 dock 外壳和拉环整体开收，两部分内容各自滚动。已应用协议各层默认折叠，展开后直接编辑统一 PHY/MAC/路由/信道属性；应用参数仍在节点卡片编辑。协议栈由实验页通过 props 传入，属性编辑器通过 slot 注入，样式留在组件内；右侧保留实验设置，不重复展示协议属性。

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
- 仿真目录优先级：前端设置（`aquasim_aqua_sim_home`，当前浏览器保存、随请求传递）→ `AQUA_SIM_HOME` → 同级 `../aqua-sim-dev`；显式目录无效时直接报错，不静默回退。路径基于服务器文件系统，相对路径基于本仓库根目录；检查接口只验证 `ns3` 可执行文件与 `src/aqua-sim-tg`，不保证构建成功。未 configure 时由 runner 自动配置。
- `/api/run`、`/api/simulator/build`、`/api/simulator/check` 与只读目录浏览 `/api/simulator/directories` 仅挂载于 Vite dev；preview / 静态部署不提供仿真后端。
- 「预编译」调用 `/api/simulator/build`：必要时 configure，再执行 `./ns3 build`；预编译和仿真共用 runner 互斥锁。配置统一带 `--disable-werror`；已有缓存开启 `NS3_WARNINGS_AS_ERRORS` 时只重配该选项，保留构建模式与模块配置，避免新编译器的普通警告导致失败。打开页面/选择目录仅检查路径，不自动编译。
- 预编译完成后通过 `server/templates/typeidCatalog.cc` 探针枚举实际注册、可构造的 Aqua-Sim 各层类型及继承属性；`typeIdCatalog.ts` 的静态表仅提供标签与初始化占位，不作为运行白名单。动态目录按仿真路径与 Aqua-Sim 库签名缓存在服务端内存中，页面在加载目录后才允许选协议、运行。新增已注册协议无需追加前端白名单；具有特殊构造或外部依赖的协议仍需相应安装适配。
- `generateScratch.ts` 按实际选择的 PHY/MAC/路由/信道/传播模型和节点应用生成代码；协议属性覆盖快捷表单参数，Socket/设备连接由生成器管理。`protocolRequirements.ts` 在运行前检查 Bellhop 文件与 Modem 串口。无原生日志的协议使用 `replayTrace.ts` 的 PHY 成功收发记录，不改变既有日志解析语义。
- 应用只在节点卡片配置：源为应用所在节点，`appDestination` 必须明确选择；`appAttrs` 只作用于该节点，启动默认 0s、停止默认仿真结束，其余使用协议注册默认值（OnOff 的 Nsend 自动匹配节点数量）。取消全局流量表单、全局应用层展示和切换 MAC 时隐式安装应用；新规格 traffic 固定 none。旧规格/API 流量预设保留兼容。
- 实验页首次加载创建空白草稿；`features/experiment/composables/experimentDraft.ts` 在当前页面会话内保留拓扑、表单、协议属性与选中节点，路由切换不重置，刷新页面重新开始。无需 KeepAlive，画布随路由卸载。实验 JSON 仍使用 v0 schema，附加 `editor.version=2` 保存完整编辑状态；导入兼容 version=1 和不含 editor 的旧规格，并将全局流量预设、隐式应用目的地址与默认属性迁移到节点，先完整校验再原子替换。读取协议目录不得静默覆盖草稿中的未知协议选择。
- build 的 chunk size 警告（rolldown，>500 kB）为现状，不阻断；是否 code-split 属产品决策。
- 日志格式与解析语义冻结：别名兼容逻辑保留，只收敛写法，不改语义。
- 实验“发送到回放”只预览拓扑，必须通过 `applyTopology` 同时清空旧包记录、移动轨迹、元数据与播放进度，并标记“实验拓扑（尚未仿真）”；不得只替换节点而沿用默认示例/旧日志。真实仿真日志优先于待预览拓扑，示例切换则完整替换对应节点和记录。
- Out of scope（重构计划明确不做）：不引入 Pinia / 测试框架 / UI 组件库 / 图标库；不改 Babylon 大版本。

## vue-tsc 已知坑（踩过）

- `Object.freeze([...])` 赋给显式数组类型报 TS4104 —— 去掉 freeze。
- 联合类型用 `||` 右操作数会并回已排除分支 —— 用类型守卫函数（见 `experimentSpec.ts` 的 `isActiveTraffic` 模式）。
- 模板里可选属性（如 `Point3D` 的 `z?`）要 `?? 0`。
- `yarn typecheck` 只查 `src/**`；server 改动另需 build 验证。
