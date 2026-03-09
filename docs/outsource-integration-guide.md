# AutoFlow 外包接入文档（精简版）

本文档只保留外包执行所需的最小信息，不包含私网地址、实例 ID、AK/SK 等内部信息。

## 1. 接入目标

- 推送镜像到 CR
- 部署到 VKE `autoflow-dev` 命名空间
- 应用连接 Redis

## 1.1 当前环境状态（已就绪）

- VKE 公网 API 可达，`autoflow-dev` 命名空间已创建。
- CoreDNS 已恢复为 `2/2 Running`。
- Redis 公网地址可认证连通（`PONG` 已验证）。
- `autoflow-dev` 已配置默认 `imagePullSecret=cr-pull-secret`，Pod 可直接拉取 CR 私有镜像。
- CR 仓库已创建：
  - `autoflow/review-workflow-api`
  - `autoflow/review-workflow-web`

## 2. 对外提供信息（最小集）

### 2.1 CR（镜像仓库）

- `CR_REGISTRY=autoflow-cn-shanghai.cr.volces.com`
- `CR_NAMESPACE=autoflow`
- `CR_REPOSITORY_API=review-workflow-api`
- `CR_REPOSITORY_WEB=review-workflow-web`
- `CR_USERNAME=AIGC-Nebula@2102718571`
- `CR_PASSWORD=Luxi2026`

镜像全路径：
- `autoflow-cn-shanghai.cr.volces.com/autoflow/review-workflow-api`
- `autoflow-cn-shanghai.cr.volces.com/autoflow/review-workflow-web`

### 2.2 VKE（Kubernetes）

- `K8S_API_SERVER=https://14.103.133.15:6443`
- `K8S_NAMESPACE=autoflow-dev`
- `KUBECONFIG_FILE=<单独下发：autoflow-vke-dev-public.kubeconfig>`

如果外网访问 API Server 卡顿，改走内网跳板机（同 VPC ECS）：

- `ECS_BASTION_PUBLIC_IP=118.196.103.136`
- `ECS_BASTION_PRIVATE_IP=10.0.0.109`
- `ECS_BASTION_SSH_USER=root`

### 2.3 Redis

- `REDIS_HOST=redis-shzlsorkckr13iz1a.redis.volces.com`
- `REDIS_PORT=6379`
- `REDIS_DB=0`
- `REDIS_USERNAME=outsource`
- `REDIS_PASSWORD=AutoFlowRedis2026`

## 3. 外包执行命令

### 3.1 登录并推送镜像

```bash
docker login "$CR_REGISTRY" -u "$CR_USERNAME" -p "$CR_PASSWORD"

docker build -t review-workflow-api:latest .
docker tag review-workflow-api:latest "$CR_REGISTRY/$CR_NAMESPACE/$CR_REPOSITORY_API:latest"
docker push "$CR_REGISTRY/$CR_NAMESPACE/$CR_REPOSITORY_API:latest"

docker build -t review-workflow-web:latest .
docker tag review-workflow-web:latest "$CR_REGISTRY/$CR_NAMESPACE/$CR_REPOSITORY_WEB:latest"
docker push "$CR_REGISTRY/$CR_NAMESPACE/$CR_REPOSITORY_WEB:latest"
```

注意：当前仓库初始为空，外包需先完成首次 `docker push`，后续 Kubernetes 才能成功拉取该镜像 tag。

### 3.2 连接集群并部署

```bash
export KUBECONFIG=/path/to/autoflow-vke-dev-public.kubeconfig
kubectl config current-context
kubectl get nodes
kubectl get ns
kubectl create ns autoflow-dev || true
kubectl -n autoflow-dev apply -f k8s/
kubectl -n autoflow-dev get pods
```

如需对外暴露 HTTP，请使用 `Service type=LoadBalancer`，并显式带上以下注解：

```yaml
metadata:
  annotations:
    service.beta.kubernetes.io/volcengine-loadbalancer-address-type: "internet"
```

说明：
- 创建过程中出现 `lb is provisioning` 属于正常中间态，等待几十秒即可。
- 如果 `EXTERNAL-IP` 长时间 `<pending>`，优先检查是否使用了上面的注解键和值。

（可选）公网卡顿时，通过跳板机执行：

```bash
ssh root@118.196.103.136
# 在跳板机中使用私网 kubeconfig 执行 kubectl
```

### 3.3 Redis 连通性测试

```bash
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" --user "$REDIS_USERNAME" -a "$REDIS_PASSWORD" ping
```

预期返回：`PONG`

## 4. 你不需要给外包的内容

- 私网 API Server 地址（`10.x`）
- 各类实例 ID / VPC / 子网 ID
- 主账号登录信息
- 任何 AK/SK

## 5. 常见问题

- `docker login` 401：优先核对账号密码是否最新，或确认仓库地址为 `autoflow-cn-shanghai.cr.volces.com`。
- `kubectl` 超时：确认外包网络可访问 `14.103.133.15:6443`。
- Redis 认证失败：确认下发的是最新账号密码，而不是历史值。
