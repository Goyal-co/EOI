"use client";

import * as React from "react";
import { cn } from "../lib/utils";
import { Upload, File, X, CheckCircle, Eye } from "lucide-react";
import { Button } from "./button";

export interface UploadedFile {
  name: string;
  size: number;
  url?: string;
  status: "uploading" | "success" | "error";
  progress?: number;
}

export interface FileUploadProps {
  label?: string;
  accept?: string;
  maxSize?: number;
  multiple?: boolean;
  file?: UploadedFile | null;
  onUpload: (file: File) => void;
  onSizeError?: (file: File, maxSize: number) => void;
  onRemove?: () => void;
  onPreview?: () => void;
  disabled?: boolean;
}

export function FileUpload({
  label,
  accept = ".pdf,.jpg,.jpeg,.png",
  maxSize = 5 * 1024 * 1024,
  multiple = false,
  file,
  onUpload,
  onSizeError,
  onRemove,
  onPreview,
  disabled,
}: FileUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);

  const handleFiles = (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    for (const f of files) {
      if (f.size > maxSize) {
        onSizeError?.(f, maxSize);
        continue;
      }
      onUpload(f);
    }
  };

  if (!multiple && file?.status === "success") {
    return (
      <div className="space-y-1.5">
        {label && <p className="text-sm font-medium text-foreground">{label}</p>}
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
          {onPreview && (
            <Button variant="ghost" size="icon" onClick={onPreview} aria-label="Preview file">
              <Eye className="h-4 w-4" />
            </Button>
          )}
          {onRemove && (
            <Button variant="ghost" size="icon" onClick={onRemove} aria-label="Remove file">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (!multiple && file?.status === "uploading") {
    return (
      <div className="space-y-1.5">
        {label && <p className="text-sm font-medium text-foreground">{label}</p>}
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <File className="h-5 w-5 text-blue-600" />
            <div className="flex-1">
              <p className="text-sm text-foreground">{file.name}</p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${file.progress || 0}%` }}
                />
              </div>
            </div>
            <span className="text-xs text-muted-foreground">{file.progress || 0}%</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {label && <p className="text-sm font-medium text-foreground">{label}</p>}
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer",
          dragOver ? "border-blue-600 bg-blue-50" : "border-border hover:border-blue-600/50 hover:bg-blue-50/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
      >
        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-foreground font-medium">
          {multiple ? "Drop files here or click to upload" : "Drop file here or click to upload"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">Max {(maxSize / 1024 / 1024).toFixed(0)}MB — {accept}</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
