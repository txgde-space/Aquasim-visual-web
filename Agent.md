# ns-3 水声网络可视化日志协议

## 目标

这个项目的 H5 可视化不是做实时仿真，而是做“仿真结束后的日志回放”。  
因此日志格式要满足 4 个要求：

1. 前端只靠日志就能复现时间线。
2. 能表达水声网络的传播时延。
3. 能表达“一个发射，多个接收”的广播本质。
4. 能表达碰撞，而且碰撞要落在接收端，而不是发射端。

## 核心建模

不要把一条日志简单设计成“src -> dst”的单链路事件。  
对水声广播，更合适的最小可视化单元是：

1. 一个 `tx` 事件：表示某个节点开始向信道发射一个包。
2. 多个 `rx` 事件：表示不同节点在各自时刻观察到该包，结果可能是成功、碰撞、丢失、忽略。

也就是说：

- `tx` 负责描述“波从哪里发出去”。
- `rx` 负责描述“谁在什么时候收到了什么结果”。
- 碰撞放在 `rx.result` 上，而不是放在 `tx` 上。

这是因为同一个广播包，对节点 A 可能成功，对节点 B 可能碰撞，对节点 C 可能根本收不到。

## 推荐文件格式

推荐使用 `JSON Lines`，即 `.jsonl`：

- 每行一个 JSON 对象。
- 适合 ns-3 仿真过程中顺序写出。
- 适合大日志文件。
- 前端读取后再按 `tx_id` / `packet_uid` 聚合。

如果后续数据量不大，也可以在加载阶段转成单个 JSON 对象：

```json
{
  "meta": {},
  "nodes": [],
  "events": []
}
```

但“落盘格式”仍建议是 `jsonl`。

## 时间和单位约定

不要直接在前端使用浮点秒，避免精度误差。  
统一使用整数微秒：

- `start_us`
- `duration_us`
- `end_us`
- `prop_delay_us`

约定：

- 时间基准是仿真时间 `t=0`
- 坐标单位统一为米 `m`
- 深度建议使用 `z`，水下可为负值，或者统一约定向下为正值，但必须全局一致

## 日志记录类型

### 1. `meta`

文件头部只出现一次，用于描述版本和全局参数。

```json
{
  "type": "meta",
  "schema": "uan-vis-log/v1",
  "time_unit": "us",
  "distance_unit": "m",
  "seed": 12345,
  "sim_end_us": 120000000
}
```

### 2. `node`

用于描述节点基础信息。静态场景只需要在开头输出一次；移动场景再配合 `node_pos`。

```json
{
  "type": "node",
  "node_id": 7,
  "name": "node-7",
  "x": 120.0,
  "y": 80.0,
  "z": -35.0,
  "role": "sensor"
}
```

### 3. `node_pos`

仅在节点移动时输出。前端按时间更新位置。

```json
{
  "type": "node_pos",
  "node_id": 7,
  "time_us": 5400000,
  "x": 126.0,
  "y": 82.5,
  "z": -34.0
}
```

### 4. `tx`

表示一个节点向声学信道发出一个包。这是广播源事件。

```json
{
  "type": "tx",
  "tx_id": "tx-000128",
  "packet_uid": "pkt-000128",
  "src": 3,
  "mac_dst": "broadcast",
  "net_dst": 9,
  "start_us": 1200000,
  "duration_us": 180000,
  "end_us": 1380000,
  "size_bytes": 256,
  "freq_hz": 25000,
  "bitrate_bps": 11300,
  "tx_power_db": 190.0,
  "range_m": 1800.0
}
```

字段说明：

- `tx_id`: 这次发射的唯一 ID。
- `packet_uid`: 包的唯一 ID。如果重传是同一逻辑包，可另加 `flow_id` / `seq`。
- `src`: 发射节点。
- `mac_dst`: 对广播场景通常固定为 `broadcast`。
- `net_dst`: 可选。若上层协议有逻辑目的节点，可以填；否则为 `null`。
- `range_m`: 可视化建议字段，表示波前动画的最大渲染半径。

### 5. `rx`

表示某个接收节点对某个 `tx` 的观测结果。一个 `tx` 可以对应多个 `rx`。

```json
{
  "type": "rx",
  "rx_id": "rx-000128-009",
  "tx_id": "tx-000128",
  "packet_uid": "pkt-000128",
  "src": 3,
  "dst": 9,
  "prop_delay_us": 92000,
  "start_us": 1292000,
  "duration_us": 180000,
  "end_us": 1472000,
  "distance_m": 138.4,
  "result": "ok",
  "snr_db": 17.8,
  "per": 0.01,
  "collided_with": []
}
```

`result` 推荐枚举值：

- `ok`: 成功接收
- `collision`: 碰撞
- `interference`: 受干扰失败，但不一定是严格碰撞
- `below_snr`: 信噪比不足
- `out_of_range`: 超出可接收范围
- `half_duplex_busy`: 接收端忙，或自身正在发射
- `dropped`: 其他原因丢弃

其中碰撞示例：

```json
{
  "type": "rx",
  "rx_id": "rx-000128-011",
  "tx_id": "tx-000128",
  "packet_uid": "pkt-000128",
  "src": 3,
  "dst": 11,
  "prop_delay_us": 140000,
  "start_us": 1340000,
  "duration_us": 180000,
  "end_us": 1520000,
  "distance_m": 210.2,
  "result": "collision",
  "snr_db": 4.2,
  "collided_with": ["tx-000127", "tx-000130"]
}
```

### 6. `drop` 可选

如果你想把“根本没有形成有效接收窗口”与 `rx.result` 区分开，可以单独记录。
但第一版不建议复杂化，直接统一进 `rx.result` 即可。

## 最小必需字段

如果你想先快速跑通第一版，最少只保留这些字段：

### `tx` 必需字段

```json
{
  "type": "tx",
  "tx_id": "tx-1",
  "src": 1,
  "mac_dst": "broadcast",
  "start_us": 1000000,
  "duration_us": 200000,
  "end_us": 1200000
}
```

### `rx` 必需字段

```json
{
  "type": "rx",
  "tx_id": "tx-1",
  "src": 1,
  "dst": 4,
  "start_us": 1080000,
  "duration_us": 200000,
  "end_us": 1280000,
  "result": "collision"
}
```

但实际项目里，至少再补两个字段：

- `prop_delay_us`
- `collided_with`

否则你前端很难把水声传播和碰撞解释清楚。

## 为什么不能只用一条“源-目的”日志

因为水声信道里，同一个包的传播和结果是“按接收者分裂”的：

1. 一个源节点发射一次，多个邻居会在不同时间收到。
2. 不同邻居到源节点距离不同，传播时延不同。
3. 不同邻居位置不同，碰撞情况不同。
4. 所以“目的节点”不是一个固定单值，而是一个接收结果集合。

因此推荐的数据关系是：

```text
tx(一次广播发射)
  -> rx(节点A的接收结果)
  -> rx(节点B的接收结果)
  -> rx(节点C的接收结果)
```

## 前端如何呈现广播

建议拆成 3 层可视化：

### 1. 发射层

当出现 `tx` 时：

- 在 `src` 节点上高亮
- 以 `src` 为圆心播放“扩散波环”
- 波环持续时间可映射 `duration_us`
- 最大半径可映射 `range_m`

这层表达“节点正在占用信道发射”。

### 2. 到达层

当出现 `rx` 时：

- 在 `dst` 节点时刻 `start_us` 做一次“波到达”提示
- 可以从 `src -> dst` 画一条短暂虚线或粒子轨迹
- 如果你想更真实，线条动画应该在 `tx.start_us -> rx.start_us` 这段时间内运动，而不是瞬间出现

这层表达“信号传播到了某个接收者”。

### 3. 结果层

根据 `rx.result` 渲染不同样式：

- `ok`: 绿色闪烁
- `collision`: 红色爆点 + 震荡圈
- `below_snr`: 黄色弱提示
- `out_of_range`: 可以不画到达动画，或画成很淡的失败提示

注意：  
碰撞图标应该出现在 `dst` 节点附近，而不是 `src` 和 `dst` 中点。  
因为碰撞是接收端视角的事件。

## 推荐的完整示例

下面是一组可以直接给前端消费的示例：

```json
{"type":"meta","schema":"uan-vis-log/v1","time_unit":"us","distance_unit":"m","sim_end_us":5000000}
{"type":"node","node_id":1,"name":"node-1","x":0,"y":0,"z":-20,"role":"sink"}
{"type":"node","node_id":2,"name":"node-2","x":100,"y":20,"z":-30,"role":"sensor"}
{"type":"node","node_id":3,"name":"node-3","x":160,"y":-40,"z":-28,"role":"sensor"}
{"type":"tx","tx_id":"tx-1","packet_uid":"pkt-1","src":2,"mac_dst":"broadcast","net_dst":1,"start_us":1000000,"duration_us":150000,"end_us":1150000,"size_bytes":128,"range_m":1200}
{"type":"rx","rx_id":"rx-1-1","tx_id":"tx-1","packet_uid":"pkt-1","src":2,"dst":1,"prop_delay_us":70000,"start_us":1070000,"duration_us":150000,"end_us":1220000,"distance_m":105.0,"result":"ok","collided_with":[]}
{"type":"rx","rx_id":"rx-1-3","tx_id":"tx-1","packet_uid":"pkt-1","src":2,"dst":3,"prop_delay_us":90000,"start_us":1090000,"duration_us":150000,"end_us":1240000,"distance_m":136.0,"result":"collision","collided_with":["tx-2"]}
{"type":"tx","tx_id":"tx-2","packet_uid":"pkt-2","src":1,"mac_dst":"broadcast","net_dst":null,"start_us":1080000,"duration_us":120000,"end_us":1200000,"size_bytes":96,"range_m":1200}
{"type":"rx","rx_id":"rx-2-3","tx_id":"tx-2","packet_uid":"pkt-2","src":1,"dst":3,"prop_delay_us":60000,"start_us":1140000,"duration_us":120000,"end_us":1260000,"distance_m":92.0,"result":"collision","collided_with":["tx-1"]}
```

这个例子里：

- 节点 2 发出一个广播 `tx-1`
- 节点 1 成功收到
- 节点 3 收到时发生碰撞
- 同时节点 1 也发出了另一条广播 `tx-2`
- 对节点 3 来说，`tx-1` 和 `tx-2` 在接收窗口上重叠，所以两条 `rx` 都标成 `collision`

## 前端数据组织建议

前端加载日志后，建议整理成：

```js
{
  meta,
  nodes: Map<node_id, node>,
  txMap: Map<tx_id, tx>,
  rxByTx: Map<tx_id, rx[]>,
  rxByDst: Map<dst, rx[]>,
  timeline: Event[]
}
```

这样可以支持两种视图：

1. 全局时间回放
2. 单节点观察视图

## 给 ns-3 导出日志时的建议

在 ns-3 侧，建议在两个时机写日志：

1. 发射开始时写一条 `tx`
2. 每个接收节点判定结果时写一条 `rx`

不要等所有结果都结束了再拼成一大条日志。  
原因是：

- 导出逻辑更简单
- 更贴近仿真事件本身
- 更适合后续做流式回放

## 第一版落地建议

如果你现在是原型阶段，不要一开始就把所有物理层指标都塞进去。  
第一版建议只做这些：

1. `meta`
2. `node`
3. `tx`
4. `rx`

其中 `tx` 只保留：

- `tx_id`
- `src`
- `start_us`
- `duration_us`
- `end_us`
- `mac_dst`

其中 `rx` 只保留：

- `tx_id`
- `src`
- `dst`
- `prop_delay_us`
- `start_us`
- `duration_us`
- `end_us`
- `result`
- `collided_with`

这样已经足够把：

- 广播扩散
- 接收成功
- 接收碰撞
- 时间轴回放

完整做出来。

## 结论

这套协议的关键不是“给一条日志塞更多字段”，而是先把事件关系拆对：

- 一次广播发射 = 一条 `tx`
- 每个接收结果 = 一条 `rx`
- 碰撞归属接收端
- 逻辑目的节点和物理广播目的要分开

如果后面你要继续做，我建议下一步直接把 `index.html` 的前端数据结构也按这个协议改成：

- 日志加载器
- 时间轴调度器
- 波纹动画层
- 节点状态层
- 碰撞标记层

这样后面接 ns-3 导出的日志时会比较顺。  
