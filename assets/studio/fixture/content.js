/**
 * content.js —— 夹具的唯一内容源。
 *
 * 所有视图（dashboard / settings / form / ai / components）都从这里取文案与数据。
 * 变体只能改 CSS，不能改这里的结构；改文案只改这个文件。
 * 纯数据，不 import 任何东西。
 */

/* --------------------------------------------------------------------------
   行内图标：24×24 线性图标，路径是内容的一部分（与文案同源）。
   视图通过 icon("search") 生成 <svg class="ico …">，不引入图标库。
   -------------------------------------------------------------------------- */

const iconPaths = {
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  edit: '<path d="M5 19h4l9.5-9.5a2.1 2.1 0 0 0-3-3L6 16v3Z"/><path d="M4 21h16"/>',
  spark: '<path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9 12 3.5Z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/><path d="m3 17.5 9 5 9-5"/>',
  search: '<circle cx="11" cy="11" r="6.2"/><path d="m16 16 4 4"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  download: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
  up: '<path d="m6 14 6-6 6 6"/>',
  down: '<path d="m6 10 6 6 6-6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 6.5"/>',
  alert: '<path d="M12 4 3 20h18L12 4Z"/><path d="M12 10v4.5"/><circle cx="12" cy="17.4" r=".6" fill="currentColor" stroke="none"/>',
  info: '<circle cx="12" cy="12" r="8"/><path d="M12 11v5"/><circle cx="12" cy="8.2" r=".7" fill="currentColor" stroke="none"/>',
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
  inbox: '<path d="M4 13.5 6 5h12l2 8.5"/><path d="M4 13.5h4.5l1.5 2.5h4l1.5-2.5H20V19H4v-5.5Z"/>',
  terminal: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="m7.5 9 3 3-3 3M13 15h4"/>',
  send: '<path d="M4 12 20 4l-4 16-4.5-6.5L4 12Z"/>',
  trash: '<path d="M5 7h14"/><path d="M9.5 7V5h5v2"/><path d="m7 7 .8 13h8.4L17 7"/><path d="M10.5 11v5M13.5 11v5"/>',
  moon: '<path d="M20 13.5A8 8 0 1 1 10.5 4a6.4 6.4 0 0 0 9.5 9.5Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  external: '<path d="M14 5h5v5"/><path d="m19 5-8 8"/><path d="M18 14v5H5V6h5"/>',
  refresh: '<path d="M19 12a7 7 0 1 1-2.4-5.3"/><path d="M19 4v5h-5"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
};

export function icon(name, className = "ico") {
  const path = iconPaths[name] || iconPaths.info;
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${path}</svg>`;
}

export const brand = {
  name: "Northwind",
  product: "运营控制台",
  workspace: "产品设计组",
  user: { name: "林知远", role: "管理员", initials: "林" },
};

export const nav = [
  { id: "dashboard", label: "总览", icon: "grid", hint: "今日概况" },
  { id: "settings", label: "设置", icon: "sliders", hint: "偏好与账号" },
  { id: "form", label: "发布活动", icon: "edit", hint: "新建一条活动" },
  { id: "ai", label: "智能助理", icon: "spark", hint: "对话与工具" },
  { id: "components", label: "组件架", icon: "layers", hint: "状态与变体" },
];

export const topbar = {
  title: "Northwind 运营控制台",
  subtitle: "本周留存与转化概览",
  searchPlaceholder: "搜索活动、成员或报表…",
  timerLabel: "本次会话已进行",
  timerStart: 12 * 60 + 47, // 00:12:47 起始，每秒 +1
  actions: { primary: "新建活动", secondary: "导出报表" },
};

export const dashboard = {
  eyebrow: "第 44 周 · 周一",
  heading: "早上好，知远。",
  lede: "上周的新用户留存比前一周高出 2.4 个百分点，但注册到首单的转化在周五出现了回落。",
  range: { label: "近 14 天", options: ["近 7 天", "近 14 天", "近 30 天"] },
  stats: [
    {
      id: "retention",
      label: "次日留存",
      value: "42.8%",
      delta: "+2.4pp",
      trend: "up",
      note: "对比前一周",
      spark: [38, 39, 38, 40, 41, 40, 42, 41, 43, 42, 43, 44, 43, 42.8],
    },
    {
      id: "conversion",
      label: "注册转化",
      value: "18.6%",
      delta: "−1.1pp",
      trend: "down",
      note: "周五起回落",
      spark: [21, 20.5, 20.8, 20.1, 19.8, 20, 19.4, 19.1, 19.2, 18.9, 18.7, 18.8, 18.5, 18.6],
    },
    {
      id: "revenue",
      label: "月度经常性收入",
      value: "¥ 386,400",
      delta: "+6.2%",
      trend: "up",
      note: "对比上月同期",
      spark: [312, 318, 322, 329, 331, 338, 340, 347, 352, 358, 361, 370, 378, 386],
    },
    {
      id: "tickets",
      label: "待处理工单",
      value: "27",
      delta: "−8",
      trend: "down-good",
      note: "平均响应 2.1 小时",
      spark: [48, 46, 44, 45, 41, 40, 38, 39, 36, 34, 33, 31, 29, 27],
    },
  ],
  surfaces: {
    title: "表面阶梯",
    lede: "四层表面叠加。相邻层 ΔL 为 0.010 / 0.015 / 0.017，肉眼几乎不可分，但仍可辨认。",
    layers: [
      {
        level: 1,
        token: "--surface-1",
        delta: "0.010",
        title: "页面底色之上的第一层",
        body: "承载整页级别的分区。与页面底只差 1 个百分点的明度，靠留白而不是边框划分。",
      },
      {
        level: 2,
        token: "--surface-2",
        delta: "0.015",
        title: "卡片内部的区块",
        body: "同一张卡片内需要再分层时使用，例如指标卡里的对比区块。",
      },
      {
        level: 3,
        token: "--surface-3",
        delta: "0.017",
        title: "浮层与最上层表面",
        body: "下拉、气泡、悬浮工具条。再叠加就该用阴影，而不是继续提亮。",
      },
    ],
    footNote: "描边不参与层级：--line-1 是独立阶梯，不随表面变化。",
  },
  timeline: {
    title: "本周关键节点",
    items: [
      { time: "09:20", title: "结算延迟已恢复", body: "支付网关在 08:40–09:05 之间出现超时，已回滚到上一版路由。", tone: "warn" },
      { time: "11:05", title: "新版引导页上线 20%", body: "面向新注册用户，观察三天后再决定是否全量。", tone: "ok" },
      { time: "14:30", title: "周会：留存归因", body: "需要准备渠道维度的拆分，重点看内容推荐带来的自然流量。", tone: "info" },
      { time: "17:00", title: "发布窗口冻结", body: "本周剩余时间只接受修复类变更。", tone: "neutral" },
    ],
  },
  empty: {
    title: "还没有自定义报表",
    body: "把你常看的指标固定到这里，下次打开就能直接看到，不必重新筛选。",
    action: "创建第一份报表",
    hint: "支持从总览、漏斗、留存三类模板开始。",
  },
  error: {
    title: "数据源暂时不可用",
    body: "「渠道归因」数据集在 14:02 响应超时，我们正在重试。其他指标不受影响。",
    action: "重新加载",
    detail: "错误码 UPSTREAM_TIMEOUT · 请求 id 7c1f-3a92",
  },
};

export const settings = {
  heading: "偏好设置",
  lede: "这些设置只对当前账号生效。团队级别的策略在「组织管理」里统一配置。",
  groups: [
    {
      id: "appearance",
      title: "外观",
      rows: [
        {
          id: "theme",
          name: "主题",
          desc: "跟随系统，或固定为浅色 / 深色。",
          control: "select",
          value: "跟随系统",
          options: ["跟随系统", "浅色", "深色"],
        },
        {
          id: "accent",
          name: "强调色",
          desc: "用于按钮、链接与焦点环，不影响状态色。",
          control: "swatch",
          swatches: ["1", "2", "3", "4"],
          selected: "1",
        },
        {
          id: "density",
          name: "界面密度",
          desc: "紧凑模式会压缩表格与列表的行高。",
          control: "select",
          value: "标准",
          options: ["紧凑", "标准", "宽松"],
        },
      ],
    },
    {
      id: "language",
      title: "语言与地区",
      rows: [
        {
          id: "language",
          name: "界面语言",
          desc: "更改后需要重新加载页面。",
          control: "select",
          value: "简体中文",
          options: ["简体中文", "繁體中文", "English", "日本語"],
        },
        {
          id: "timezone",
          name: "时区",
          desc: "报表与活动时间按此时区显示。",
          control: "select",
          value: "(UTC+08:00) 北京",
          options: ["(UTC+08:00) 北京", "(UTC+09:00) 东京", "(UTC+00:00) 伦敦", "(UTC−08:00) 洛杉矶"],
        },
      ],
    },
    {
      id: "notifications",
      title: "通知",
      rows: [
        {
          id: "desktop",
          name: "桌面通知",
          desc: "浏览器在前台时也会弹出，适合值班同学。",
          control: "switch",
          checked: true,
        },
        {
          id: "digest",
          name: "每日摘要邮件",
          desc: "每天 09:00 汇总昨天的核心指标，只发一封。",
          control: "switch",
          checked: true,
        },
      ],
    },
    {
      id: "editor",
      title: "编辑器",
      rows: [
        {
          id: "autosave",
          name: "自动保存",
          desc: "停止输入 3 秒后保存草稿。",
          control: "switch",
          checked: true,
        },
        {
          id: "spellcheck",
          name: "拼写检查",
          desc: "只检查拉丁文字，中文内容不参与。",
          control: "switch",
          checked: false,
        },
        {
          id: "shortcuts",
          name: "启用 Vim 快捷键",
          desc: "在富文本编辑器中启用 hjkl 移动与命令行。",
          control: "switch",
          checked: false,
        },
      ],
    },
    {
      id: "security",
      title: "安全",
      rows: [
        {
          id: "twofa",
          name: "两步验证",
          desc: "使用身份验证器应用，每 30 秒生成一次。",
          control: "status",
          status: "已开启",
          tone: "ok",
          action: "重新配置",
        },
        {
          id: "sessions",
          name: "登录设备",
          desc: "当前有 3 台设备保持登录状态。",
          control: "status",
          status: "3 台设备",
          tone: "neutral",
          action: "管理",
        },
      ],
    },
    {
      id: "danger",
      title: "危险操作",
      tone: "danger",
      isolated: true,
      rows: [
        {
          id: "delete-account",
          name: "删除账号",
          desc: "账号与全部历史数据将被永久删除，此操作不可撤销。",
          control: "button",
          action: "删除账号",
          tone: "danger",
        },
      ],
    },
  ],
};

export const form = {
  heading: "发布活动",
  lede: "填写基本信息后可以存为草稿。带「必填」标记的字段会在提交时校验。",
  fields: [
    {
      id: "title",
      label: "活动名称",
      type: "text",
      required: true,
      value: "秋季新客首单礼",
      placeholder: "例如：秋季新客首单礼",
      help: "最多 40 个字，会在活动列表与推送标题中显示。",
    },
    {
      id: "audience",
      label: "投放人群",
      type: "select",
      required: true,
      value: "近 90 天注册且未下单",
      options: ["全部用户", "近 90 天注册且未下单", "近 30 天有过浏览", "已下单用户（复购）"],
      help: "人群包每天 04:00 刷新，活动开始后不再变动。",
    },
    {
      id: "start-date",
      label: "开始日期",
      type: "date",
      required: false,
      value: "2026-11-08",
      help: "从当天 00:00 起生效，时区为账号所在时区。",
      error: "开始日期不能早于今天（2026-11-01）。",
      invalid: true,
    },
    {
      id: "description",
      label: "活动说明",
      type: "textarea",
      required: false,
      value:
        "面向近三个月注册但尚未下单的新用户，首单立减 30 元，可与店铺券叠加。活动期间每个账号限用一次。",
      placeholder: "写下活动规则、门槛与例外情况…",
      help: "支持 Markdown。这段说明会同时展示在活动页与客服话术中。",
    },
    {
      id: "notify",
      label: "开始前 1 小时通知我",
      type: "switch",
      required: false,
      checked: true,
      help: "通知发送到桌面与绑定邮箱，活动开始后不再重复提醒。",
    },
    {
      id: "terms",
      label: "我确认活动规则符合平台规范",
      type: "checkbox",
      required: true,
      checked: false,
      help: "提交前请阅读《促销活动规范》第 3 节关于价格保护的要求。",
      error: "需要勾选此项才能发布活动。",
      invalid: true,
    },
  ],
  actions: { primary: "发布活动", secondary: "存为草稿" },
  aside: {
    title: "填写提示",
    items: [
      "活动名不要包含「最」「第一」等绝对化用语。",
      "日期格式为年-月-日，跨时区投放请单独说明。",
      "说明中的优惠门槛要和结算系统里的配置一致。",
    ],
  },
};

export const ai = {
  heading: "智能助理",
  lede: "可以询问指标、生成筛选条件，或让它代你执行只读查询。",
  suggestions: ["上周留存下滑的原因是什么？", "帮我写一条召回短信", "把转化漏斗导出为表格"],
  messages: [
    {
      id: "m1",
      role: "user",
      text: "上周的次日留存为什么比前一周低？帮我看一下渠道维度。",
    },
    {
      id: "m2",
      role: "assistant",
      think: {
        title: "正在分析",
        meta: "读取 3 个数据集 · 1.2 秒",
        body: [
          "先确认口径：次日留存按注册当天为 cohort 第一天计算，排除内部测试账号。",
          "再拆渠道：自然流量、内容推荐、付费投放、合作导流四个来源。",
          "对比两周同名渠道，剔除样本量小于 200 的组，避免小样本噪声。",
        ],
      },
      tools: [
        { name: "query_metrics", arg: "retention_d1 · 分组 channel · 14 天", status: "完成", state: "ok" },
        { name: "compare_periods", arg: "第 43 周 vs 第 44 周", status: "完成", state: "ok" },
      ],
      body: [
        "整体下滑主要来自「内容推荐」渠道，D1 从 46.2% 降到 41.9%，贡献了全部降幅的八成。另外三个渠道基本持平。",
        "内容推荐渠道在 10 月 26 日切换了推荐模型，新模型把更多流量分给了泛兴趣内容，注册用户的意图强度下降。这不是产品体验的问题。",
        "建议先看两件事：一是把新模型的冷启动样本单独拉出来，二是对比新老模型下新用户的首日浏览深度。",
      ],
      refs: [
        { label: "留存看板 · 渠道拆分", meta: "更新于 09:12" },
        { label: "推荐模型上线记录", meta: "10 月 26 日" },
      ],
      more: "还需要我把新老模型的 cohort 曲线叠在一张图里吗？",
    },
  ],
  composer: {
    placeholder: "问一个问题，或输入 / 查看可用工具…",
    hint: "Enter 发送 · Shift + Enter 换行",
    send: "发送",
    streamingText:
      "我把内容推荐渠道按新老模型拆开看了：新模型组 D1 为 41.6%，老模型组为 46.8%，差额与整体降幅吻合。泛兴趣内容的注册用户首日停留短了 38 秒，浏览深度从 3.4 页降到 2.1 页。建议先把泛兴趣内容的冷启动样本剔除再评估模型本身。",
  },
};

export const components = {
  heading: "组件架",
  lede: "按钮 5 个变体 × 6 个状态，外加输入框、开关、标签与徽章。所有视觉值来自 token。",
  buttonVariants: [
    { id: "primary", label: "主要" },
    { id: "secondary", label: "次要" },
    { id: "ghost", label: "幽灵" },
    { id: "danger", label: "危险" },
    { id: "link", label: "链接" },
  ],
  buttonStates: [
    { id: "default", label: "默认" },
    { id: "hover", label: "悬停", forced: "hover" },
    { id: "focus", label: "聚焦", forced: "focus" },
    { id: "active", label: "按下", forced: "active" },
    { id: "disabled", label: "禁用" },
    { id: "loading", label: "加载中", loading: true },
  ],
  buttonText: "保存更改",
  inputs: [
    { id: "in-default", label: "默认", value: "", placeholder: "请输入项目名称" },
    { id: "in-filled", label: "已填写", value: "Northwind 运营控制台" },
    { id: "in-invalid", label: "错误", value: "admin@", error: "邮箱格式不完整。" },
    { id: "in-disabled", label: "禁用", value: "只读字段", disabled: true },
  ],
  switches: [
    { id: "sw-on", label: "已开启", checked: true },
    { id: "sw-off", label: "已关闭", checked: false },
    { id: "sw-locked", label: "强制开启", checked: true, disabled: true },
  ],
  tags: [
    { label: "进行中", tone: "accent" },
    { label: "草稿", tone: "neutral" },
    { label: "已结束", tone: "muted" },
    { label: "高优先级", tone: "danger" },
    { label: "已验证", tone: "ok" },
  ],
  badges: [
    { label: "3", tone: "danger" },
    { label: "12", tone: "accent" },
    { label: "新", tone: "ok" },
    { label: "Beta", tone: "neutral" },
  ],
  tokens: [
    { name: "--s-5", value: "24px", role: "字段间距 / 卡片内边距" },
    { name: "--r-md", value: "10px", role: "卡片 / 输入框" },
    { name: "--shadow-2", value: "两级", role: "抬升表面" },
    { name: "--fs-2xl", value: "32px", role: "指标数值" },
  ],
};
