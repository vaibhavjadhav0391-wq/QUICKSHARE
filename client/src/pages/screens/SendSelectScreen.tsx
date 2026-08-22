import { useRef, useState, useCallback } from 'react';
import { formatBytes, fileTypeIcon, truncateFilename } from '@/utils/formatters';

interface SendSelectScreenProps {
  selectedFiles: File[];
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
  onStartSharing: () => void;
  onBack: () => void;
}

export function SendSelectScreen({
  selectedFiles,
  onAddFiles,
  onRemoveFile,
  onStartSharing,
  onBack,
}: SendSelectScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    onAddFiles(Array.from(files));
  }, [onAddFiles]);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);
  const hasFiles = selectedFiles.length > 0;

  return (
    <div className="w-full max-w-xl mx-auto py-8 px-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all"
          id="btn-back-send"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Select Files to Send</h1>
          <p className="text-white/40 text-sm">Choose the files you want to share</p>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        className={`relative rounded-3xl border-2 border-dashed transition-all duration-200 cursor-pointer mb-6 p-10 flex flex-col items-center justify-center gap-4 text-center
          ${isDragging
            ? 'border-amber-400/80 bg-amber-500/10 scale-[1.01]'
            : 'border-white/15 bg-white/[0.03] hover:border-amber-400/40 hover:bg-white/[0.05]'}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        id="file-drop-zone"
      >
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-200
          ${isDragging ? 'bg-amber-500/25' : 'bg-white/5'}`}>
          {isDragging ? (
            <svg className="w-8 h-8 text-amber-400 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          ) : (
            <svg className="w-8 h-8 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          )}
        </div>
        <div>
          <p className="text-white/70 font-semibold text-base">
            {isDragging ? 'Drop files here' : 'Drop files here'}
          </p>
          <p className="text-white/35 text-sm mt-1">or click to select from your device</p>
          <p className="text-white/25 text-xs mt-2">All file types · No size limit</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          id="file-input"
          aria-label="Select files to send"
        />
      </div>

      {/* Selected Files List */}
      {hasFiles && (
        <div className="mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <p className="text-white/60 text-sm font-medium">
              {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
            </p>
            <p className="text-white/40 text-xs">{formatBytes(totalSize)} total</p>
          </div>
          <div className="flex flex-col gap-2">
            {selectedFiles.map((file, i) => (
              <div
                key={`${file.name}-${i}`}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/8 hover:bg-white/[0.08] transition-colors group"
              >
                <span className="text-2xl flex-shrink-0">{fileTypeIcon(file.type || 'application/octet-stream')}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white/85 text-sm font-medium truncate" title={file.name}>
                    {truncateFilename(file.name, 40)}
                  </p>
                  <p className="text-white/35 text-xs mt-0.5">{formatBytes(file.size)}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onRemoveFile(i); }}
                  className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/15 transition-all opacity-0 group-hover:opacity-100"
                  aria-label={`Remove ${file.name}`}
                  id={`remove-file-${i}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* Add more */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="mt-3 w-full py-3 rounded-2xl border border-dashed border-white/15 text-white/40 text-sm hover:border-amber-400/40 hover:text-amber-400/70 hover:bg-amber-500/5 transition-all"
            id="btn-add-more"
          >
            + Add more files
          </button>
        </div>
      )}

      {/* Start Sharing CTA */}
      <button
        onClick={onStartSharing}
        disabled={!hasFiles}
        className={`w-full py-4 rounded-2xl font-bold text-base transition-all duration-200
          ${hasFiles
            ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.01] active:scale-[0.99]'
            : 'bg-white/5 border border-white/10 text-white/25 cursor-not-allowed'}`}
        id="btn-start-sharing"
      >
        {hasFiles ? `Start Sharing →` : 'Select files to continue'}
      </button>
    </div>
  );
}
