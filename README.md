# Aquasim Visual Web

这个仓库现在分成两层：

- `frontend/`: Vue 3 + Vite 前端壳子
- `backend/`: Python 控制服务骨架

根目录现有的 `index.html` 仍然保留，作为早期单文件回放原型参考；后续真正迭代建议都放到 `frontend/` 和 `backend/`。

## 目录说明

### 前端

- `frontend/src/pages/DashboardPage.vue`: 控制台首页
- `frontend/src/pages/ScenarioPage.vue`: 场景/任务配置页
- `frontend/src/pages/LiveLogsPage.vue`: 实时日志页
- `frontend/src/pages/ReplayPage.vue`: 结构化日志回放页
- `frontend/src/replay/`: 回放解析和播放控制模块

### 后端

- `backend/app.py`: API 入口
- `backend/ns3_service.py`: 任务控制服务
- `backend/task_store.py`: 任务和日志存储
- `backend/data/tasks/`: 示例任务数据

## 建议运行方式

### 后端

```bash
python3 backend/app.py
```

默认监听 `http://127.0.0.1:8080`。

### 前端

这个环境里没有 Node/npm，所以这里只落了项目结构，没有安装依赖。  
你在本机补齐 Node 后可以这样启动：

```bash
cd frontend
npm install
npm run dev
```

默认会读取 `frontend/public/net.log` 作为回放示例。

## 后续接 ns-3 的建议

1. 场景配置页提交 `task spec`
2. 后端创建 task 并启动 ns-3 进程
3. stdout/stderr 写入 `run.log`
4. 结构化事件写入 `net.log`
5. 回放页只读取 `net.log`，不直接碰进程控制逻辑
