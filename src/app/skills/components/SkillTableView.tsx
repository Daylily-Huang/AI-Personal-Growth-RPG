import { formatConfidence, getSkillStateVisual } from "./presentation";
import type { SkillFlowNodeType } from "./SkillNode";

export interface SkillTableViewProps {
  nodes: SkillFlowNodeType[];
  onSelect: (skillId: string) => void;
}

export default function SkillTableView({ nodes, onSelect }: SkillTableViewProps) {
  return (
    <div className="h-full overflow-auto p-4" data-testid="skills-table-view">
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
                    className="rounded-[var(--radius-sm)] text-left font-semibold underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]"
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
    </div>
  );
}
