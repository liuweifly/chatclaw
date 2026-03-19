# OpenClaw Hosted Demo — 产品文档

## 1. 产品定位

一句话：让每个人都能拥有一只持续在线、会干活、有记忆的 AI 龙虾。

不是另一个 ChatGPT 套壳。是一个 hosted AI operator runtime：
- 用户不需要懂技术
- 创建完就能用
- 接到自己真正工作的地方（Telegram / 飞书 / Discord）
- 龙虾有记忆、能执行任务、24/7 在线

## 2. 目标用户

- 创业者 / 独立开发者 / 小团队
- 需要一个持续在线的 AI 助理
- 不想自己搭服务器、配环境
- 愿意为"省时间 + 能干活"付费

## 3. 核心价值主张（vs ChatGPT）

| 能力 | 🦞 Lobster | ChatGPT |
|------|-----------|---------|
| 持久记忆 | ✅ | ❌ |
| 多渠道接入（TG/飞书/Discord） | ✅ | ❌ |
| 24/7 在线 | ✅ | ❌ |
| 执行真实任务 | ✅ | ❌ |
| 多 Agent 协作 | ✅ | ❌ |
| 自托管 / 数据自主 | ✅ | ❌ |
| AI 聊天 | ✅ | ✅ |

## 4. 产品架构

```
用户 → Landing Page → Create My Lobster → Web Chat
                                            ↓
                                     Connect Channels
                                     (TG / 飞书 / Discord)
                                            ↓
                                     Lobster Dashboard
                                     (记忆 / 能力 / 技能 / 配置)
```

### 前端：ChatClaw
- Next.js + Tailwind + shadcn/ui
- 零后端存储（IndexedDB）
- SSE 流式响应
- GitHub: https://github.com/liuweifly/chatclaw

### 后端：OpenClaw Gateway
- 当前直连 Baikal VPS gateway
- 未来通过 ClawHost 管理 bot 生命周期

## 5. 当前进展

### ✅ 已完成
- Landing page（价值主张 + ChatGPT 对比 + 能力展示 + 3 步流程）
- Create my lobster 流程（名字 + 角色 → 自动创建 → 自动进入 chat）
- Web chat（远�� Gateway 接入 + SSE 流式）
- 预设体验任务（Run my day / Stress-test my idea / Ship my demo）
- Multi-agent team（Product Team = Baikal + Coder + Researcher）
- 安全修复（token 不暴露 / restart 不允许网页端触发）
- Agent ID 改成 slug（不再用 UUID）
- Supabase Auth 集成（Google 登录 + email/password）
- Creem 支付集成（checkout API + webhook）
- i18n 中英双语
- 安全加固（SSRF 修复、path traversal 防护、gateway token 不暴露、资源归属检查）

### 🔧 进行中
- TG / 飞书接入 UI
- 记忆面板
- 能力面板
- 技能面板

### ❌ 待做
- 用户系统完善（多设备同步）
- ���费系统（订阅 / 续费）
- ClawHost 后端（K8s 编排 / bot 生命周期管理）
- 用量计量 + 套餐设计

## 6. 线上链接

- Demo: https://chatclaw-liuweiflys-projects.vercel.app
- GitHub: https://github.com/liuweifly/chatclaw (dev branch)

## 7. 用户体验流程

### 第一次访问
1. 打开 Landing page
2. 看到价值主张：「Your AI that actually works」
3. 看到 vs ChatGPT 对比表
4. 看到 6 个核心能力
5. 看到 3 步流程：Name it → Chat with it → Connect channels
6. 点击「Create my lobster」

### 创建龙虾
1. 输入名字
2. 选择角色（General / Research / Builder / Writer / Design）
3. 点击「Create my lobster」
4. 自动创建 workspace + agent
5. 自动进入龙虾的 chat 页面

### 体验价值
1. 看到「[Name] is ready」+ 引导语
2. 点击预设任务按钮（Run my day / Stress-test my idea / Ship my demo）
3. 立刻收到有价值的回复
4. 继续自由对话

### 进阶体验
1. 左侧切换不同 agent（Baikal / Coder / Researcher）
2. 进入 Product Team 体验多 agent 协作
3. 创建自己的新 agent / team

## 8. 下一阶段重点

### Phase 3a（当前）：让 demo 更完整
- Chat 接通真实 AI 后端 ✅
- Landing Page 重做 ✅

### Phase 3b：体验优化
- 新用户 Onboarding 引导
- Profile 编辑
- 移动端基本适配
- 空状态处理

### Phase 3c：商业化
- Creem 支付接通
- Channel 真实接入
- Skills 安装流程

---

*最后更新：2026-03-19*
