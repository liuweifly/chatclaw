# ChatClaw Phase 2 测试用例

## TC-01: Google 登录端到端
- 前置：Supabase Google OAuth 已启用，GCP redirect URI 已配置
- 步���：
  1. 打开首页，点击 "Create my lobster"
  2. Auth Modal 弹出，点击 "Continue with Google"
  3. 跳转 Google 授权页，完成授权
  4. 重定向回 /?workspace=1
  5. 检查：用户已登录，Settings 页显示 Google 账号邮箱和头像
  6. 检查：Supabase profiles 表有对应记录
- 验证方式：代码层面检查 auth flow，确保 redirectTo 正确、ensureProfile 逻辑正确
- 自动化测试：写一个测试验证 /api/account 端点在有 session 时返回正确的 profile 结构

## TC-02: Email/Password 注册+登录
- 步骤：
  1. Auth Modal 切换到 Sign up
  2. 输入邮箱和密码，点击 Sign up
  3. 检查：注册成功后自动登录
  4. 登出后重新用同一邮箱密码 Sign in
  5. 检查：登录成功，profile 数据正确
- 自动化测试：写测试调用 Supabase auth API 模拟注册/登录流程

## TC-03: Auth Modal 可关闭
- 步骤：
  1. 进入 workspace（未登录）
  2. Auth Modal 弹出
  3. 点击 Close 按钮 → Modal 关闭，可以浏览工作区
  4. 按 Escape → Modal 关闭
  5. 点击 Pricing 的 Upgrade 按钮 → Auth Modal 重新弹出
- 自动化测试：组件测试验证 onOpenChange 被正确调用

## TC-04: i18n 切换
- 步骤：
  1. 默认英文，检查所有页面文案为英文
  2. Settings → 点击"中文"
  3. 检查所有页面文案切换为中文：
     - 侧边栏导航
     - Overview 页面
     - Chat 欢迎语和预设按钮
     - Channels 页面
     - Skills 页面
     - Memory 页面
     - Pricing 页面
     - Settings 页面
  4. 刷新页面，语言选择保持（localStorage 持久化）
  5. 切回 English，验证恢复
- 自动化测试：检查 en.json 和 zh.json 的 key 完全一致，没有遗漏

## TC-05: i18n JSON 完整性
- 步骤：
  1. 递归对比 en.json 和 zh.json 的所有 key
  2. 确保没有 en 有但 zh 没有的 key（反之亦然）
  3. 检查所有 {variable} 插值在两个文件中一致
- 自动化测试：写脚本递归对比两个 JSON 的 key 结构

## TC-06: Connect 按钮交互
- 步骤：
  1. 进入 Channels 页面
  2. 点击 Telegram 的 Connect → Modal 弹出
  3. 检查：标题 "Connect Telegram"（不是 "Connect {channel}"）
  4. 检查：3 步引导文案中 {channel} 全部替换为 "Telegram"
  5. 点击 "Maybe later" → Modal 关闭
  6. 点击 Feishu 的 Connect → 检查文案替换为 "Feishu"/"飞书"
  7. 点击 "Open settings" → 跳转到 Settings 页面
  8. 中文模式下重复以上步骤，验证中文文案
- 自动化测试：检查 i18n JSON 中 modal 相关 key 的 {channel} 插值格式正确

## TC-07: Pricing 页面
- 步骤：
  1. 检查三档展示：Free / Pro / Team
  2. Free 的按钮显示 "Current plan"（disabled）
  3. Pro 和 Team 的 Upgrade 按钮可点击
  4. 未登录时点击 Upgrade → 弹出 Auth Modal
  5. 中英文切换后文案正确
- 自动化测试：检查 pricing 相关 i18n key 完整

## TC-08: Settings 页面
- 步骤：
  1. 未登录：显示默认用户名，Log out disabled
  2. 已登录：显示邮箱/头像，Log out enabled
  3. 语言切换即时生效
  4. Upgrade plan 按钮可点击
- 自动化测试：/api/account 端点测试

## TC-09: Creem Checkout（仅结构验证）
- 步骤：
  1. 检查 /api/creem/checkout 端点存在且返回正确结构
  2. 检查 /api/creem/webhook 端点能接收 POST 请求
  3. 检查环境变量 CREEM_API_KEY / CREEM_WEBHOOK_SECRET 已配置
  4. 不做真实支付（测试模式变量不完整）
- 自动化测试：curl 测试端点响应

## TC-10: 首页多语言
- 步骤：
  1. 首页有语言切换入口
  2. 点击切换后 Landing page 所有文案变为对应语言
  3. 进入 workspace 后语言保持一致
- 自动化测试：检查 landing page i18n key 完整

## TC-11: Lobster 数据持久化
- 步骤：
  1. 登录后创建 lobster
  2. 刷新页面，lobster 仍然存在
  3. 检查 Supabase lobsters 表有对应记录
  4. 登出后重新���录，lobster 数据恢复
- 自动化测试：/api/lobsters 端点测试

## TC-12: Build 和 Lint
- 步骤：
  1. pnpm lint 无错误
  2. pnpm build 成功
  3. TypeScript 无类型错误
- 自动化测试：CI 级别检查
