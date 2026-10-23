export interface NavigationDestination { href: string; label: string; description: string; keywords: readonly string[] }
export const PRODUCT_ROUTES = ["/dashboard", "/quests", "/skills", "/knowledge", "/artifacts", "/journey", "/rewards", "/local-library", "/activities"] as const;
export const NAVIGATION_DESTINATIONS: readonly NavigationDestination[] = [
  { href: "/dashboard", label: "今天", description: "选一件最值得推进的事，记录行动与成长", keywords: ["首页", "仪表盘", "记录", "评估", "确认", "today", "dashboard", "log", "快速记录", "记录活动", "记录结果", "待确认", "AI评估"] },
  { href: "/quests", label: "目标与任务", description: "拆解目标、推进任务、调整完成进度", keywords: ["任务志", "主线", "计划", "quest", "task", "goal", "tasks", "goals", "新建任务", "添加任务", "创建目标"] },
  { href: "/artifacts", label: "作品与成果", description: "整理可以复用的笔记、代码、图表与作品", keywords: ["产出台", "产出", "artifact", "作品"] },
  { href: "/local-library", label: "本地资料", description: "连接多个文件夹，选择资料并核对记录建议", keywords: ["文件夹", "导入", "文件", "图片", "OCR", "Word", "PPT", "folder", "file", "import", "folders", "files", "local", "documents", "添加文件夹", "选择文件夹"] },
  { href: "/skills", label: "技能与能力", description: "查看技能发展、掌握程度和支持证据", keywords: ["技能谱", "能力", "mastery", "skill", "skills"] },
  { href: "/knowledge", label: "知识地图", description: "整理知识节点与它们之间的联系", keywords: ["知识图", "图谱", "knowledge", "graph"] },
  { href: "/journey/seasons", label: "阶段目标", description: "规划当前阶段要推进的方向", keywords: ["成长旅程", "赛季", "season", "journey"] },
  { href: "/journey/journal", label: "成长日记", description: "记录当天的观察、感受和调整", keywords: ["日记", "journal"] },
  { href: "/journey/reviews", label: "回顾与复盘", description: "回顾每日、每周、每月的进展与下一步", keywords: ["月度", "周报", "日报", "daily", "weekly", "monthly", "review", "月度复盘", "每月复盘", "每周复盘", "每日复盘", "月报", "周复盘"] },
  { href: "/journey/playbook", label: "行动策略", description: "保留有效做法，复盘并调整策略", keywords: ["策略", "playbook", "strategy"] },
  { href: "/rewards/wishes", label: "心愿与奖励", description: "安排现实心愿，查看奖励与兑换记录", keywords: ["心愿", "积分", "wish", "reward"] },
  { href: "/rewards/milestones", label: "成长里程碑", description: "查看已经形成的阶段性成果", keywords: ["成就", "milestone", "achievement"] },
  { href: "/onboarding", label: "开始使用", description: "跟着步骤完成第一个目标与成长记录", keywords: ["新手", "引导", "入门", "start", "onboarding"] },
  { href: "/help", label: "使用帮助", description: "了解操作流程、成长规则、隐私和问题恢复", keywords: ["帮助", "说明", "隐私", "help", "privacy"] },
];
export function matchesRoute(pathname: string, prefix: string): boolean { return pathname === prefix || pathname.startsWith(prefix + "/"); }
export function isWorkspaceRoute(pathname: string): boolean { return PRODUCT_ROUTES.some(prefix => matchesRoute(pathname, prefix)); }
export function navigationTitle(pathname: string): string {
  const direct = NAVIGATION_DESTINATIONS.find(item => item.href === pathname); if (direct) return direct.label;
  if (matchesRoute(pathname, "/activities")) return "活动记录";
  const parent = NAVIGATION_DESTINATIONS.find(item => matchesRoute(pathname, item.href));
  if (parent) return parent.label;
  if (matchesRoute(pathname, "/journey")) return "成长旅程";
  if (matchesRoute(pathname, "/rewards")) return "心愿与奖励";
  return "工作区";
}
const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase("zh-CN").trim();
export function searchNavigation(query: string): readonly NavigationDestination[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return NAVIGATION_DESTINATIONS.filter(item => { const text = normalize([item.label, item.description, item.href, ...item.keywords].join(" ")); return terms.every(term => text.includes(term)); });
}
export function isEditingTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'));
}
