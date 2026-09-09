import type { SkillFlowEdge } from "@/lib/store/types";
import { formatConfidence, getRelationVisual, getSkillStateVisual } from "./presentation";
import type { SkillFlowNodeType } from "./SkillNode";

export interface SkillTableViewProps {
  nodes: SkillFlowNodeType[];
  edges: SkillFlowEdge[];
  onSelect: (skillId: string) => void;
}

export default function SkillTableView({ nodes, edges, onSelect }: SkillTableViewProps) {
  const nodeNameById = new Map(nodes.map((node) => [node.id, node.data.name]));

  return (
    <div className="h-full overflow-auto p-4 space-y-6" data-testid="skills-table-view">
      <section aria-labelledby="skills-table-heading">
        <h2 id="skills-table-heading" className="sr-only">
          技能表格视图
        </h2>
        <table
          data-testid="skills-accessible-table"
          className="w-full min-w-[760px] border-collapse text-left text-sm text-[var(--text-primary)]"
        >
          <caption className="sr-only">当前筛选下的技能成长读模型</caption>
          <thead>
            <tr className="border-b border-[var(--border-default)] text-xs text-[var(--text-secondary)]">
              <th scope="col" className="px-3 py-2 font-semibold">技能</th>
              <th scope="col" className="px-3 py-2 font-semibold">领域</th>
              <th scope="col" className="px-3 py-2 font-semibold">等级</th>
              <th scope="col" className="px-3 py-2 font-semibold">Mastery</th>
              <th scope="col" className="px-3 py-2 font-semibold">Mastery 置信度</th>
              <th scope="col" className="px-3 py-2 font-semibold">XP</th>
              <th scope="col" className="px-3 py-2 font-semibold">状态</th>
              <th scope="col" className="px-3 py-2 font-semibold">前置关系</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((node) => {
              const visual = getSkillStateVisual(node.data.derivedState);
              return (
                <tr
                  key={node.id}
                  data-testid={`skills-table-row-${node.id}`}
                  className="border-b border-[var(--border-subtle)] align-top"
                >
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => onSelect(node.id)}
                      aria-label={`查看技能 ${node.data.name}，${visual.label}`}
                      className="min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] rounded-[var(--radius-sm)] text-left font-semibold underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]"
                    >
                      {node.data.name}
                    </button>
                  </td>
                  <td className="px-3 py-3">{node.data.domainLabel ?? "未分类领域"}</td>
                  <td className="px-3 py-3">Lv.{node.data.level}</td>
                  <td className="px-3 py-3">M{node.data.masteryLevel}</td>
                  <td className="px-3 py-3">{formatConfidence(node.data.masteryConfidence)}</td>
                  <td className="px-3 py-3">{node.data.xp} XP</td>
                  <td className="px-3 py-3">{visual.label}</td>
                  <td className="px-3 py-3">
                    {node.data.prerequisiteCount} 个前置（未满足 {node.data.unfulfilledPrerequisiteCount}）
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="skills-relations-heading">
        <h2 id="skills-relations-heading" className="text-base font-semibold text-[var(--text-primary)]">
          技能关系
        </h2>
        <table
          data-testid="skills-relations-table"
          className="mt-2 w-full min-w-[520px] border-collapse text-left text-sm text-[var(--text-primary)]"
        >
          <caption className="sr-only">当前筛选下的技能图谱关系</caption>
          <thead>
            <tr className="border-b border-[var(--border-default)] text-xs text-[var(--text-secondary)]">
              <th scope="col" className="px-3 py-2 font-semibold">来源技能</th>
              <th scope="col" className="px-3 py-2 font-semibold">关系</th>
              <th scope="col" className="px-3 py-2 font-semibold">目标技能</th>
            </tr>
          </thead>
          <tbody>
            {edges.map((edge) => {
              const relation = getRelationVisual(edge.relation);
              const sourceName = nodeNameById.get(edge.source) ?? edge.source;
              const targetName = nodeNameById.get(edge.target) ?? edge.target;
              return (
                <tr
                  key={edge.id}
                  data-testid={`skills-relations-table-row-${edge.id}`}
                  className="border-b border-[var(--border-subtle)] align-top"
                >
                  <td className="px-3 py-3">{sourceName}</td>
                  <td className="px-3 py-3">
                    <span aria-label={`有向关系：${edge.relation}（${relation.label}）`}>
                      → {edge.relation}（{relation.label}）
                    </span>
                  </td>
                  <td className="px-3 py-3">{targetName}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {edges.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-secondary)]">当前筛选下没有技能关系。</p>
        ) : null}
      </section>
    </div>
  );
}
