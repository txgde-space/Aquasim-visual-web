# ns-3 Aqua-Sim 可视化日志约束

## 目标

这份日志不是给 ns-3 内核看的，是给回放前端看的。  
要求只有两个：

1. 一条日志能直观看出“谁发了，谁收了，结果怎样”。
2. 日志前后必须自洽，不能出现时间窗口上互相矛盾的记录。

因此当前项目统一使用“包级复合日志”，不再使用平铺的 `tx` / `rx` 顶层事件作为前端主格式。

## 当前格式

使用 `JSON Lines`，每行一个 JSON 对象。

### `meta`

```json
{"type":"meta","schema":"uan-vis-packet-log/v1","time_unit":"us","distance_unit":"m","sim_end_us":12000000}
```

### `node`

```json
{"type":"node","node_id":5,"name":"Gateway-5","x":2060,"y":2320,"z":-24,"role":"gateway"}
```

### `packet`

```json
{
  "type": "packet",
  "packet_id": "pkt-004",
  "src": 4,
  "tx_start_us": 3450000,
  "tx_duration_us": 260000,
  "receivers": [
    {
      "dst": 5,
      "rx_start_us": 3660000,
      "rx_duration_us": 260000,
      "status": "fail",
      "reason": "collision_rx_tx",
      "with": ["pkt-005"]
    }
  ]
}
```

## 字段约束

### 包级字段

- `packet_id`: 唯一 ID
- `src`: 发射节点
- `tx_start_us`: 发射开始时间
- `tx_duration_us`: 发射持续时间
- `receivers`: 所有接收端结果列表

### 接收端字段

- `dst`: 接收节点
- `rx_start_us`: 该包到达该节点并开始占用接收窗口的时间
- `rx_duration_us`: 该接收窗口持续时间
- `status`: `ok` 或 `fail`
- `reason`: 仅在 `fail` 时填写
- `with`: 仅在冲突时填写，列出导致冲突的其他 `packet_id`

## 结果枚举

当前前端只保留下面两类失败原因：

- `collision_rx_rx`
- `collision_rx_tx`

如果后面确实要表达门限不足、解码失败，再加：

- `below_rx_thresh`
- `decode_error`

第一版不要引入更多枚举。

## 判定规则

先固定一个物理前提：

- 节点是严格半双工
- 接收窗口内不允许启动发送
- 发送窗口内到达的包一律收不到

### 1. `tx` 不标冲突

发送事件只表达“该节点开始向信道发包”。  
不要给发射端写“正常发送”或“发送冲突”这种状态。

冲突只落在接收端。

### 2. `rx-rx` 冲突

如果两个或以上不同包在同一个 `dst` 的接收窗口重叠，则这些接收记录必须标成：

```json
{
  "status": "fail",
  "reason": "collision_rx_rx",
  "with": ["other-packet-id"]
}
```

最小判定条件：

- `dst` 相同
- 接收窗口有重叠
- 两条记录来自不同 `packet_id`

时间重叠判定：

```text
!(end_a <= start_b || end_b <= start_a)
```

### 3. `rx-tx` 冲突

如果一个包到达节点 `dst` 的接收窗口，与该节点自己某次发送窗口重叠，则该接收必须标成：

```json
{
  "status": "fail",
  "reason": "collision_rx_tx",
  "with": ["self-tx-packet-id"]
}
```

最小判定条件：

- 某条接收记录的 `dst = N`
- 同时存在某条发射记录 `src = N`
- 该节点的发送窗口与这条接收窗口有重叠

注意：

- 这里失败的是“接收”
- 该节点自己的发送不因此中断

这里要区分两种情况：

1. 节点已经在发，此时有包到达  
   这条接收记 `collision_rx_tx`

2. 节点已经在收，此时本来想开始发  
   这次发送不应直接起发；应由 MAC/PHY 延后，或者根本不写出这条 `tx`

也就是说，严格半双工下：

- “发的时候收不到” 是 `rx-tx`
- “收的时候不允许发” 不是另一种冲突类型，而是发送侧根本不该在该时刻开始

### 4. 成功接收

只有在下面两个条件都不成立时，接收才可记为 `ok`：

1. 不与同一 `dst` 的其他接收窗口重叠
2. 不与该 `dst` 自己的发送窗口重叠

否则就不能写 `ok`。

### 5. 发送起点合法性

对于任意一条 `packet`，其 `tx_start_us` 必须满足：

- `src` 节点在该时刻没有处于任何接收窗口内

如果某个节点在 `tx_start_us` 时刻仍处于接收窗口，则这条发送日志不合法。  
处理方式只能二选一：

1. 推迟 `tx_start_us` 到接收结束之后
2. 不写出这条发送

## 一致性检查规则

生成日志后，至少做这两类检查。

### 检查 A: 自发自收冲突

如果存在：

- `packet A -> dst = N` 的接收窗口
- `packet B, src = N` 的发送窗口
- 两个窗口重叠

则 `packet A` 在 `N` 处不能是 `ok`。

### 检查 A2: 接收中起发

如果存在：

- `packet A -> dst = N` 的接收窗口
- `packet B, src = N` 的 `tx_start_us`
- 满足 `rx_start_us <= tx_start_us < rx_end_us`

则 `packet B` 这条发送日志不合法。  
它不应被解释成 `rx-tx`，而应当被延后或删除。

### 检查 B: 同接收端重叠

如果存在：

- `packet A -> dst = N`
- `packet B -> dst = N`
- 两个接收窗口重叠

则二者至少不应继续都标 `ok`。  
对于当前这份示例协议，直接都记成 `collision_rx_rx`。

## 示例

### `rx-rx`

```json
{"type":"packet","packet_id":"pkt-001","src":3,"tx_start_us":600000,"tx_duration_us":220000,"receivers":[{"dst":2,"rx_start_us":1480000,"rx_duration_us":220000,"status":"fail","reason":"collision_rx_rx","with":["pkt-002"]}]}
{"type":"packet","packet_id":"pkt-002","src":6,"tx_start_us":980000,"tx_duration_us":260000,"receivers":[{"dst":2,"rx_start_us":1660000,"rx_duration_us":260000,"status":"fail","reason":"collision_rx_rx","with":["pkt-001"]}]}
```

### `rx-tx`

```json
{"type":"packet","packet_id":"pkt-004","src":4,"tx_start_us":3560000,"tx_duration_us":260000,"receivers":[{"dst":5,"rx_start_us":3770000,"rx_duration_us":260000,"status":"fail","reason":"collision_rx_tx","with":["pkt-005"]}]}
{"type":"packet","packet_id":"pkt-005","src":5,"tx_start_us":3520000,"tx_duration_us":360000}
```

## 前端消费约定

- 节点空闲：蓝色
- 节点发送：橙色
- 节点接收成功：绿色
- `rx-rx` / `rx-tx`：在冲突实际发生时转红
- 传播链路可以显示细虚线
- 传播中的包显示为沿路径推进的矩形块

日志的职责不是描述动画细节，而是给出足够的时间边界和结果边界。

## 当前结论

后续从 Aqua-Sim 导日志时，优先保证这三点：

1. 一条 `packet` 表示一次广播尝试
2. 冲突只记在 `receivers[]`
3. 任何时间窗口重叠上的逻辑都必须自洽，且满足严格半双工
