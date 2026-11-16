# AquaSim Go 版

此分支是根目录 Go 工程。启动：`go run .`；停止：`go run . stop`；本机构建：`go build -o out/aquasim .`。原 Vue/TypeScript 开发工程保留在 Git 的 `main` 分支。

`web/` 中的 HTML、CSS、JavaScript、Worker、WASM 和第三方许可证直接纳入版本管理，`go:embed` 随程序打包。该分支不再提供 Vue SFC 编译流程；界面修改直接维护这些浏览器资源。修改带哈希文件名的资源时需换名并同步引用，以免长期缓存旧内容。

Go HTTP 服务内嵌版本化的浏览器静态资源，主机浏览器通过 N100 的 Wi-Fi 地址访问。底图仍由浏览器按需读取主机上选择的 MBTiles，不上传 4 GB 文件。GPS 与原子钟串口连接在运行 Go 程序的设备上。

## 在开发机制作程序

仅需要开发机已有 Go 1.26；首次下载 Go 依赖需要网络。无需 Node.js、npm、Yarn 或前端打包工具。生成后的程序包含 JavaScript、Worker、WASM、界面和串口实现，运行这些功能不需要 Go、Node.js、Python、包管理器或联网。

```sh
./scripts/build-standalone.sh
# 可选 Windows x86_64 交叉编译
TARGET_OS=windows ./scripts/build-standalone.sh
```

默认产物：`out/aquasim-n100-linux-amd64`。构建目录被 Git 忽略；发布时同时携带该程序和部署说明。`go.mod` / `go.sum` 固定编译依赖。

## N100 启动

```sh
chmod +x aquasim-n100-linux-amd64
./aquasim-n100-linux-amd64 -listen 0.0.0.0:8080
```

主机连接 N100 的 Wi-Fi，在浏览器打开 `http://N100的IP:8080/field`。仅在可信的试验局域网中开放此端口。可改为 `-listen 127.0.0.1:8080` 并通过 SSH 转发访问。操作系统仍需要识别 USB 串口，当前用户需要设备读写权限；Linux 通常需预先加入 `dialout` 或对应设备组。该程序不会安装驱动、创建权限或自动提权。

服务支持干净退出；切换网页不关闭串口，明确点击“断开”或退出 Go 服务才释放设备。串口配置在本次服务进程中有效，重启服务后由用户重新连接。

前台可直接按 **Ctrl+C** 停止。找不到原终端时，在同一台机器的另一个终端执行，不需要查找 PID：

```sh
# 开发模式（在仓库根目录）
go run . stop
# N100 二进制程序
./aquasim-n100-linux-amd64 stop
# 使用其他端口时，停止命令也指定相同端口
go run . stop -listen 0.0.0.0:8081
```

停止命令会释放串口、终止本服务的仿真任务并等待监听端口关闭；服务未运行时会直接提示。该命令仅允许本机操作，不接受浏览器或其他 Wi-Fi 客户端的停止请求。监听默认通配地址或回环地址均支持；若只绑定了具体 LAN IP，请在原终端按 Ctrl+C。旧版服务需先用 Ctrl+C 退出一次，再运行新版本。

## 串口与时间语义

协议参考用户指定的 [GPS_Time_Sync](https://github.com/txgde-space/GPS_Time_Sync/tree/fcec7fdf98f91aad37571860e75b367e0fc0d81c)：

- GPS 接收 NMEA RMC、GGA、ZDA，支持不同 talker 前缀，验证 XOR 校验和、坐标范围和日期。RMC 的 `V` 状态使定位/时间失效；GGA 不包含日期，不使用主机日期猜测 UTC。界面 GPS 数值是最后收到的样本。
- 原子钟默认 57600、8N1，通过 `!T?\r\n` 查询，响应按十进制 Unix 秒解析。查询周期可配置，避免原程序的连续无间隔查询。
- 显式点击校时发送 `!TA<Unix秒>\r\n`，只补一组 CRLF。GPS 校时要求最新有效 UTC，使用本机单调时钟补偿样本接收后的经过时间；无法消除串口传输及设备执行延迟，不宣称 PPS 或亚毫秒授时精度。
- 校时结果标记“已发送”，不当作硬件已确认。随后 `!T?` 返回值才是实际设备读回。没有协议字段证明原子钟锁定状态，因此不显示虚构的“已锁定”。
- 无有效更新超过 5 秒（原子钟至少 3 个查询周期）显示过期。设备 UTC 不靠前端计时器伪造前进；系统时间为 N100 服务端当前 UTC，并不意味着已被 GPS 校准。程序不自动修改系统时钟。

串口采用有界行缓冲、完整行解析、串行写入及可取消读取，断开后旧连接数据不能覆盖新连接。两种设备不能占用同一串口。

## 仿真运行的边界

协议校验及 C++ 代码生成规则保存在 `internal/simulator/engine.js`，由纯 Go 的 Goja 引擎执行，不调用 Node 或其他外部 JavaScript 进程。它保留既有协议语义，并非所有业务规则都已改写为 Go。

Go 程序提供完整网页及现场串口功能；ns-3 本身仍是独立的原生 C++ 仿真器，不是 Go 的替代实现。可通过 `-simulator-home /path/to/prepared/ns3` 指向已准备的原生目录。仿真后端使用随程序内嵌的通用代码生成器，不依赖 Node.js 或 ns-3 的 Python 启动脚本。动态生成新的仿真实验仍需原生构建工具及 ns-3 开发产物；没有这些资源时接口明确报错。若 N100 完全不允许编译，应在出发前准备要运行的原生试验程序，或在开发机完成仿真并携带日志回放，不能将 UI 能运行等同于任意 ns-3 场景均可离线运行。

## 验证

```sh
go test -race ./...
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o out/aquasim-n100-linux-amd64 .
```

测试包含 NMEA 校验、日期和坐标、无日期语句、原子钟响应、分片/超长行、连接隔离、过期状态、并发断开、HTTP 来源校验及前端路由/WASM。测试不自动打开真实串口或校时；实际设备与 N100 运行仍需现场验证。
