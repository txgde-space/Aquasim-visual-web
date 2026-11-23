# visual-logger

提供 ns-3 Helper 模块：在 scratch 的 main 中配置开关、采集范围和节点模型类型，安装一次，即可在 Simulator::Destroy() 时自动生成全局或逐节点日志。目标机器不需要 Web、Node.js 或 Yarn。

发布包为 `visual-logger.zip`，解压后只有一个 `visual-logger/` 根目录；将该目录放入 ns-3 的 `contrib/`。随包提供独立的 `visual-logger.zip.sha256` 校验文件。

采集范围为 NETWORK、NODE、ALL。旧实现位于 aqua-sim-dev 的 `origin/feature/replay`（提交 `3690cc1`），不在本次两个已构建工作副本的当前分支中；新包通过公开 trace 适配，避免依赖旧分支向 PHY/Channel/缓存注入的 SetReplayLogger 私有接口。

**通用的是日志记录接口和格式，不是所有 Aqua-Sim 分支的内部 API。** 核心只依赖 ns-3 的 core、network、mobility；附带的 Aqua-Sim 适配器针对下述接口。未知分支先检查接口，不能承诺所有版本直接编译。组件不选择或替换已有 PHY、MAC、路由、传播模型、应用或缓存。

使用 C++17 或目标 ns-3 要求的更高标准；本次实测使用 ns-3.46.1 / C++23。旧工程还需核对编译标准与 ns-3 Callback/Tag API，不能仅通过更改模块头文件名完成兼容。

## 目录结构

```text
visual-logger/
├── CMakeLists.txt                 # ns-3 contrib 构建入口
├── README.md                     # 安装与快速开始
├── helper/                       # 公共 VisualLogHelper 接口
├── model/                        # 记录器与共用事件序列化实现
│   └── detail/                   # 自动生成的内部实现
├── adapters/                     # Aqua-Sim 接口与可选缓存观察层
├── examples/helper-setup.cc.inc   # 可插入已有 main 的配置片段
├── docs/porting.md                # 分支适配、回调契约和能力边界
├── docs/verification.md           # 验证环境与结果
└── tests/                        # 核心、真实收发与 Helper 验证场景
```

公共入口为 `ns3/visual-log-helper.h`，类名为 `ns3::VisualLogHelper`，范围枚举为 `ns3::VisualLogScope`。底层 model/adapters 仅供移植使用，不由 CMake 发布为公共头文件。

## 推荐用法：一次安装，main 中配置 Helper

将本目录完整放到 `ns-3/contrib/visual-logger/`。在目标 ns-3 根目录按其正常构建流程重新 configure/build，例如 CMake 版：

```bash
./ns3 configure -- -DVISUAL_LOGGER_AQUASIM_MODULE=aqua-sim-tg
./ns3 build
```

`aqua-sim-tg` 换成目标项目实际模块名（如 `aqua-sim-ng`），需要启用它以及 core/network/mobility/visual-logger。如果原工程限定了 `--enable-modules`，把新模块加到原列表；不要清空原配置。旧 waf 工程没有本包的 CMake 自动集成，需要在其 wscript 中登记 helper 的一个 `.cc` 和公共 `.h` 及依赖。

scratch 顶部：

```cpp
#include "ns3/visual-log-helper.h"
```

在场景现有的 `CommandLine cmd` 上注册每次运行的可选参数，放在 `cmd.Parse(argc, argv)` 之前：

```cpp
std::string runId;
cmd.AddValue("runId", "Replay run ID (random when omitted)", runId);
```

在 main 中，节点/设备/地址/初始坐标已经创建好、Run 之前：

```cpp
using namespace ns3;
VisualLogHelper log;
log.SetEnabled(true);                       // false 完全关闭，不创建文件/采样/Tag
log.SetLogScope(VisualLogScope::NODE);   // 每个节点一个文件
log.SetOutputDir("replay-logs");
log.SetNodeModelType(1, "auv");
log.SetNodeModelType(2, "sensor");
log.SetNodeModelType(3, "buoy");
// log.SetLocalNodeId(2);                   // 可选：只输出节点 2 的自身收发日志
if (!runId.empty()) log.SetRunId(runId);
log.InstallAll(Seconds(simStop));           // 自动发现所有 Aqua-Sim 设备
// 也可以用 log.Install(devices, Seconds(simStop)) 显式提供参与设备

Simulator::Stop(Seconds(simStop));
Simulator::Run();
Simulator::Destroy();                      // 自动写出，无需额外 Flush/Write
```

保留原 main 的 Stop/Run/Destroy，不重复添加。标识符 1/2/3 是 Aqua-Sim 设备地址，与日志 node_id 一致，不自动按 ns-3 Node::GetId()+1 推测。支持 `auv` / `rov` / `vessel` / `buoy` / `sensor`；未设置的节点显式使用 `auv`。名称可用 SetNodeName 配置。配置后 Install 一次，后续不在仿真中途改采集范围或节点模型。

| 设置 | 输出 |
|---|---|
| NETWORK | `net.json`，全局观测 |
| NODE，不指定 LocalNodeId | `node.<id>.json`，每个节点一份，包括没有通信的节点 |
| NODE，指定 LocalNodeId | 仅指定节点自己的 TX、RX、碰撞/丢弃结果与轨迹 |
| ALL | 全局文件和节点文件；LocalNodeId 只限制节点文件 |

文件位于 `replay-logs/YYYY-MM-DD_HH-MM-SS/<run_id>/`。第一层取启用采集时主机的本地日期时间，第二层使用本次实验 ID。省略参数时，每个进程独立生成 16 位随机十六进制 ID；需要关联的各船日志请传入同一个 ID，例如 `./ns3 run my-scenario -- --runId=lake-01`。该值也写入 JSON 的 `meta.run_id`。自定义 ID 支持 1～80 个英文字母、数字、连字符和下划线。同一时间戳下已有同名实验目录时会报错。默认禁用日志，必须 SetEnabled(true)。所有节点创建完再安装，且每个参与节点只能有一个 Aqua-Sim 设备。

Helper 内部持有记录器到 Destroy，保留 NodeList 对象直到最后位置采集完成，再解除连接和释放；不插入 Stop、不改变仿真终止时刻。提前停止时写实际结束时刻。需要在 Destroy 前查看文件时，可选调用 log.Flush()，之后自动 Flush 不重复写。未调用 Destroy、进程崩溃或强制退出不保证输出。

每个进程仅一个记录器/一次实验；批量运行启动不同进程。main 使用 Helper 时不要再 include 底层记录器头文件，也不要同时安装旧 ReplayHelper 或 Web 内嵌的日志代码。

## Web 合并节点日志

实验结束后，在回放页点击 **导入节点日志**，一次选择同一 run_id 目录下所有 `node.*.json`；不要把 `net.json` 一起选入。当前 Web 最多同时读取 64 个文件、合计 96 MiB，单文件限 24 MiB，超限整批报错，不再静默截取前 20 个。

全局文件沿用 `uan-vis-packet-log/v2`。新的节点文件为 `uan-vis-node-log/v2`：每个文件只拥有本节点的 TX/RX 和移动轨迹，携带已知初始拓扑、modelType、相同 run_id 和精确发送 event_id；Web 沿用原节点日志合并入口。旧 v1 和既有样例的解析/匹配规则保留。

来自不同实验、重复节点文件、发送身份/时刻冲突会明确报错。全部节点文件合并后，收发时间、接收结果与轨迹应与直接全局输出相同。只导入一个节点文件时，若仅有 RX，Web 使用随 RX 记录的**实际发送时间/时长**恢复关联发送，不推测其他节点的接收结果；其他节点只有初始拓扑，完整移动轨迹需要导入它们自己的日志。

单点模式在同一次 ns-3 仿真内仍给发送事件加 Tag 并采集关联 TX 上下文；不监听其他节点的 RX，不向单点文件写其他节点的独立 TX 事件。这不是独立硬件抓包或跨进程分布式日志同步功能。

## 限制与验证

- 不修改协议参数或算法；附加 PacketTag 是仿真元数据，不计入传输字节。
- 轨迹按真实米制坐标保存，不改 Z、不迁移坐标以迎合画面；按 Web 约定负 Z 向下。
- 当前导入上限为 4000 节点、30000 次发送、单次采集 50000 段轨迹、24 MiB 文件。回放页支持合并最多 250000 段轨迹。每船独立记录 8 小时、按 1 Hz 每秒一段计算，每船约 28800 段，五船约 144000 段。组件超限时报错，不输出伪装完整的截断结果。
- Write 在仿真完成后一次写出；异常结束不会自动提供完整日志。使用独立文件名避免覆盖旧实验。
- 具体已验证环境和结果见 [验证记录](docs/verification.md)。未知版本仍需一次成功接收、一场真实碰撞、移动轨迹和开启/关闭记录的结果对照。

Web 仓库维护者可运行 `node scripts/export-ns3-logger.mjs` 重新导出共用模板；`--check` 检查导出未漂移。目标 ns-3 工程使用已生成的头文件，不需要运行导出脚本。

跨分支接入及碰撞/丢弃事件要求见 [移植说明](docs/porting.md)。完整操作不需要阅读内部序列化代码。

## 维护与打包

在 Web 仓库根目录运行 `python3 scripts/package-visual-logger.py`，生成 `exports/visual-logger.zip` 和对应 SHA-256。脚本先检查共用模板一致性，再从 `contrib/visual-logger/` 打包源码、示例和文档；排除 Finder 元数据及构建产物，校验 ZIP 内容与源码一致。

从早期组件升级时，替换旧 contrib 目录，并同步将 include 改为 `ns3/visual-log-helper.h`、类名改为 `VisualLogHelper`、枚举改为 `VisualLogScope`、构建选项改为 `VISUAL_LOGGER_AQUASIM_MODULE`。重新 configure/build；保存的日志无需转换。
