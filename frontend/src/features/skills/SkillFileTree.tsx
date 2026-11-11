import React from 'react';
import type { SkillFile } from '../../bridge/types';
import { File, FileCode, FileText, Plus, Trash2 } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface SkillFileTreeProps {
  files: SkillFile[];
  activeFile: string;
  onSelectFile: (path: string) => void;
  onAddFile: (path: string) => void;
  onDeleteFile: (path: string) => void;
}

export const SkillFileTree: React.FC<SkillFileTreeProps> = ({
  files,
  activeFile,
  onSelectFile,
  onAddFile,
  onDeleteFile,
}) => {
  const handleCreate = () => {
    const filename = prompt('Enter new file path (e.g. references/guide.md, fixtures/mock.json):');
    if (filename && filename.trim()) {
      onAddFile(filename.trim());
    }
  };

  const getFileIcon = (path: string) => {
    if (path.endsWith('.md')) return <FileText className="w-3.5 h-3.5 text-[var(--anchor-accent)] shrink-0" />;
    if (path.endsWith('.ts') || path.endsWith('.js') || path.endsWith('.json')) {
      return <FileCode className="w-3.5 h-3.5 text-[var(--anchor-info)] shrink-0" />;
    }
    return <File className="w-3.5 h-3.5 text-[var(--anchor-text-subtle)] shrink-0" />;
  };

  return (
    <div className="w-60 h-full border-r border-[var(--anchor-border)] bg-[var(--anchor-surface-sunken)] flex flex-col select-none text-left shrink-0">
      <div className="p-3 border-b border-[var(--anchor-border)] flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--anchor-text-subtle)]">
          Files ({files.length})
        </span>
        <button
          onClick={handleCreate}
          aria-label="Add file"
          className="p-1 rounded text-[var(--anchor-text-subtle)] hover:text-[var(--anchor-text)] hover:bg-[var(--anchor-surface-hover)] cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {files.map((file) => {
          const isActive = file.path === activeFile;
          const isSkillMd = file.path === 'SKILL.md';

          return (
            <div
              key={file.path}
              onClick={() => onSelectFile(file.path)}
              className={cn(
                'group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer font-mono transition-colors',
                isActive
                  ? 'bg-[var(--anchor-surface-elevated)] text-[var(--anchor-text)] font-semibold shadow-xs border border-[var(--anchor-border)]'
                  : 'text-[var(--anchor-text-muted)] hover:bg-[var(--anchor-surface-hover)]'
              )}
            >
              <div className="flex items-center gap-2 truncate">
                {getFileIcon(file.path)}
                <span className="truncate">{file.path}</span>
              </div>

              {!isSkillMd && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete file "${file.path}"?`)) {
                      onDeleteFile(file.path);
                    }
                  }}
                  aria-label={`Delete ${file.path}`}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-[var(--anchor-text-subtle)] hover:text-[var(--anchor-danger)] transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
