import React, { Component, type ReactNode } from 'react';
import type { Item } from '../../../types/item';

export interface ItemErrorBoundaryProps {
  children: ReactNode;
  item?: Item;
  onOpen?: (id: string) => void;
}

interface ItemErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ItemErrorBoundary extends Component<ItemErrorBoundaryProps, ItemErrorBoundaryState> {
  public override state: ItemErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ItemErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  public override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error(`[ItemErrorBoundary] Failed rendering item ID ${this.props.item?.id}:`, error, errorInfo);
  }

  public reset = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  public override render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      const { item, onOpen } = this.props;
      const title = item?.title || 'Mục dữ liệu không hợp lệ';
      const errorMessage = this.state.error.message || 'Lỗi kết xuất dữ liệu mục';

      return (
        <div
          role="alert"
          className="bg-[#FAF9F7] border border-[#BA1A1A] border-t-4 border-t-[#BA1A1A] rounded-lg p-3.5 shadow-hard-xs min-h-[96px] flex flex-col justify-between text-left"
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[#BA1A1A]">
                  report_problem
                </span>
                <span className="type-nano-code font-bold uppercase bg-[#FFDAD6] text-[#93000A] px-1.5 py-0.5 rounded-xs border border-[#BA1A1A]/30">
                  LỖI KẾT XUẤT
                </span>
              </div>
              {item?.id && (
                <span className="type-nano-code text-[#75777D] font-mono">
                  ID: {item.id.slice(0, 8)}...
                </span>
              )}
            </div>

            <h3 className="type-headline-sm font-bold text-[#1B1B1B] truncate leading-tight">
              {title}
            </h3>

            <p className="type-body-sm text-[#44474C] mt-1 text-xs leading-normal">
              Mục này gặp sự cố khi xử lý dữ liệu. Các mục khác trong thư viện vẫn an toàn và hiển thị bình thường.
            </p>

            <p className="font-mono text-[10px] text-[#BA1A1A] mt-1 truncate bg-[#FFDAD6]/50 px-1.5 py-0.5 rounded">
              {errorMessage}
            </p>
          </div>

          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-[#BA1A1A]/20">
            <button
              type="button"
              onClick={this.reset}
              className="px-2.5 py-1 bg-[#BA1A1A] hover:bg-[#93000A] text-white rounded text-xs font-mono font-bold shadow-hard-xs flex items-center gap-1 cursor-pointer transition"
            >
              <span className="material-symbols-outlined text-[14px]">refresh</span>
              <span>THỬ LẠI</span>
            </button>

            {onOpen && item?.id && (
              <button
                type="button"
                onClick={() => onOpen(item.id)}
                className="px-2.5 py-1 bg-[#FFFFFF] hover:bg-[#FAF9F7] text-[#1B1B1B] border border-[#3D4A5C] rounded text-xs font-mono font-bold flex items-center gap-1 cursor-pointer transition"
              >
                <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                <span>MỞ CHI TIẾT</span>
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
