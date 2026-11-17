import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function Markdown({ text }: { text: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

export function LinkCards({ links }: { links: { label: string; url: string }[] }) {
  if (links.length === 0) return null;
  return (
    <ul className="link-cards">
      {links.map((link, index) => (
        <li key={index}>
          <a href={link.url} target="_blank" rel="noopener noreferrer">
            <span className="link-label">{link.label || link.url}</span>
            <span className="link-host">{new URL(link.url).host}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
