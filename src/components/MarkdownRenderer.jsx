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
        <div key={`codeblock-${match.index}`} style={{ background: '#09090b', border: '1px solid var(--border-color)', borderRadius: '7px', padding: '10px 12px', margin: '8px 0', fontFamily: 'var(--font-mono)', fontSize: '11.5px', color: 'var(--text-heading)', overflowX: 'auto' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px', fontWeight: 600, letterSpacing: '0.04em', display: 'flex', justifyContent: 'space-between' }}>
            <span>{lang}</span>
            <span>CODE</span>
          </div>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.45 }}>{codeStr}</pre>
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
        elements.push(<h1 key={`${keyPrefix}-h1-${idx}`} style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-heading)', margin: '12px 0 6px 0', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>{parseInline(trimmed.replace(/^#\s+/, ''))}</h1>);
        return;
      }
      if (trimmed.startsWith('## ')) {
        elements.push(<h2 key={`${keyPrefix}-h2-${idx}`} style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--text-heading)', margin: '10px 0 5px 0' }}>{parseInline(trimmed.replace(/^##\s+/, ''))}</h2>);
        return;
      }
      if (trimmed.startsWith('### ')) {
        elements.push(<h3 key={`${keyPrefix}-h3-${idx}`} style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-heading)', margin: '8px 0 4px 0' }}>{parseInline(trimmed.replace(/^###\s+/, ''))}</h3>);
        return;
      }

      if (trimmed.startsWith('> ')) {
        elements.push(
          <blockquote key={`${keyPrefix}-bq-${idx}`} style={{ borderLeft: '2px solid var(--accent-primary)', background: 'rgba(94, 106, 210, 0.08)', padding: '6px 12px', margin: '6px 0', borderRadius: '0 6px 6px 0', color: 'var(--text-normal)' }}>
            {parseInline(trimmed.replace(/^>\s+/, ''))}
          </blockquote>
        );
        return;
      }

      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        elements.push(
          <li key={`${keyPrefix}-li-${idx}`} style={{ marginLeft: '18px', marginTop: '2px', marginBottom: '2px', color: 'var(--text-normal)' }}>
            {parseInline(trimmed.replace(/^[-*]\s+/, ''))}
          </li>
        );
        return;
      }

      if (trimmed.length > 0) {
        elements.push(<p key={`${keyPrefix}-p-${idx}`} style={{ margin: '3px 0', lineHeight: 1.5 }}>{parseInline(line)}</p>);
      } else {
        elements.push(<div key={`${keyPrefix}-br-${idx}`} style={{ height: '4px' }} />);
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
      <div key={key} style={{ overflowX: 'auto', margin: '8px 0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', background: 'var(--bg-darkest)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-color)' }}>
              {headerCells.map((h, idx) => (
                <th key={idx} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-heading)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bodyRows.map((row, rIdx) => (
              <tr key={rIdx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {row.map((cell, cIdx) => (
                  <td key={cIdx} style={{ padding: '6px 10px', color: 'var(--text-normal)' }}>{parseInline(cell)}</td>
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
      const accentColor = matchingAgent ? matchingAgent.color : (matchingUser ? (matchingUser.color || '#818cf8') : '#818cf8');

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
        return <strong key={`${key}-b-${bIdx}`} style={{ color: 'var(--text-heading)', fontWeight: 600 }}>{bPart}</strong>;
      }
      const codeParts = bPart.split(/`(.*?)`/g);
      return codeParts.map((cPart, cIdx) => {
        if (cIdx % 2 === 1) {
          return (
            <code key={`${key}-c-${cIdx}`} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle)', color: 'var(--text-heading)', padding: '1px 5px', borderRadius: '4px', fontSize: '11.5px', fontFamily: 'var(--font-mono)' }}>
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
