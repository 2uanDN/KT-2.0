import React, { Component, type ErrorInfo, type ReactNode } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
  resetKeys?: unknown[];
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error cleanly for debugging
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  public override componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.hasError && this.props.resetKeys && prevProps.resetKeys) {
      const hasChanged = this.props.resetKeys.some(
        (key, index) => key !== prevProps.resetKeys?.[index]
      );
      if (hasChanged) {
        this.reset();
      }
    }
  }

  public reset = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
    this.props.onReset?.();
  };

  public override render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error, this.reset);
      }

      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default Blueprint-styled inline fallback
      return (
        <div
          role="alert"
          className="p-4 bg-[#FFDAD6] text-[#93000A] border border-[#BA1A1A] rounded-lg shadow-hard-xs my-2"
        >
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-[20px] text-[#BA1A1A] shrink-0 mt-0.5">
              error
            </span>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm text-[#1B1B1B]">Đã xảy ra sự cố hiển thị</h4>
              <p className="text-xs font-mono mt-1 break-words [overflow-wrap:anywhere] text-[#93000A]">
                {this.state.error.message || 'Lỗi không xác định trong quá trình kết xuất.'}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={this.reset}
                  className="px-3 py-1 bg-[#BA1A1A] text-white rounded text-xs font-mono font-bold hover:bg-[#93000A] transition cursor-pointer"
                >
                  THỬ LẠI
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
