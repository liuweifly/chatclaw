# ChatClaw 开发日志

## 产品概述

ChatClaw 是基于 OpenClaw 的 hosted AI agent 产品。用户一键创建自己的 AI "龙虾"，通过 Web/Telegram/飞书/Discord 使用，龙虾有持久记忆、能执行任务、24/7 在线。

## 线上链接

- Demo: https://chatclaw-liuweiflys-projects.vercel.app
- GitHub: https://github.com/liuweifly/chatclaw (dev branch)
- Vercel 项目 ID: prj_Wt1mZyBvFCNBTmrFCxwROIu1HLpd

## 当前架构

- 前端: Next.js + Tailwind + shadcn/ui，部署在 Vercel
- 后��: OpenClaw Gateway（VPS 43.155.164.160:18789）
- 数据库: Supabase（项目 pybhejzztlatsioymwci，Singapore）
- 支付: Creem（测试模式）
- 认证: Supabase Auth + Google OAuth（Nereo GCP 项目 nereo-468106）

## 数据库表结构（Supabase）

- `profiles`: id(FK auth.users), email, name, avatar_url, locale
- `lobsters`: id, user_id(FK profiles), name, role, agent_id, status
- `subscriptions`: id, user_id(FK profiles), plan, status, creem_customer_id, creem_subscription_id, current_period_start/end
- `channels`: id, lobster_id(FK lobsters), type, config(jsonb), status
- RLS 全部启用，用户只能访问自己的数据
- 触发器: auth.users 新增时自动创建 profile + free subscription

## 环境变量

全部存在 Vercel 环境变量中：
- `GATEWAY_URL` / `GATEWAY_TOKEN` — OpenClaw gateway
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase 客户端
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase 服务端
- `CREEM_API_KEY` / `CREEM_WEBHOOK_SECRET` / `CREEM_BASE_URL` / `CREEM_PRODUCT_ID` — Creem 支付
- `AICODEWITH_API_KEY` — AI Chat 后端
- `OPENAI_API_KEY` — 备用

本地 `.env.local` 只需：
```
AICODEWITH_API_KEY=<your-key>
OPENAI_API_KEY=<your-key>
```

---

## 已完成功能

### Phase 1（UI 基础）
- Landing page — Hero + ChatGPT 对比表 + 6 能力卡片 + 3 步流程 + CTA
- Create my lobster 流程 — 名字 + 角色 → 自动创建 → 进入 chat
- Sidebar 龙虾导航 — Overview / Chat / Channels / Skills / Memory / Settings
- Overview 龙虾主页 — 状态卡片 + Quick Actions + 能力列表
- Chat 改进 — 龙虾主动打招呼 + 能力展示型预设按钮（Research/Analyze/Remember）
- Channels / Skills / Memory 独立页面
- Demo agents 默认隐藏（底部有 Show/Hide 开关）
- 安全修复 — token 不暴露、restart 不允许网页端触发
- Agent ID 改成 slug

### Phase 2（认证 + 支付 + i18n）
- Supabase Auth 集成 — Google 登录 + email/password 备选
- Auth Provider — React context 提供 user session
- Auth Modal — 登录弹窗
- Creem 支付集成 — checkout API + webhook 处理
- Pricing 页面 — Free / Pro / Team 三档
- i18n 中英双语 — next-intl，en.json + zh.json
- Settings 页面 — 用户信息 + 当前套餐 + 语言切换 + 登出
- Lobster 数据持久化到 Supabase
- Supabase middleware（session refresh）
- Connect 按钮 Modal 引导

### Phase 2 验收结果（2026-03-19）
- 12/12 测试用例全部 PASS
- 测试账号：461453258@qq.com / 12341234

### 安全加固（2026-03-19）
- Supabase auth token 改用 HttpOnly cookie（不再存 localStorage）
- Gateway token 不再暴露给浏览器（服务端 env only）
- SSRF 修复 — /api/chat 不再接受客户端 gateway URL
- Path traversal 防护 — agent create/delete 严格校验 agentId
- 资源归属检查 — API 路由验证用户权限
- SSR 修复 — browser client 延迟初始化，避免 window is not defined

### Phase 3a（Chat + Landing Page）
- Chat 接通真实 AI 后端（aicodewith Claude Opus，流式响应）
- Landing Page 全新设计（Hero/功能介绍/三步流程/Pricing/Footer）

---

## Phase 3 需求规划 — 从「能看」到「能用」

### 产品现状判断
Phase 2 完成后，ChatClaw 的认证、i18n、数据持久化基础设施已经到位。但从用户视角看，产品还不可用——核心价值（跟 AI lobster 聊天）已经交付（Phase 3a），Landing page 已重做。

### P0 — 不做就不能���人试用
- 3.1 Chat 接通真实 AI 后端 ✅
- 3.2 Landing Page 重做 ✅

### P1 — 试用体验关键
- 3.3 新用户 Onboarding 引导
- 3.4 Profile 编辑
- 3.5 移动端基本适配
- 3.6 空状态处理

### P2 — 商业化准备
- 3.7 Creem 支付接通
- 3.8 Channel 真实接入
- 3.9 Skills 安装流程

### 执行计划
- Phase 3a（已完成）：Chat 接通 + Landing Page 重做
- Phase 3b（下一步）：Onboarding + Profile + 空状态
- Phase 3c（后续）：移动端 + 支付 + 渠道 + 技能

---

## 关键决策

- 用户系统用 Supabase Auth（不自建）
- Google OAuth 用 Nereo GCP 项目（nereo-468106）
- 支付用 Creem（测试模式，product: prod_3anPiH9opJYivargJPlZTV）
- 多租户先走方案 B（共享 gateway），后续付费用户走方案 A（独立实例）
- ��代码全部交 Codex，Baikal 只负责需求/监控/review/验收
- 流程：需求定义 → 测试用例 → 开发 → 产品验收 → 测试 → 上线

## 工作流程备忘

- ChatClaw 代码在 VPS /root/chatclaw/
- Git branch: dev
- npm registry: https://registry.npmmirror.com
- Codex 启动方式: tmux new-session → send-keys codex --full-auto exec '...'
- 部署: git push → Vercel 自动部署 production
- Supabase SQL 执行: POST https://api.supabase.com/v1/projects/pybhejzztlatsioymwci/database/query

---

## 开发复盘：2026-03-19

### 经验教训
1. **角色定位**：架构师/产品经理，不亲自写代码。写代码和测试交给 Codex
2. **验收标准**：必须从用户视角走完整流程，构建真实测试用例
3. **汇报节奏**：每 5-10 分钟主动汇报进度
4. **需求定义**：给 Codex 的需求要精确，包括颜色、风格、API 格式等细节
5. **模型/API 选择**：先确认 API 格式兼容性再动手
6. **Supabase 踩坑**：RLS 开启后 server-side 必须同时传 apikey 和 Authorization header
7. **SSR 踩坑**：browser client 不能在 SSR 时初始化，需要 typeof window guard
8. **测试自动化**：写脚本验证 i18n 完整性比手动检查靠谱

---

*最后更新：2026-03-19*
