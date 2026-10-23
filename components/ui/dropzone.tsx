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
      className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${
        dragOver
          ? "border-slate-500 bg-slate-50"
          : "border-slate-300 hover:border-slate-400 bg-white"
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
      <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 mx-auto flex items-center justify-center text-slate-500 text-xs font-mono mb-2">
        ↑
      </div>
      <p className="text-xs font-semibold text-slate-800">{fileName || label}</p>
      <p className="text-[11px] text-slate-500 mt-1">{sublabel}</p>
    </div>
  );
}
