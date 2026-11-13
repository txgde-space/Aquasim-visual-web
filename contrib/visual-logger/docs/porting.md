# 分支移植与事件接入

目录示例：

```text
ns-3/
  scratch/
    my-scenario.cc
    visual-logger/
      model/visual-logger.h
      model/detail/...
      adapters/...
```

只在主 `.cc` 中 include 一次；不要再混入 Web 生成的整套日志代码。每个进程只支持一个记录器和一次仿真；批量实验每次启动新进程。只复制两个顶层头文件及 `detail` 即可，`tests` 无需复制到 scratch。

在原场景顶部添加：

```cpp
#include "visual-logger/adapters/aqua-sim-adapter.h"
```

在所有节点、MobilityModel、设备和地址配置完成后，`Simulator::Run()` 前添加：

```cpp
// nodes 和 devices 来自原场景，顺序一一对应，每个节点一个 Aqua-Sim 设备。
// stop 使用原场景已经确定的仿真终止时间。
ns3::VisualLogger replay(nodes, ns3::VisualLoggerNodeIds(devices), stop);
ns3::AttachAquaSim(replay, nodes, devices);

// 可选：ID 是 Aqua-Sim 设备地址，不一定是 Node::GetId()。
// replay.SetNodeDisplay(1, "水下节点 A", "auv");
// replay.SetPropagationSpeed(1500); // 仅在所选模型确实使用这个恒定速度时设置

ns3::Simulator::Stop(stop);
ns3::Simulator::Run();
replay.Write("net.my-scenario.json"); // 必须在 Destroy 之前调用
ns3::Simulator::Destroy();
```

保留原场景已有的 Stop/Run/Destroy，只把上面相应语句插入正确位置，不重复调用。初始位置必须在记录器创建前设好。移动节点自动通过 CourseChange 和采样记录，默认采样 100 ms，长仿真按节点数/时长自动放宽到约两万次周期观察。

用目标工程原有构建方式运行，例如新版本 `./ns3 run my-scenario`，旧 waf 工程 `./waf --run my-scenario`。生成文件位于程序工作目录。回放页导入该 JSON 即可。

头文件不依赖模块总头文件名，因此不要求模块名必须为 `aqua-sim-tg`；自定义 CMake/waf 目标仍需链接实际 Aqua-Sim 模块及 core/network/mobility。若 scratch 自动扫描未推导出模块依赖，请在该目标显式添加这些链接库。

## 2. 先核对目标分支的接口

附带 `adapters/aqua-sim-adapter.h` 的要求：

1. 存在 `AquaSimNetDevice::GetPhy()`、AquaSimAddress、`AquaSimPhy::GetSignalCache()`。
2. PHY 的 `Tx` 和 `Rx` 注册回调签名为 `void(Ptr<Packet>, double)`，注册回调契约字符串为 `ns3::AquaSimPhy::TracedCallback`。
3. `Tx` 在实际发射、信道复制包之前触发，此时包头为 `AquaSimPacketStamp`。去掉这个头后的副本可以传给 `calcTxTime(packet)` 获取真实占用时长。
4. `Rx` 在成功物理接收结束时触发；若存在处理延迟，提供独立 `RxComplete` 或适配时使用物理完成时刻。不能把应用层收包时刻当物理接收时刻。
5. 信道复制包时保留 PacketTag；重建包时需保留对应发送事件标签。组件不能仅凭 UID 正确区分转发/重传。

必需 trace 缺失/契约不匹配时明确报错。即使契约字符串相同，也要核对实际回调参数和触发语义；字符串不能证明语义正确。仅有 Tx/Rx 时输出 `phy-success`，成功接收开始由完成时刻减发送时长得到，要求接收占用与发送占用一致。未收到不是碰撞证据。

参考 ns-3 官方 tracing 文档：https://www2.nsnam.org/docs/release/3.44/manual/html/tracing.html 。Aqua-Sim NG 上游的模块名、支持版本与当前私有分支可能不同：https://github.com/rmartin5/aqua-sim-ng 。此包未据此声称已验证上游所有版本。

## 3. 碰撞、丢弃如何接入

已有接收事件的分支：适配器先查 PHY，再查其已有缓存，按公开契约连接，不替换任何对象。

| Trace | 实际回调参数 | 注册契约字符串 |
|---|---|---|
| RxBegin | `Ptr<Packet>, Time` | `ns3::AquaVisualRxBeginCallback` |
| RxCollision | `Ptr<Packet>, Ptr<Packet>, std::string` | `ns3::AquaVisualRxCollisionCallback` |
| RxDrop | `Ptr<Packet>, std::string` | `ns3::AquaVisualRxDropCallback` |
| RxEnd | `Ptr<Packet>` | `ns3::AquaVisualRxEndCallback` |

`RxBegin` 在实际接收被纳入 PHY/缓存时触发，Time 为实际接收占用时长；`RxCollision` 在原算法首次确定碰撞时触发，第二个包是已观测到的干扰包，没有就传空指针；`RxDrop` 记录原算法真实丢弃时刻及原因；`RxEnd` 表示原生接收处理返回，不代表成功。成功仍由 RxComplete/Rx 记录。

没有这些 trace 时，有两种明确的接入方式：

- **保留现有缓存，在原来的状态变化位置增加 TracedCallback 通知**。每次原判定发生后通知，不重新计算碰撞，不改变 return/队列/时延。这是跨分支完整适配的通用方式。
- **缓存结构与附带观察子类一致时，显式选择对应观察子类**：包含 `adapters/observed-cache.h`，在原场景设备构造时选择 `ns3::AquaVisualSignalCacheRange` 或 `ns3::AquaVisualSignalCacheSINR`。两者继承各自原生算法；保留原有缓存参数。不能把自定义缓存换成 Range 来获得日志，也不能运行中替换已有缓存。内部布局不同的分支需要移植观察层，不能直接使用该头文件。

例如，为目标缓存新增开始接收通知时，在其类声明中加入：

```cpp
ns3::TracedCallback<ns3::Ptr<ns3::Packet>, ns3::Time> m_visualRxBegin;
```

在该类原有 GetTypeId() 链中注册（YourCache 换成实际类名）：

```cpp
.AddTraceSource("RxBegin", "Actual admitted reception and airtime",
    ns3::MakeTraceSourceAccessor(&YourCache::m_visualRxBegin),
    "ns3::AquaVisualRxBeginCallback")
```

在实际接收进入缓存的代码位置调用 `m_visualRxBegin(packet, actualAirtime)`。其他三个事件同理，必须分别放到原生碰撞判定、丢弃及处理结束位置。仅添加 GetTypeId 注册而没有触发回调，不会产生记录；仅添加 RxBegin 也不能获得完整碰撞/丢弃原因。

可选接口不完整时仅记录实际提供的信息；`phy-events` 表示存在接收开始观测，不保证每种失败都有原因。仿真结束时未完成的接收标为 `reception_incomplete`，处理结束但没有结果标为 `outcome_unreported`。两者都不代表已确认的碰撞。

## 4. 其他分支的最小适配层

只包含 `model/visual-logger.h`，把该分支的现有 TraceSource 连接到你自己的回调，再在回调里调用：

```cpp
replay.Tx(senderId, packet, actualAirtime);       // 实际开始发射
replay.RxBegin(receiverId, packet, actualAirtime);// 实际开始接收
replay.RxSuccess(receiverId, packet);            // 成功物理接收结束
replay.RxCollision(receiverId, packet, otherPacket, "collision_rx_rx");
replay.RxDrop(receiverId, packet, "collision_rx_rx");
replay.RxEnd(receiverId, packet);                // 原接收处理已返回
```

这些调用是各事件的对照表，不要连续执行来模拟一次成功收包。每个事件只记录一次；自动 AttachAquaSim 与手动 Tx/Rx 不可对同一设备重复接入。成功、失败分支保持原算法决定，不能在发送函数内按距离批量填接收成功。传递的 packet 必须保留发送时的 Tag。没有 RxBegin 的接收不能事后凭丢包理由补造传播过程。

如果改变了回调签名或包头布局，调整适配层即可；JSON、移动轨迹和 Web 解析都无需改变。需要从模型库内部直接调用时，应通过该库自己的 TraceSource 将事件传到主程序，避免在多个 `.cc` 中 include 本组件导致分散的记录状态。


## 兼容接口

组件名称与公共 Helper 已统一为 visual-logger / VisualLogHelper。`AquaVisualRx*Callback` 契约字符串、已有 PacketTag 与观察缓存的 TypeId 沿用原值，用于对接现有 Aqua-Sim/Web 事件；它们是兼容接口，不是组件名称。
