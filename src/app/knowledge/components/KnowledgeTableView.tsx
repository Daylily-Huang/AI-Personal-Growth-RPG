import type { KnowledgeFlowNodeType } from "./KnowledgeNodeView";
import type { RawGraphEdge } from "./KnowledgeGraphCanvas";
import { getAuthorityVisual, getEdgeVisual, getNodeTypeVisual } from "./presentation";

export interface KnowledgeTableViewProps {
  nodes: KnowledgeFlowNodeType[];
  edges: RawGraphEdge[];
  onSelectNode: (nodeId: string) => void;
  onSelectEdge: (edgeId: string) => void;
}

export default function KnowledgeTableView({
  nodes,
  edges,
  onSelectNode,
  onSelectEdge,
}: KnowledgeTableViewProps) {
  const nodeTitleById = new Map(nodes.map((node) => [node.id, node.data.title]));

  return (
    <div className="h-full overflow-auto p-4 space-y-6" data-testid="knowledge-table-view">
      <section aria-labelledby="knowledge-table-heading">
        <h2 id="knowledge-table-heading" className="sr-only">
          知识节点表格视图
        </h2>
        <table
          data-testid="knowledge-nodes-table"
          className="w-full min-w-[820px] border-collapse text-left text-sm text-[var(--text-primary)]"
        >
          <caption className="sr-only">当前筛选下的知识节点读模型</caption>
          <thead>
            <tr className="border-b border-[var(--border-default)] text-xs text-[var(--text-secondary)]">
              <th scope="col" className="px-3 py-2 font-semibold">知识标题</th>
              <th scope="col" className="px-3 py-2 font-semibold">节点类型</th>
              <th scope="col" className="px-3 py-2 font-semibold">领域</th>
              <th scope="col" className="px-3 py-2 font-semibold">权威状态</th>
              <th scope="col" className="px-3 py-2 font-semibold">知识置信度</th>
              <th scope="col" className="px-3 py-2 font-semibold">关联技能</th>
              <th scope="col" className="px-3 py-2 font-semibold">连接数</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((node) => {
              const authority = getAuthorityVisual(
                node.data.verificationStatus,
                node.data.isArchived,
                node.data.confidence,
              );
              const type = getNodeTypeVisual(node.data.nodeType);
              return (
                <tr
                  key={node.id}
                  data-testid={`knowledge-nodes-table-row-${node.id}`}
                  className="border-b border-[var(--border-subtle)] align-top"
                >
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => onSelectNode(node.id)}
                      aria-label={`查看知识节点 ${node.data.title}，${authority.label}`}
                      className="rounded-[var(--radius-sm)] text-left font-semibold underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]"
                    >
                      {node.data.title}
                    </button>
                  </td>
                  <td className="px-3 py-3">{type.label}</td>
                  <td className="px-3 py-3">{node.data.domainName ?? "未分类领域"}</td>
                  <td className="px-3 py-3">{authority.label}</td>
                  <td className="px-3 py-3">{Math.round(node.data.confidence * 100)}%</td>
                  <td className="px-3 py-3">{node.data.skillName ?? "未关联技能"}</td>
                  <td className="px-3 py-3">
                    {node.data.inboundEdgeCount + node.data.outboundEdgeCount}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="knowledge-relations-table-heading">
        <h2 id="knowledge-relations-table-heading" className="text-base font-semibold text-[var(--text-primary)]">
          知识关系
        </h2>
        <table
          data-testid="knowledge-relations-table"
          className="mt-2 w-full min-w-[820px] border-collapse text-left text-sm text-[var(--text-primary)]"
        >
          <caption className="sr-only">当前筛选下的知识关系及其权威状态</caption>
          <thead>
            <tr className="border-b border-[var(--border-default)] text-xs text-[var(--text-secondary)]">
              <th scope="col" className="px-3 py-2 font-semibold">来源节点</th>
              <th scope="col" className="px-3 py-2 font-semibold">关系</th>
              <th scope="col" className="px-3 py-2 font-semibold">目标节点</th>
              <th scope="col" className="px-3 py-2 font-semibold">权威状态</th>
              <th scope="col" className="px-3 py-2 font-semibold">关系置信度</th>
            </tr>
          </thead>
          <tbody>
            {edges.map((edge) => {
              const sourceTitle = nodeTitleById.get(edge.source) ?? edge.source;
              const targetTitle = nodeTitleById.get(edge.target) ?? edge.target;
              const visual = getEdgeVisual(
                edge.relationType,
                edge.verificationStatus,
                edge.confidence,
                edge.isArchived,
              );
              const relationSymbol = visual.isSymmetric ? "—" : "→";
              return (
                <tr
                  key={edge.id}
                  data-testid={`knowledge-relations-table-row-${edge.id}`}
                  className="border-b border-[var(--border-subtle)] align-top"
                >
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => onSelectEdge(edge.id)}
                      aria-label={`查看知识关系 ${sourceTitle} ${edge.relationType} ${targetTitle}`}
                      className="rounded-[var(--radius-sm)] text-left underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]"
                    >
                      {sourceTitle}
                    </button>
                  </td>
                  <td className="px-3 py-3">{relationSymbol} {edge.relationType}</td>
                  <td className="px-3 py-3">{targetTitle}</td>
                  <td className="px-3 py-3">{visual.label}</td>
                  <td className="px-3 py-3">{Math.round(edge.confidence * 100)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {edges.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-secondary)]">当前筛选下没有关系。</p>
        ) : null}
      </section>
    </div>
  );
}
