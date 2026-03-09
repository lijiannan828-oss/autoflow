# AutoFlow v2.2 基础设施架构文档

> 运维 Agent 产出 — O1 资源盘点 + 架构设计
> 日期：2026-03-10
> 状态：Day 1 盘点完成

---

## 1. VKE 集群拓扑

### 集群信息

| 项目 | 值 |
|------|---|
| 集群名 | autoflow-vke-dev |
| 集群 ID | cd6lemn5hkhgsuq13lmbg |
| K8s 版本 | v1.34.1-vke.4 |
| CNI | Cilium (Cello) |
| Container Runtime | containerd 1.6.38-vke.17 |
| API Server (公网) | https://14.103.133.15:6443 |
| API Server (内网) | https://10.0.0.113:6443 |

### 节点清单

| 节点 IP | 角色 | 规格 | 可用区 | 子网 | GPU | 状态 |
|---------|------|------|--------|------|-----|------|
| 10.0.0.116 | Worker | 2 vCPU / 8GB | cn-shanghai | VPC vpc-3i64...（主子网） | 无 | Ready |
| 10.0.0.117 | Worker | 2 vCPU / 8GB | cn-shanghai | VPC vpc-3i64...（主子网） | 无 | Ready |
| 10.1.11.110 | GPU | 128 CPU / 2TB RAM / ecs.ebmhpcpni2l.32xlarge | cn-shanghai-b | HPC 集群子网 | **A800-SXM4-80GB × 8** | Ready |

### GPU 节点详细资源

```
Capacity:
  cpu:             128
  memory:          ~2TB
  nvidia.com/gpu:  8
  pods:            211
Allocatable:
  cpu:             125.6
  nvidia.com/gpu:  8
```

- **Taints**: 无（任何 Pod 都可调度到 GPU 节点）
- **Labels**: `machine.cluster.vke.volcengine.com/gpu-name=NVIDIA-A800-SXM4-80GB`
- **nvidia-device-plugin**: Running
- **dcgm-exporter**: Running（GPU 指标导出可用）

---

## 2. 网络状态（⚡ 关键发现）

### 2.1 跨子网连通性

| 路径 | 状态 | 说明 |
|------|------|------|
| 跳板机 → GPU 节点 (10.1.11.110) | ✅ 通 | 延迟 ~1ms |
| 跳板机 → Worker 节点 (10.0.0.116/117) | ✅ 通 | 延迟 <0.3ms |
| **Pod(GPU节点) → Pod(Worker节点)** | **✅ 通** | K8s overlay 网络已处理跨子网路由 |
| **Pod(GPU节点) → K8s Service DNS** | **✅ 通** | CoreDNS 解析正常 |
| Pod → 公网 (任意节点) | ❌ 不通 | 所有节点 Pod 无法访问公网，需 NAT 网关 |
| GPU 节点 → Docker Hub | ❌ 不通 | DNS 被污染（解析到 Facebook IP），且无公网出口 |
| GPU 节点 → VKE 内部 CR | ⚠️ 慢但通 | vke-cn-shanghai.cr.volces.com 偶尔超时/429限流，最终成功 |
| GPU 节点 → 自定义 CR | ✅ 通 | autoflow-cn-shanghai.cr.volces.com 可拉取（aigc-backend/front 已证实） |

### 2.2 关键结论

1. **跨子网 Pod-to-Pod 通信已自动打通** — Cilium/Cello overlay 网络处理了 10.0.0.x ↔ 10.1.11.x 路由，O2 任务中最担心的跨子网问题**已解决**
2. **GPU 节点不能拉 Docker Hub 镜像** — 所有部署必须使用：
   - 火山引擎 VKE 内部 CR（`vke-cn-shanghai.cr.volces.com`）
   - 自定义 CR（`autoflow-cn-shanghai.cr.volces.com`）
   - 或预先构建推送到自定义 CR 的镜像
3. **Pod 无公网出口** — 需在 VPC 配置 NAT 网关，或模型下载通过跳板机 SSH 隧道/节点 hostNetwork 方式绕行

### 2.3 SSH 访问

| 目标 | 可达 | 说明 |
|------|------|------|
| 跳板机 (118.196.103.136) | ✅ | `autoflow.pem` 密钥 |
| GPU 节点 (10.1.11.110) | ❌ | 无 SSH 密钥，HPC 裸金属可能使用 VKE 管理密钥 |
| Worker 节点 | 未测试 | 可能同样受限 |

> **对策**：GPU 节点操作使用 `kubectl exec` 进入 Pod，或 `kubectl debug node/` 挂载宿主机文件系统。模型下载需要从有公网的跳板机发起。

---

## 3. 存储状态

### 3.1 StorageClass

| 名称 | Provisioner | ReclaimPolicy | BindingMode | 说明 |
|------|-------------|---------------|-------------|------|
| `ebs-ssd` | ebs.csi.volcengine.com | Delete | WaitForFirstConsumer | 默认可用 |

### 3.2 CSI 驱动状态

| 组件 | GPU 节点状态 | 说明 |
|------|-------------|------|
| csi-ebs-node | ✅ 3/3 Running | 初始有 ImagePull 问题，重试后恢复（7 restarts） |
| csi-nas-node | ✅ 3/3 Running | 同上（5 restarts） |
| csi-ebs-controller | ✅ 6/6 Running | 在 worker 节点 |

> **O3 结论：csi-ebs 已自行恢复**，不需要额外修复。但 GPU 节点镜像拉取偶尔不稳定（限流/超时），部署时需考虑重试策略。

### 3.3 PV/PVC

| PVC | 大小 | StorageClass | 状态 |
|-----|------|-------------|------|
| qdrant-data-qdrant-0 | 20Gi | ebs-ssd | Bound (StatefulSet VCT) |

---

## 4. 已部署服务

### 4.1 业务服务

| Deployment/StatefulSet | 副本 | 节点 | Service 类型 | 端口 | 状态 |
|----------------------|------|------|-------------|------|------|
| aigc-backend | 1 | 10.1.11.110 (GPU) | LoadBalancer | 14.103.193.254:80 | ✅ Running |
| aigc-front | 1 | 10.1.11.110 (GPU) | LoadBalancer | 180.184.182.10:80 | ✅ Running |
| nginx | 2 | 10.0.0.116 + 117 | LoadBalancer | 118.196.108.228:80 | ✅ Running |
| **qdrant** (StatefulSet) | 1 | 10.0.0.117 | ClusterIP | 6333/6334 | ✅ Running |
| **rocketmq-namesrv** | 1 | 10.0.0.116 | ClusterIP | 9876 | ✅ Running |
| **rocketmq-broker** | 1 | 10.1.11.110 (GPU) | ClusterIP | 10911/8081 | ✅ Running |
| **ingress-nginx-controller** | 1 | 10.0.0.117 | NodePort | 30080/30443 | ✅ Running |
| **comfyui** | 1 | 10.1.11.110 (GPU) | ClusterIP | 8188 | ✅ Running |
| **bastion-gateway** | 1 | 10.0.0.116 | ClusterIP | 5432/8443/8444 | ✅ Running |

> **注意**：aigc-backend/front/rocketmq-broker 被调度到了 GPU 节点（因为 GPU 节点无 taint 且资源充裕）。生产环境应添加 taint 防止非 GPU 工作负载调度。
> **bastion-gateway** 通过 SSH 隧道将 PG RDS / TOS / LLM API 流量经跳板机 (10.0.0.109) 转发到公网。

### 4.2 系统服务

| 组件 | 状态 | 说明 |
|------|------|------|
| CoreDNS | ✅ 2 副本 | 正常 |
| metrics-server | ✅ | 正常 |
| nvidia-device-plugin | ✅ | GPU 资源可调度 |
| dcgm-exporter | ✅ | GPU 指标 :9400/metrics |
| snapshot-controller | ✅ | VolumeSnapshot 可用 |

### 4.3 命名空间

| 命名空间 | 用途 |
|---------|------|
| default | 当前业务服务（迁移计划：移至 autoflow-dev） |
| autoflow-dev | 目标命名空间（已创建，空） |
| kube-system | 系统组件 |

---

## 5. 外部服务连接

| 服务 | 端点 | 从 Pod 可达 | 说明 |
|------|------|-----------|------|
| PostgreSQL RDS | bastion-gateway.default.svc:5432 → 118.196.75.55:5432 | **✅ 已通** | 通过 bastion-gateway SSH 隧道转发 |
| Redis | redis-shzlsorkckr13iz1a.redis.ivolces.com:6379 | **✅ 已验证** | 内网端点，连接正常 |
| TOS | bastion-gateway.default.svc:8443 → tos-cn-shanghai.volces.com:443 | **✅ 已通** | 通过 bastion-gateway SSH 隧道转发 |
| CR | autoflow-cn-shanghai.cr.volces.com | ✅ 已验证 | 镜像拉取正常 |
| Qdrant (集群内) | qdrant.default.svc:6333 | ✅ 已验证 | healthz OK, autoflow_rag 集合已创建 |
| RocketMQ (集群内) | rocketmq-namesrv.default.svc:9876 | ✅ 已验证 | 通过 readinessProbe 确认 |
| LLM API | bastion-gateway.default.svc:8444 → www.dmxapi.cn:443 | **✅ 已通** | 通过 bastion-gateway SSH 隧道转发 |

> **✅ 公网连通性已解决** — 通过 `bastion-gateway` Pod（SSH 隧道经跳板机 10.0.0.109）转发 PG RDS、TOS、LLM API 流量。
> 跳板机安全组仅开放 22 端口，因此采用 SSH -L 端口转发方案。
> 生产环境建议：仍应配置 NAT 网关或 RDS 私有端点，以消除对跳板机的单点依赖。

---

## 6. 缺失组件（本次部署目标）

| 组件 | 优先级 | 部署位置 | 镜像来源策略 |
|------|--------|---------|-------------|
| Qdrant | ⚡ P0 | GPU 节点或 Worker | 推送到自定义 CR |
| RocketMQ | ⚡ P0 | Worker 节点 | 推送到自定义 CR |
| ComfyUI | ⚡ P0 | GPU 节点 | 自建镜像推送到 CR |
| Helm | P1 | 本地 + 集群 RBAC | kubectl 安装 |
| Ingress Controller | P1 | Worker 节点 | VKE 内部 CR 或自定义 CR |
| Prometheus + Grafana | P2 (Day 3) | Worker 节点 | 推送到 CR |

---

## 7. 镜像部署策略

由于 GPU 节点无法拉取 Docker Hub 镜像，所有部署遵循以下流程：

```
本地/跳板机 docker pull → docker tag → docker push autoflow-cn-shanghai.cr.volces.com/autoflow/<image>
  → K8s Deployment 使用 CR 镜像 + imagePullSecrets: volc-cr-secret
```

所需推送镜像清单：
- `qdrant/qdrant:latest` → `autoflow CR/autoflow/qdrant:latest`
- `apache/rocketmq:5.3.1` → `autoflow CR/autoflow/rocketmq:5.3.1`
- `comfyui` (自建) → `autoflow CR/autoflow/comfyui:latest`
- `nginx/nginx-ingress` → `autoflow CR/autoflow/nginx-ingress:latest`
- `prom/prometheus` + `grafana/grafana` (Day 3)

---

## 8. 模型下载策略

GPU 节点无公网出口，模型下载策略：

**方案 A（推荐）：跳板机下载 + SCP 到 GPU 节点**
- 问题：无 GPU 节点 SSH 密钥

**方案 B：通过 K8s Job + hostPath 挂载**
- 创建一个有公网代理的 init container
- 或者用跳板机做 HTTP 代理

**方案 C（最可行）：利用跳板机做 SOCKS/HTTP 代理**
1. 跳板机有公网访问能力
2. 在跳板机上启动代理服务（如 squid）
3. GPU 节点上的下载 Pod 通过代理下载模型

**方案 D：火山引擎 TOS 中转**
1. 跳板机下载模型 → 上传到 TOS
2. GPU Pod 从 TOS 内网下载

> 优先评估方案 D（TOS 中转），带宽最优且不依赖 SSH。

---

## 9. Day 1 执行优先级调整

基于盘点结果，原计划调整：

| 原任务 | 状态 | 调整 |
|--------|------|------|
| O2 GPU 网络打通 | ✅ **已自动解决** | Cilium overlay 已处理跨子网，无需手动配置 |
| O3 csi-ebs 修复 | ✅ **已自行恢复** | 3/3 Running，偶尔镜像拉取慢但可用 |
| O4 Helm + Ingress | 调整 | 先推镜像到 CR，再部署 |
| O5 Qdrant | 调整 | 需先推镜像到 CR |
| O6 RocketMQ | 调整 | 需先推镜像到 CR |
| O7 ComfyUI | 调整 | 需自建镜像 + GPU nodeSelector |
| **新增** | 镜像推送 | 在跳板机上拉取镜像并推送到 CR |
| **新增** | NAT 网关/代理 | 评估 Pod 公网出口方案 |

---

## 10. 安全注意事项

- CR Secret (`volc-cr-secret`) 已在 default 命名空间配置
- autoflow-dev 命名空间有 `cr-pull-secret`
- 部署新服务时需确保引用正确的 imagePullSecrets
- GPU 节点无 taint，需为生产环境添加 taint 防止非 GPU 工作负载调度
