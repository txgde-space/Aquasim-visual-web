# Aquasim Visual Web

Aquasim Visual Web is a web-based visualization and replay platform for Aqua-Sim / ns-3 underwater acoustic network simulations.

It helps researchers observe dynamic underwater network behavior more intuitively, including node topology, packet transmission, collisions, propagation delay, and protocol execution over time. Instead of relying only on raw logs or numerical outputs, users can replay structured simulation events through an interactive web interface.

This project addresses a tooling gap in the underwater acoustic network research ecosystem. While Aqua-Sim / ns-3 provides powerful simulation capabilities, mature and easy-to-use visualization tools for underwater network experiments are still limited. Aquasim Visual Web is designed as a lightweight and extensible companion tool for protocol debugging, experiment analysis, and result presentation.

The app includes both a 2D Canvas replay view and a Babylon.js 3D view, so it can be used for quick packet-level debugging as well as spatial inspection of acoustic network behavior.

## Features

- Replay underwater acoustic packet transmission over a simulation timeline.
- Switch between 2D Canvas and 3D Babylon.js visualizations.
- Inspect node status, packet paths, receiver results, and collision reasons.
- Load bundled demo logs or import custom log files from the browser.
- Merge node-level logs into a packet-level replay.
- Use global replay mode or packet lifecycle mode.
- Adjust playback speed, visual theme, effects level, and underwater detail.
- Measure distances directly in the 2D view.

## Tech Stack

- Vue 3
- Vite
- Babylon.js
- Tailwind CSS

## Getting Started

Install dependencies:

```bash
yarn install
```

Start the development server:

```bash
yarn dev
```

Build for production:

```bash
yarn build
```

Preview the production build:

```bash
yarn preview
```

This project uses Yarn v1 and keeps `yarn.lock` as the only dependency lockfile.

## Log Inputs

The app can parse structured JSON and JSON Lines logs. Bundled sample logs are located in `src/assets/`:

- `net.json`
- `net_multihop.json`
- `net_multihop_complex.json`

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
├── public/
│   ├── favicon.svg
│   └── icons.svg
└── src/
    ├── App.vue
    ├── main.js
    ├── style.css
    ├── assets/
    │   ├── net.json
    │   ├── net_multihop.json
    │   └── net_multihop_complex.json
    └── components/
        ├── NodeCanvas.vue
        └── NodeScene3D.vue
```

## Notes

- `NodeCanvas.vue` renders the interactive 2D replay, node tooltip, pan/zoom controls, and distance measurement tool.
- `NodeScene3D.vue` renders the Babylon.js 3D scene and interactive camera.
- `App.vue` owns log parsing, replay state, packet normalization, lifecycle mode, and UI controls.

---

# Aquasim Visual Web 中文说明

Aquasim Visual Web 是一个基于 Vue 3 + Vite 的水下声学网络仿真回放前端。它可以从结构化仿真日志中可视化节点位置、包传播路径、接收结果、冲突原因和包生命周期。

应用同时提供 2D Canvas 视图和 Babylon.js 3D 视图，既适合快速调试包级事件，也适合观察水下声学网络的空间行为。

## 功能特性

- 按仿真时间线回放水下声学包传输过程。
- 支持 2D Canvas 和 3D Babylon.js 视图切换。
- 查看节点状态、包路径、接收结果和冲突原因。
- 使用内置示例日志，或在浏览器中导入自定义日志文件。
- 支持合并节点级日志并生成包级回放数据。
- 支持全局回放模式和包生命周期模式。
- 可调整播放倍速、视觉主题、特效等级和水下环境细节。
- 在 2D 视图中直接使用测距工具。

## 技术栈

- Vue 3
- Vite
- Babylon.js
- Tailwind CSS

## 快速开始

安装依赖：

```bash
yarn install
```

启动开发服务器：

```bash
yarn dev
```

构建生产版本：

```bash
yarn build
```

预览生产构建：

```bash
yarn preview
```

本项目统一使用 Yarn v1，并只保留 `yarn.lock` 作为依赖锁文件。

## 日志输入

应用可以解析结构化 JSON 和 JSON Lines 日志。内置示例日志位于 `src/assets/`：

- `net.json`
- `net_multihop.json`
- `net_multihop_complex.json`

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
├── public/
│   ├── favicon.svg
│   └── icons.svg
└── src/
    ├── App.vue
    ├── main.js
    ├── style.css
    ├── assets/
    │   ├── net.json
    │   ├── net_multihop.json
    │   └── net_multihop_complex.json
    └── components/
        ├── NodeCanvas.vue
        └── NodeScene3D.vue
```

## 说明

- `NodeCanvas.vue` 负责交互式 2D 回放、节点提示、平移缩放和测距工具。
- `NodeScene3D.vue` 负责 Babylon.js 3D 场景和交互式相机。
- `App.vue` 负责日志解析、回放状态、包数据规范化、生命周期模式和主要 UI 控件。
