# OpenClaw Demo — 需求定义与测试用例

## 产品目标

让用户一键创建自己的 AI 龙虾，立刻体验到价值，并看到龙虾不只是聊天——它能干活、有记忆、接渠道、装技能。

最终目标：用户愿意为此付费。

## 用户角色

- **新用户**：第一次访问，不了解 OpenClaw，不了解"龙虾"概念
- **体验用户**：已创建龙虾，正在探索功能
- **付费用户**（未来）：已决定付费，需要管理自己的龙虾

---

## 核心用户旅程

### 旅程 1：首次访问 → 理解价值

**用户故事**：作为新用户，我打开网站后，应该在 30 秒内理解这个产品是什么、为什么值得用。

**需求**：
- R1.1 Landing page 首屏必须有明确的价值主张
- R1.2 必须讲清楚"为什么不是 ChatGPT"
- R1.3 必须展示核心能力（渠道、记忆、执行、在线、协作、自主）
- R1.4 必须有明确的 CTA 引导用户创建龙虾
- R1.5 页面必须可正常滚动，移动端适配

**测试用例**：

| ID | 场景 | 步骤 | 预期结果 | 状态 |
|----|------|------|----------|------|
| T1.1 | 首屏价值主张 | 打开首页 | 看到主标题 | ✅ |
| T1.2 | ChatGPT 对比 | 向下滚动 | 看到对比表，至少 6 项差异化 | ✅ |
| T1.3 | 能力展示 | 继续滚动 | 看到 6 个能力卡片 | ✅ |
| T1.4 | CTA 可见 | 首屏 | 看到"Create my lobster"按钮 | ✅ |
| T1.5 | 页面滚动 | 鼠标滚轮/触摸滑动 | 页面正常滚动到底部 | ✅ |
| T1.6 | 移动端适配 | 手机浏览器打开 | 布局不破碎，文字可读 | 待测 |

### 旅程 2：创建自己的龙虾

**用户故事**：作为新用户，我点击 CTA 后，应该在 30 秒内创建好自己的龙虾并进入聊天。

**需求**：
- R2.1 点击 CTA 后进入创建流程
- R2.2 创建流程极简：名字 + 可选角色
- R2.3 创建后自动进入龙虾的聊天页面
- R2.4 龙虾出现在左侧 sidebar
- R2.5 创建后有明确的"就绪"反馈

**测试用例**：

| ID | 场景 | 步骤 | 预期结果 | 状态 |
|----|------|------|----------|------|
| T2.1 | CTA 跳转 | 点击"Create my lobster" | 进入 workspace 创建界面 | ✅ |
| T2.2 | 输入名字 | 在 Name 框输入 | 输入正常，无报错 | ✅ |
| T2.3 | 选择角色 | 点击角色 | 角色高亮选中 | ✅ |
| T2.4 | 创建龙虾 | 点击"Create my lobster" | 创建成功，自动进入 chat | ✅ |
| T2.5 | Sidebar 显示 | 创建完成后 | 左侧出现新创建的龙虾 | ✅ |
| T2.6 | 就绪反馈 | 进入 chat 后 | 看到"[Name] is ready" | ✅ |
| T2.7 | 空名字 | 不输入名字直接点创建 | 按钮禁用，无法提交 | ✅ |

### 旅程 3：立刻体验价值

**用户故事**：作为刚创建龙虾的用户，我应该不需要想第一句话就能开始体验。

**需求**：
- R3.1 进入 chat 后有预设任务按钮
- R3.2 点击预设按钮直接发送 prompt
- R3.3 龙虾能正常回复（SSE 流式）
- R3.4 回复内容有价值，不是空话

**测试用例**：

| ID | 场景 | 步骤 | 预期结果 | 状态 |
|----|------|------|----------|------|
| T3.1 | 预设按钮可见 | 进入空 chat | ���到 3 个预设任务按钮 | ✅ |
| T3.2 | 点击预设 | 点击"Run my day" | prompt 自动发送到 chat | ✅ |
| T3.3 | 流式回复 | 发送后等待 | 看到流式文字逐步出现 | ✅ |
| T3.4 | 手动输入 | 在输入框打字并发送 | 正常发送并收到回复 | ✅ |
| T3.5 | 回复质量 | 观察回复内容 | 有结构、有判断、有 next step | 待测 |

### 旅程 4：探索龙虾能力（Dashboard）

**用户故事**：作为体验用户，我想知道我的龙虾还能做什么，不只是聊天。

**需求**：
- R4.1 Chat header 有 Dashboard 入口
- R4.2 Dashboard 有 4 个 tab：Channels / Memory / Capabilities / Skills
- R4.3 Channels 展示已连接和可连接的渠道
- R4.4 Memory 展示记忆类型和说明
- R4.5 Capabilities 展示已激活和未激活的能力
- R4.6 Skills 展示已安装和可安装的技能
- R4.7 点击 Dashboard 按钮可切换回 chat

**测试用例**：

| ID | 场景 | 步骤 | 预期结果 | 状态 |
|----|------|------|----------|------|
| T4.1 | Dashboard 入口 | 进入 chat 后 | header 右侧有 Dashboard 按钮 | ✅ |
| T4.2 | 打开 Dashboard | 点击 Dashboard | 显示 Channels 面板 | ✅ |
| T4.3 | Channels 内容 | 查看 Channels tab | Web Chat=Connected, TG/Feishu/Discord=Available | ✅ |
| T4.4 | Memory 内容 | 点击 Memory tab | 显示 4 种记忆类型 | ✅ |
| T4.5 | Capabilities 内容 | 点击 Capabilities tab | 显示 7 Active + 1 Inactive | ✅ |
| T4.6 | Skills 内容 | 点击 Skills tab | 显示 5 Installed + 3 Available | ✅ |
| T4.7 | 切回 chat | 再次点击 Dashboard | 回到 chat 界面 | ✅ |
| T4.8 | Connect 按钮 | 点击 TG 的 Connect | 弹出连接引导 Modal | ✅ |

### 旅程 5：多 Agent 协作

**用户故事**��作为体验用户，我想看到多个 agent 协作的效果。

**需求**：
- R5.1 左侧有 Team 入口
- R5.2 点击 Team 进入多 agent chat
- R5.3 Team chat 能正常发送和接收
- R5.4 回复能体现多角色协作

**测试用例**：

| ID | 场景 | 步骤 | 预期结果 | 状态 |
|----|------|------|----------|------|
| T5.1 | Team 可见 | 查看左侧 sidebar | 看到 Product Team | ✅ |
| T5.2 | 进入 Team | 点击 Product Team | 进入 team chat | ✅ |
| T5.3 | Team 发消息 | 发送一条消息 | 正常发送并收到回复 | ✅ |
| T5.4 | 多角色回复 | 观察回复 | 能看到不同 agent 的回复 | 待测 |

---

## 待开发需求（下一阶段）

### 旅程 6：渠道真实接入
- R6.1 点击 Connect Telegram 后弹出引导流程
- R6.2 用户输入 bot token 后完成接入
- R6.3 接入后 Channels 面板状态变为 Connected

### 旅程 7：用户系统
- R7.1 注册 / 登录
- R7.2 数据持久化（不依赖 IndexedDB）
- R7.3 多设备同步

### 旅程 8：付费系统
- R8.1 套餐展示
- R8.2 订阅 / 续费
- R8.3 用量计量

---

## 产品审视发现的问题（2026-03-18）

以全新用户视角完整走了一遍产品后，发现以下问题：

| # | 问题 | 优先级 | 建议 |
|---|------|--------|------|
| P1 | 新用户被已有 demo agents 搞懵 | 高 | 新用户首次进入时隐藏预设 demo agents |
| P2 | 两个 CTA 指向同一个地方 | 高 | 统一成一个主 CTA |
| P3 | 没有返回 landing 的入口 | 中 | 左上角 logo 加返回能力 |
| P4 | sidebar 标题对新用户没意义 | 中 | 改成 "My Workspace" |
| P5 | Connect 按钮点了没反应 | 中 | 弹 toast 或 modal | ✅ 已修 |
| P6 | 预设任务按钮描述太长 | 中 | 只显示一句话描述 |
| P7 | Dashboard 按钮不够明显 | 低 | 首次进入时给引导提示 |
| P8 | 没有"创建第二只龙虾"的明显入口 | 低 | sidebar 底部加入口 |
| P9 | Footer 链接到 GitHub | 低 | 改成产品文档 |
| P10 | Landing page 全英文 | 低 | i18n ✅ 已修 |

---

## Dashboard 全流程重新设计（2026-03-18 确认）

### 设计原则
- 用户创建完龙虾后，必须在 2 分钟内感受到"这不是 ChatGPT"
- 网页端定位是龙虾的管理后台，不只是聊天窗口
- 每一步都有明确的引导，用户不需要猜

### Sidebar 重构设计
```
┌──────────────┐
│ 🦞 Atlas     │  ← 龙虾名 + 在线状态
│   Online     │
├──────────────┤
│ 🏠 Overview  │  ← 龙虾主页（状态 + Quick Actions���
│ 💬 Chat      │  ← 聊天
│ 🔗 Channels  │  ← 渠道管理
│ 📦 Skills    │  ← 技能管理
│ 🧠 Memory    │  ← 记忆查看
│ ⚙️ Settings  │  ← 配置
└──────────────┘
```

### Chat 首条消息设计
龙虾主动发送：
> "Hey! I'm [Name], your [role] lobster. I can browse the web, analyze documents, and remember everything we discuss. Try asking me something, or pick a task:"

预设按钮：
- 🔍 Research a topic → 展示搜索能力
- 📄 Analyze a document → 展示文件处理能力
- 🧠 Remember this → 展示记忆能力

### 龙虾主页（Overview）设计
- 状态卡片：在线/离线、已聊天次数、已连接渠道数
- Quick Actions：Connect channel / Add skill / View memory
- 能力概览：7 active capabilities 列表
- 最近活动：最近对话摘要

---

## 验收流程

1. 需求评审：确认需求是否完整、优先级是否正确
2. 开发：按需求实现
3. 产品验收：按测试用例逐条验证
4. 测试：补充边界场景、异常场景
5. 上线：验收 + 测试都通过后部署

---

*最后更新：2026-03-19*
