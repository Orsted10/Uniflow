import * as React from "react";

export interface FileDropzoneProps {
  label: string;
  sublabel?: string;
  acceptedFormat?: string;
  onFileLoaded?: (content: string, fileName: string) => void;
  className?: string;
}

export function FileDropzone({
  label,
  sublabel = "Supports OpenAPI 3.x JSON & JSON Schema JSON (Max 1 MiB)",
  acceptedFormat = ".json",
  onFileLoaded,
  className = "",
}: FileDropzoneProps) {
  const [dragOver, setDragOver] = React.useState(false);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === "string" && onFileLoaded) {
        onFileLoaded(text, file.name);
      }
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`border border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
        dragOver
          ? "border-emerald-500/60 bg-emerald-950/20"
          : "border-zinc-800 hover:border-zinc-700 bg-zinc-950/60"
      } ${className}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedFormat}
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFile(e.target.files[0]);
          }
        }}
      />
      <div className="w-7 h-7 rounded-md bg-zinc-900 border border-zinc-800 mx-auto flex items-center justify-center text-zinc-400 text-xs font-mono mb-2">
        ↑
      </div>
      <p className="text-xs font-medium text-zinc-200">{fileName || label}</p>
      <p className="text-[11px] text-zinc-500 mt-0.5">{sublabel}</p>
    </div>
  );
}
