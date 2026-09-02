"use client";

import React from "react";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Safe, presentation-only Markdown renderer.
 * Converts markdown text into structured React elements without raw HTML or XSS vulnerability.
 */
export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  if (!content) return null;

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeBlockLang = "";
  let codeBlockLines: string[] = [];
  let inList: "ul" | "ol" | null = null;
  let listItems: React.ReactNode[] = [];

  const flushList = (key: string) => {
    if (inList === "ul") {
      elements.push(
        <ul key={key} className="list-disc list-inside space-y-1 my-2 text-xs text-[var(--text-secondary)] pl-2">
          {listItems}
        </ul>
      );
    } else if (inList === "ol") {
      elements.push(
        <ol key={key} className="list-decimal list-inside space-y-1 my-2 text-xs text-[var(--text-secondary)] pl-2">
          {listItems}
        </ol>
      );
    }
    inList = null;
    listItems = [];
  };

  const renderInline = (text: string): React.ReactNode[] => {
    // Parse inline code, bold, italic, links
    const parts: React.ReactNode[] = [];
    const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
    let lastIdx = 0;
    let match: RegExpExecArray | null;

    let subKey = 0;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        parts.push(text.substring(lastIdx, match.index));
      }
      const token = match[0];
      if (token.startsWith("`") && token.endsWith("`")) {
        parts.push(
          <code
            key={`c-${subKey++}`}
            className="px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--surface-ground)] text-[var(--text-primary)] font-mono text-xs border border-[var(--border-subtle)]"
          >
            {token.slice(1, -1)}
          </code>
        );
      } else if (token.startsWith("**") && token.endsWith("**")) {
        parts.push(
          <strong key={`b-${subKey++}`} className="font-[var(--font-weight-bold)] text-[var(--text-primary)]">
            {token.slice(2, -2)}
          </strong>
        );
      } else if (token.startsWith("*") && token.endsWith("*")) {
        parts.push(
          <em key={`i-${subKey++}`} className="italic text-[var(--text-primary)]">
            {token.slice(1, -1)}
          </em>
        );
      } else if (token.startsWith("[") && token.includes("](")) {
        const linkMatch = token.match(/\[([^\]]+)\]\(([^)]+)\)/);
        if (linkMatch) {
          const [, label, href] = linkMatch;
          parts.push(
            <a
              key={`a-${subKey++}`}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--text-accent)] underline hover:text-[var(--text-primary)] transition-colors inline-flex items-center gap-0.5"
            >
              {label}
            </a>
          );
        } else {
          parts.push(token);
        }
      }
      lastIdx = regex.lastIndex;
    }

    if (lastIdx < text.length) {
      parts.push(text.substring(lastIdx));
    }

    return parts.length > 0 ? parts : [text];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Code block handling
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        // End code block
        elements.push(
          <div
            key={`code-block-${i}`}
            className="my-3 rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] overflow-hidden"
          >
            {codeBlockLang && (
              <div className="px-3 py-1 bg-[var(--surface-raised)] border-b border-[var(--border-subtle)] text-[10px] font-mono text-[var(--text-muted)] uppercase">
                {codeBlockLang}
              </div>
            )}
            <pre className="p-3 text-xs font-mono text-[var(--text-primary)] overflow-x-auto whitespace-pre leading-relaxed">
              <code>{codeBlockLines.join("\n")}</code>
            </pre>
          </div>
        );
        inCodeBlock = false;
        codeBlockLang = "";
        codeBlockLines = [];
      } else {
        if (inList) flushList(`flush-before-code-${i}`);
        inCodeBlock = true;
        codeBlockLang = trimmed.slice(3).trim();
        codeBlockLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // 2. Headings
    if (trimmed.startsWith("### ")) {
      if (inList) flushList(`flush-heading-${i}`);
      elements.push(
        <h4
          key={`h3-${i}`}
          className="font-serif font-[var(--font-weight-semibold)] text-sm text-[var(--text-primary)] mt-3 mb-1"
        >
          {renderInline(trimmed.slice(4))}
        </h4>
      );
      continue;
    }
    if (trimmed.startsWith("## ")) {
      if (inList) flushList(`flush-heading-${i}`);
      elements.push(
        <h3
          key={`h2-${i}`}
          className="font-serif font-[var(--font-weight-bold)] text-sm text-[var(--text-primary)] mt-3.5 mb-1.5"
        >
          {renderInline(trimmed.slice(3))}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith("# ")) {
      if (inList) flushList(`flush-heading-${i}`);
      elements.push(
        <h2
          key={`h1-${i}`}
          className="font-serif font-[var(--font-weight-bold)] text-base text-[var(--text-primary)] mt-4 mb-2"
        >
          {renderInline(trimmed.slice(2))}
        </h2>
      );
      continue;
    }

    // 3. Blockquotes
    if (trimmed.startsWith("> ")) {
      if (inList) flushList(`flush-quote-${i}`);
      elements.push(
        <blockquote
          key={`quote-${i}`}
          className="border-l-2 border-[var(--border-raised)] pl-3 my-2 text-xs text-[var(--text-muted)] italic"
        >
          {renderInline(trimmed.slice(2))}
        </blockquote>
      );
      continue;
    }

    // 4. Unordered List
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      if (inList !== "ul") {
        if (inList) flushList(`flush-list-${i}`);
        inList = "ul";
      }
      listItems.push(
        <li key={`li-${i}`}>{renderInline(trimmed.slice(2))}</li>
      );
      continue;
    }

    // 5. Ordered List
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      if (inList !== "ol") {
        if (inList) flushList(`flush-list-${i}`);
        inList = "ol";
      }
      listItems.push(
        <li key={`li-${i}`}>{renderInline(olMatch[2])}</li>
      );
      continue;
    }

    // Empty line / paragraph
    if (trimmed === "") {
      if (inList) flushList(`flush-empty-${i}`);
      continue;
    }

    // Plain Paragraph
    if (inList) flushList(`flush-p-${i}`);
    elements.push(
      <p
        key={`p-${i}`}
        className="text-xs text-[var(--text-secondary)] leading-relaxed my-1.5"
      >
        {renderInline(trimmed)}
      </p>
    );
  }

  if (inList) flushList("flush-final");
  if (inCodeBlock && codeBlockLines.length > 0) {
    elements.push(
      <pre
        key="code-block-final"
        className="p-3 my-2 rounded-[var(--radius-md)] bg-[var(--surface-ground)] text-xs font-mono text-[var(--text-primary)] overflow-x-auto"
      >
        <code>{codeBlockLines.join("\n")}</code>
      </pre>
    );
  }

  return <div className={`space-y-1 text-left ${className}`}>{elements}</div>;
}
