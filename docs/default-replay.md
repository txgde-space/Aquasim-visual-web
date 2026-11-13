# 默认回放：海面科考船与水下移动观测

默认回放使用 `src/assets/net_surface_survey.json`，为真实 ns-3 仿真生成的 66 秒 PHY 事件与轨迹。原有 `net.json` 等八份兼容样例保留不变。

8 个节点包含科考船、海面浮标、ROV、2 艘 AUV、3 个固定水下观测节点。科考船以约 1.61 m/s 航行，浮标缓慢漂移，ROV 与 AUV 使用独立速度。所有坐标保持真实米制，船长仍为 18 m；近看节点时相机跟随位移，保留手动环绕、缩放和平移偏移，全局视角不跟随。

海面 Z=500 m，节点以模型最低点中心定位。科考船底部 Z=498.9 m（吃水约 1.1 m），浮标底部 Z=497.3 m，其余节点位于水下。船体与浮标的上部露出海面，整个轨迹中不改变深度。

示例显式选择 Simple PHY、Broadcast MAC、Static Routing 和 Range Propagation，200 bps、40 B 应用包、300 ms 接收处理、1 km 传播范围。收发、转发、碰撞和时刻均来自仿真输出，包含协议头开销。节点 4/5/6/7 分别按 12/17/24/29 秒间隔产生数据；注册默认值和现有协议行为不变。

可导入的实验参数位于 `exports/海面科考船-移动观测实验.json`。已有本地服务且协议目录预编译成功时，在仓库根目录执行以下命令重新生成：

```sh
node scripts/generate-default-replay.mjs http://localhost:5173 /path/to/aqua-sim-dev
```
