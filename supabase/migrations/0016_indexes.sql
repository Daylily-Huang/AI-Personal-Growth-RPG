-- 0016_indexes.sql
-- 推荐索引（docs/06 §21）。部分/唯一索引（0007/0009/0010 的 unique + partial）
-- 已在各自迁移内创建，这里补查询型索引。

create index if not exists activities_user_created_at_idx
    on public.activities (user_id, created_at desc);

create index if not exists skills_user_domain_idx
    on public.skills (user_id, domain_id);

create index if not exists quests_user_status_idx
    on public.quests (user_id, status);

create index if not exists ai_assessments_activity_status_idx
    on public.ai_assessments (activity_id, status);

create index if not exists knowledge_nodes_user_domain_idx
    on public.knowledge_nodes (user_id, domain_id);

create index if not exists mastery_events_user_skill_created_idx
    on public.mastery_events (user_id, skill_id, created_at desc);

create index if not exists reviews_user_period_idx
    on public.reviews (user_id, period_start desc);
