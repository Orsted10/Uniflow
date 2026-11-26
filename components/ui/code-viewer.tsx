import * as React from "react";

export interface CodeViewerProps {
  code: string;
  language?: string;
  maxHeight?: string;
  showLineNumbers?: boolean;
  className?: string;
}

const TS_TOKEN_REGEX =
  /(\/\/.*$|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:export|function|const|let|var|if|else|for|while|return|typeof|throw|new|type|interface|import|from|as|in|of|switch|case|break|default)\b|\b(?:true|false|null|undefined)\b|\b(?:Record|unknown|string|number|boolean|void|never|any|Array|Error|Object)\b|\b\d+(?:\.\d+)?\b|[A-Za-z_$][\w$]*(?=\s*\()|\.[A-Za-z_$][\w$]*)/gm;

const TS_KEYWORDS = new Set([
  "export", "function", "const", "let", "var", "if", "else", "for", "while",
  "return", "typeof", "throw", "new", "type", "interface", "import", "from",
  "as", "in", "of", "switch", "case", "break", "default",
]);
const TS_LITERALS = new Set(["true", "false", "null", "undefined"]);
const TS_TYPES = new Set([
  "Record", "unknown", "string", "number", "boolean", "void", "never", "any", "Array", "Error", "Object",
]);

function highlightTsLine(line: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  TS_TOKEN_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TS_TOKEN_REGEX.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={`p-${lastIndex}`} className="text-zinc-300">
          {line.slice(lastIndex, match.index)}
        </span>
      );
    }
    const token = match[0];
    let cls = "text-zinc-200";
    if (token.startsWith("//") || token.startsWith("/*")) cls = "text-zinc-500 italic";
    else if (token.startsWith('"') || token.startsWith("'") || token.startsWith("`")) cls = "text-emerald-300";
    else if (TS_KEYWORDS.has(token)) cls = "text-[#f4845f] font-medium";
    else if (TS_LITERALS.has(token)) cls = "text-amber-300";
    else if (TS_TYPES.has(token)) cls = "text-violet-300";
    else if (/^\d/.test(token)) cls = "text-sky-300";
    else if (token.startsWith(".")) cls = "text-teal-300";
    else cls = "text-[#f5dfb8]";

    parts.push(
      <span key={`t-${match.index}`} className={cls}>
        {token}
      </span>
    );
    lastIndex = match.index + token.length;
  }
  if (lastIndex < line.length) {
    parts.push(
      <span key={`e-${lastIndex}`} className="text-zinc-300">
        {line.slice(lastIndex)}
      </span>
    );
  }
  return parts.length > 0 ? parts : [" "];
}

function highlightJsonLine(line: string): React.ReactNode {
  const keyMatch = line.match(/^(\s*)"([^"]+)"(\s*:\s*)(.*)$/);
  if (keyMatch) {
    const [, indent, key, colon, rest] = keyMatch;
    let valColor = "text-zinc-200";
    if (rest.startsWith('"')) valColor = "text-emerald-300";
    else if (/^-?\d/.test(rest)) valColor = "text-sky-300";
    else if (rest.startsWith("true") || rest.startsWith("false") || rest.startsWith("null")) {
      valColor = "text-amber-300";
    }
    return (
      <>
        <span>{indent}</span>
        <span className="text-[#f5dfb8]">&quot;{key}&quot;</span>
        <span className="text-zinc-500">{colon}</span>
        <span className={valColor}>{rest}</span>
      </>
    );
  }
  const trimmed = line.trim();
  if (trimmed.startsWith('"')) return <span className="text-emerald-300">{line}</span>;
  if (/^-?\d/.test(trimmed)) return <span className="text-sky-300">{line}</span>;
  return <span className="text-zinc-400">{line || " "}</span>;
}

function highlightMarkdownLine(line: string): React.ReactNode {
  if (/^#{1,3}\s/.test(line)) {
    return <span className="text-[#f4845f] font-semibold">{line}</span>;
  }
  if (line.startsWith("|")) {
    return <span className="text-teal-200">{line}</span>;
  }
  if (line.startsWith("---")) {
    return <span className="text-zinc-600">{line}</span>;
  }
  if (line.includes("`")) {
    const segs = line.split(/(`[^`]+`)/g);
    return segs.map((seg, idx) =>
      seg.startsWith("`") && seg.endsWith("`") ? (
        <span key={idx} className="text-amber-300 bg-amber-500/10 px-1 rounded">
          {seg}
        </span>
      ) : (
        <span key={idx} className="text-zinc-200">
          {seg}
        </span>
      )
    );
  }
  return <span className="text-zinc-200">{line || " "}</span>;
}

export function CodeViewer({
  code,
  language = "typescript",
  maxHeight = "440px",
  showLineNumbers = true,
  className = "",
}: CodeViewerProps) {
  const [copied, setCopied] = React.useState(false);

  function copyToClipboard() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const lines = code.split("\n");
  const langLower = language.toLowerCase();

  return (
    <div
      className={`relative border border-white/[0.12] rounded-2xl bg-[#090807]/95 text-zinc-100 overflow-hidden shadow-lg ${className}`}
    >
      <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.04] border-b border-white/[0.08] text-xs font-mono">
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-300 border border-sky-400/30 text-[11px] font-semibold uppercase">
            {language}
          </span>
          <span className="text-zinc-400 text-[11px]">{lines.length} lines</span>
        </div>
        <button
          type="button"
          onClick={copyToClipboard}
          className="px-3 py-1 rounded-full bg-[#f5dfb8]/15 hover:bg-[#f5dfb8]/25 text-[#f5dfb8] border border-[#f5dfb8]/30 transition text-xs font-sans font-medium"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>

      <div
        style={{ maxHeight }}
        className="overflow-auto py-3 px-1 font-mono text-[13px] leading-relaxed"
      >
        <div className="min-w-max">
          {lines.map((line, i) => (
            <div
              key={i}
              className="flex items-start px-3 py-0.5 hover:bg-white/[0.03] transition-colors rounded"
            >
              {showLineNumbers && (
                <span
                  aria-hidden="true"
                  className="select-none w-10 pr-3 mr-3 text-right text-zinc-600 border-r border-white/[0.06] shrink-0"
                >
                  {i + 1}
                </span>
              )}
              <span className="whitespace-pre flex-1">
                {langLower === "json"
                  ? highlightJsonLine(line)
                  : langLower === "markdown" || langLower === "md"
                  ? highlightMarkdownLine(line)
                  : highlightTsLine(line)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
