import React from 'react';

export default function MarkdownRenderer({ content, agents = [], users = [] }) {
  if (!content) return null;

  const renderBlocks = (raw) => {
    const codeBlockRegex = /```([a-z]*)\n?([\s\S]*?)```/g;
    const blocks = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(raw)) !== null) {
      if (match.index > lastIndex) {
        blocks.push(parseTextLines(raw.substring(lastIndex, match.index), `block-${match.index}`));
      }

      const lang = match[1] || 'shell';
      const codeStr = match[2];

      blocks.push(
        <div
          key={`codeblock-${match.index}`}
          className="my-2 overflow-x-auto rounded-lg border border-line bg-surface-sunken px-3 py-2.5 font-mono text-[11.5px] text-ink-heading"
        >
          <div className="mb-1.5 flex justify-between border-b border-line-soft pb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
            <span>{lang}</span>
            <span>CODE</span>
          </div>
          <pre className="m-0 whitespace-pre-wrap break-words leading-[1.45]">{codeStr}</pre>
        </div>
      );

      lastIndex = codeBlockRegex.lastIndex;
    }

    if (lastIndex < raw.length) {
      blocks.push(parseTextLines(raw.substring(lastIndex), `block-${lastIndex}`));
    }

    return blocks;
  };

  const parseTextLines = (chunk, keyPrefix) => {
    const lines = chunk.split('\n');
    const elements = [];
    let inTable = false;
    let tableRows = [];

    lines.forEach((line, idx) => {
      const trimmed = line.trim();

      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        inTable = true;
        tableRows.push(trimmed);
        return;
      } else if (inTable) {
        elements.push(renderTable(tableRows, `${keyPrefix}-tbl-${idx}`));
        inTable = false;
        tableRows = [];
      }

      if (trimmed.startsWith('# ')) {
        elements.push(
          <h1 key={`${keyPrefix}-h1-${idx}`} className="mb-1.5 mt-3 border-b border-line-soft pb-1 text-base font-semibold text-ink-heading">
            {parseInline(trimmed.replace(/^#\s+/, ''))}
          </h1>
        );
        return;
      }
      if (trimmed.startsWith('## ')) {
        elements.push(
          <h2 key={`${keyPrefix}-h2-${idx}`} className="mb-1.5 mt-2.5 text-[14.5px] font-semibold text-ink-heading">
            {parseInline(trimmed.replace(/^##\s+/, ''))}
          </h2>
        );
        return;
      }
      if (trimmed.startsWith('### ')) {
        elements.push(
          <h3 key={`${keyPrefix}-h3-${idx}`} className="mb-1 mt-2 text-[13.5px] font-semibold text-ink-heading">
            {parseInline(trimmed.replace(/^###\s+/, ''))}
          </h3>
        );
        return;
      }

      if (trimmed.startsWith('> ')) {
        elements.push(
          <blockquote
            key={`${keyPrefix}-bq-${idx}`}
            className="my-1.5 rounded-r-md border-l-2 border-accent bg-accent-soft px-3 py-1.5 text-ink"
          >
            {parseInline(trimmed.replace(/^>\s+/, ''))}
          </blockquote>
        );
        return;
      }

      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        elements.push(
          <li key={`${keyPrefix}-li-${idx}`} className="my-0.5 ml-[18px] text-ink">
            {parseInline(trimmed.replace(/^[-*]\s+/, ''))}
          </li>
        );
        return;
      }

      if (trimmed.length > 0) {
        elements.push(
          <p key={`${keyPrefix}-p-${idx}`} className="my-0.5 leading-normal">
            {parseInline(line)}
          </p>
        );
      } else {
        elements.push(<div key={`${keyPrefix}-br-${idx}`} className="h-1" />);
      }
    });

    if (inTable && tableRows.length > 0) {
      elements.push(renderTable(tableRows, `${keyPrefix}-tbl-end`));
    }

    return <div key={keyPrefix}>{elements}</div>;
  };

  const renderTable = (rows, key) => {
    if (rows.length < 2) return null;
    const headerCells = rows[0].split('|').map(c => c.trim()).filter(Boolean);
    const bodyRows = rows.slice(2).map(r => r.split('|').map(c => c.trim()).filter(Boolean));

    return (
      <div key={key} className="my-2 overflow-x-auto">
        <table className="w-full border-collapse rounded-md border border-line bg-white text-xs">
          <thead>
            <tr className="border-b border-line bg-surface-muted">
              {headerCells.map((h, idx) => (
                <th key={idx} className="px-2.5 py-1.5 text-left font-semibold text-ink-heading">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bodyRows.map((row, rIdx) => (
              <tr key={rIdx} className="border-b border-line-soft">
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="px-2.5 py-1.5 text-ink">{parseInline(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const parseInline = (textStr) => {
    if (!textStr) return '';

    const mentionRegex = /(@[A-Za-z0-9_\-\s]+?)(?=\s|[.,!?]|$)/g;
    const parts = [];
    let lastIdx = 0;
    let match;

    while ((match = mentionRegex.exec(textStr)) !== null) {
      if (match.index > lastIdx) {
        parts.push(renderBoldAndCode(textStr.substring(lastIdx, match.index), `in-${match.index}`));
      }

      const mentionText = match[0];
      const nameWithoutAt = mentionText.replace('@', '').trim();
      const matchingAgent = agents.find(a => a.name.toLowerCase() === nameWithoutAt.toLowerCase());
      const matchingUser = users.find(u => u.name.toLowerCase() === nameWithoutAt.toLowerCase());
      const accentColor = matchingAgent ? matchingAgent.color : (matchingUser ? (matchingUser.color || '#2563eb') : '#2563eb');

      parts.push(
        <span
          key={`m-${match.index}`}
          className="mention-pill"
          style={{ background: `${accentColor}1f`, color: accentColor, borderColor: `${accentColor}40` }}
        >
          {mentionText}
        </span>
      );

      lastIdx = mentionRegex.lastIndex;
    }

    if (lastIdx < textStr.length) {
      parts.push(renderBoldAndCode(textStr.substring(lastIdx), `in-${lastIdx}`));
    }

    return parts;
  };

  const renderBoldAndCode = (str, key) => {
    const boldParts = str.split(/\*\*(.*?)\*\*/g);
    return boldParts.map((bPart, bIdx) => {
      if (bIdx % 2 === 1) {
        return (
          <strong key={`${key}-b-${bIdx}`} className="font-semibold text-ink-heading">
            {bPart}
          </strong>
        );
      }
      const codeParts = bPart.split(/`(.*?)`/g);
      return codeParts.map((cPart, cIdx) => {
        if (cIdx % 2 === 1) {
          return (
            <code
              key={`${key}-c-${cIdx}`}
              className="rounded border border-line bg-slate-50 px-1.5 py-px font-mono text-[11.5px] text-ink-heading"
            >
              {cPart}
            </code>
          );
        }
        return cPart;
      });
    });
  };

  return <div>{renderBlocks(content)}</div>;
}
