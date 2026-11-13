# 验证记录

组件规范化为 `visual-logger` 后，已重新执行两个 checkout 的 C++ 场景检查、Web 类型检查/回归/构建，以及独立临时源码中的 contrib configure、模块编译和公开头文件 scratch 运行。新的 `VisualLogHelper` 自动生成全局文件与四份节点文件。安装包还通过相对 include、文档链接、逐文件内容及重复打包 SHA-256 一致性检查。临时源码副本在验证后删除。

2026-11-11，以当前工作区已有构建进行验证。C++ 测试读取目标 ns-3 的头文件和动态库，在临时目录编译/运行，未修改外部仿真源码。浏览器验证另外临时启动 Vite，进入实验首页触发了该页已有的自动增量预编译，随后切换到回放测试；测试后关闭了该临时服务。

## 实际验证环境

- macOS，Apple C++，C++23。
- ns-3.46.1 / aqua-sim-tg：`/Users/thou/repos/aqua-sim-dev` 的 debug 构建。
- ns-3.46.1 / aqua-sim-tg：`/Users/thou/project/aqua-sim-dev` 的 default 构建。
- 实际 PHY 为 `ns3::AquaSimPhyCmn`，原生 Range 缓存和其观察子类分别验证。这是两个本地 checkout，不等于两个独立上游发行版，也不代表已验证任意 Aqua-Sim NG 版本。

## 已通过

每个环境分别通过：

1. 核心事件契约：相同 Packet UID 的不同发送事件不混合，Packet 复制保持关联；成功接收、碰撞、干扰包 ID、未完成接收正确写出。
2. 真实 ns-3 ConstantVelocityMobilityModel：2 m/s、5 s 的轨迹终点约 10 m，等速轨迹合并，保持真实坐标。
3. 真实 PHY / Channel / 缓存：原生/观察缓存 × 单发送成功/双发送碰撞 × 开启/关闭日志，共 8 个对照场景。成功场景均交付 1 包，碰撞场景均交付 0 包。
4. 成功收发的时间及持续时间在原生/观察缓存之间完全一致；碰撞场景的发送时间不变。观察子类额外输出接收开始、原生碰撞时间、最终丢弃时间及关联干扰发送。
5. 接收中止于仿真终止时间，输出 `reception_incomplete`，不伪造碰撞。
6. 所有生成文件经过当前 Web 的 parseLog 和 normalizePacketsFromParsed，包数量和节点数量保持一致。
7. 导出模板与 Web 当前采集模板一致性检查通过。
8. Helper 的 NETWORK/NODE/BOTH、单点收集发送端/接收端、禁用日志、提前停止、显式 Flush 后重复自动 Flush、Helper 离开作用域后的自动保存均通过真实仿真。禁用时不创建目录。Stop 先于 Install 注册，日志仍保留最终位置；2 m/s 的独立移动节点在 19 s 时位移 38 m。
9. 逐节点日志合并与对应全局日志的发送时间、占用时长、接收目标/结果/碰撞时刻/干扰 ID 和轨迹完全一致；单点日志不包含无关节点的发送或其他节点接收结果。
10. Web 回归覆盖 64 文件完整导入、超量/超总容量整批拒绝、拒绝不同 run_id/重复节点文件、精确小数微秒与单点 RX 上下文恢复；原八份样例及合并语义哈希仍通过。

Chrome 手动验证：通过原有「导入节点日志」一次选入真实生成的 node.10/20/30/40.json，页面显示「node.10.json + 3 个节点日志」，3 次真实发送、0 成功接收、2 次 rx-rx 碰撞、19 s 时长；两条碰撞记录指向“接收浮标”，相互引用干扰包。未用合成日志替代这次浏览器验证。

Helper 以独立 `.cc` 链接现有 ns-3 动态库完成上述测试。另外，从第一个 checkout 的 HEAD 导出独立临时源码副本，实际安装 contrib 模块，通过 ns-3 configure 和 `./ns3 build visual-logger` 完整编译，再以公开头文件 `ns3/visual-log-helper.h` 编译运行 scratch。运行自动生成 net.json 和四份节点日志，包含 3 次发送及 2 次真实接收碰撞。该分支源码引用 CSMA helper，精简构建模块列表显式包含 `visual-logger,aqua-sim-tg,csma`；未修改其协议源码。未在两个原始 checkout 中安装模块或重新配置其模块列表，其他分支仍需验证自身接口与构建依赖。

Web 仓库 `yarn typecheck`、`yarn check:regressions`、`yarn build` 均通过；构建仍有已有的大 chunk 提示。未修改 Web 现有运行流程。

## 复现

在 Web 仓库根目录，目标环境需要已有 ns-3 动态库构建：

```bash
node scripts/export-ns3-logger.mjs --check
node scripts/check-ns3-logger.mjs /path/to/ns-3
```

第二个脚本只支持 `build/include` / `build/lib` 目录下的单一 CMake 共享库构建配置；使用 `CXX` 指定编译器可执行文件。测试场景的辅助 API 也依赖该分支，旧 waf 或其他构建布局须按其原有构建系统编译 tests，不应将脚本找不到库视为记录器接口不兼容。

移植到其他分支后，应重新执行这些对照；尤其检查 Tx 调用时包头布局、实际 airtime、Rx 是否包含处理延迟、信道复制是否保留 PacketTag、缓存事件是否覆盖所需失败路径。
