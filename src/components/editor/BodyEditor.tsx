import React, { useRef } from 'react';

interface BodyEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

const PLACEHOLDER_TEXT = 'văn bản';

export const BodyEditor: React.FC<BodyEditorProps> = ({
  value,
  onChange,
  placeholder = 'Nội dung ghi chú (Hỗ trợ Markdown: ## tiêu đề, **in đậm**, *in nghiêng*, danh sách, task - [ ]...)',
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertFormatting = (prefix: string, suffix = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const replacement = `${prefix}${selectedText || PLACEHOLDER_TEXT}${suffix}`;

    const newValue =
      value.substring(0, start) + replacement + value.substring(end);
    onChange(newValue);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + (selectedText.length || PLACEHOLDER_TEXT.length)
      );
    }, 0);
  };

  return (
    <div className="border border-[#3D4A5C] rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#3D4A5C] bg-[#FFFFFF] shadow-hard-xs">
      {/* Markdown Toolbar */}
      <div className="flex items-center gap-1 p-1.5 bg-[#FAF9F7] border-b border-[#3D4A5C] overflow-x-auto no-scrollbar text-xs font-mono">
        <button
          type="button"
          onClick={() => insertFormatting('## ')}
          className="px-2 py-1 rounded-xs hover:bg-[#E8E8E8] text-[#3D4A5C] font-bold cursor-pointer"
          title="Tiêu đề H2"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => insertFormatting('### ')}
          className="px-2 py-1 rounded-xs hover:bg-[#E8E8E8] text-[#3D4A5C] font-bold cursor-pointer"
          title="Tiêu đề H3"
        >
          H3
        </button>
        <button
          type="button"
          onClick={() => insertFormatting('**', '**')}
          className="px-2 py-1 rounded-xs hover:bg-[#E8E8E8] text-[#3D4A5C] font-bold cursor-pointer"
          title="In đậm"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => insertFormatting('*', '*')}
          className="px-2 py-1 rounded-xs hover:bg-[#E8E8E8] text-[#3D4A5C] italic cursor-pointer"
          title="In nghiêng"
        >
          I
        </button>
        <button
          type="button"
          onClick={() => insertFormatting('- ')}
          className="px-2 py-1 rounded-xs hover:bg-[#E8E8E8] text-[#3D4A5C] cursor-pointer"
          title="Danh sách gạch đầu dòng"
        >
          • List
        </button>
        <button
          type="button"
          onClick={() => insertFormatting('- [ ] ')}
          className="px-2 py-1 rounded-xs hover:bg-[#E8E8E8] text-[#3D4A5C] cursor-pointer"
          title="Công việc Checkbox"
        >
          ☑ Task
        </button>
        <button
          type="button"
          onClick={() => insertFormatting('> ')}
          className="px-2 py-1 rounded-xs hover:bg-[#E8E8E8] text-[#3D4A5C] cursor-pointer"
          title="Trích dẫn"
        >
          " Quote
        </button>
        <button
          type="button"
          onClick={() => insertFormatting('```\n', '\n```')}
          className="px-2 py-1 rounded-xs hover:bg-[#E8E8E8] text-[#3D4A5C] cursor-pointer"
          title="Khối mã code"
        >
          {'</>'}
        </button>
      </div>

      {/* Editor Body */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={12}
        className="w-full p-3 font-mono text-sm leading-relaxed bg-[#FFFFFF] text-[#1B1B1B] placeholder-[#75777D] focus:outline-none resize-y min-h-[220px]"
      />
    </div>
  );
};
