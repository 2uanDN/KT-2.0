import React, { Component, type ReactNode } from 'react';
import { useRouteError } from 'react-router-dom';
import { ScreenErrorView } from './ScreenErrorView';

export interface ScreenErrorBoundaryProps {
  children?: ReactNode;
  screenTitle?: string;
  resetKey?: unknown;
  resetKeys?: unknown[];
  isRoot?: boolean;
  error?: Error | unknown;
  onReset?: () => void;
}

interface ScreenErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ScreenErrorBoundaryClass extends Component<
  ScreenErrorBoundaryProps,
  ScreenErrorBoundaryState
> {
  public override state: ScreenErrorBoundaryState = {
    hasError: Boolean(this.props.error),
    error: (this.props.error as Error) || null,
  };

  public static getDerivedStateFromError(error: Error): ScreenErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  public override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ScreenErrorBoundary caught error]:', error, errorInfo);
  }

  public override componentDidUpdate(prevProps: ScreenErrorBoundaryProps): void {
    // If resetKey changed (e.g. route path changed), reset error boundary automatically
    if (this.state.hasError) {
      if (this.props.resetKey !== undefined && this.props.resetKey !== prevProps.resetKey) {
        this.reset();
        return;
      }
      if (this.props.resetKeys && prevProps.resetKeys) {
        const hasChanged = this.props.resetKeys.some(
          (key, index) => key !== prevProps.resetKeys?.[index]
        );
        if (hasChanged) {
          this.reset();
        }
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
      return (
        <ScreenErrorView
          error={this.state.error}
          onReset={this.reset}
          screenTitle={this.props.screenTitle}
          isRoot={this.props.isRoot}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * RouteErrorFallback reads error thrown within React Router (actions, loaders, route matching)
 */
export const RouteErrorFallback: React.FC<{ isRoot?: boolean; screenTitle?: string }> = ({
  isRoot,
  screenTitle,
}) => {
  const routeError = useRouteError();
  return (
    <ScreenErrorView
      error={routeError}
      isRoot={isRoot}
      screenTitle={screenTitle}
      onReset={() => window.location.reload()}
    />
  );
};

/**
 * Universal ScreenErrorBoundary:
 * - When used with children: wraps them with React class ErrorBoundary
 * - When used without children (e.g. as React Router's errorElement): renders RouteErrorFallback
 */
export const ScreenErrorBoundary: React.FC<ScreenErrorBoundaryProps> = ({
  children,
  error,
  ...props
}) => {
  if (children) {
    return (
      <ScreenErrorBoundaryClass error={error} {...props}>
        {children}
      </ScreenErrorBoundaryClass>
    );
  }

  // Used as route errorElement or standalone fallback
  if (error) {
    return <ScreenErrorView error={error} {...props} />;
  }

  return <RouteErrorFallback isRoot={props.isRoot} screenTitle={props.screenTitle} />;
};

/**
 * HOC to wrap a screen component with a ScreenErrorBoundary
 */
export function withScreenErrorBoundary<P extends object>(
  ComponentToWrap: React.ComponentType<P>,
  screenTitle?: string
): React.FC<P> {
  const Wrapped: React.FC<P> = (props) => (
    <ScreenErrorBoundary screenTitle={screenTitle}>
      <ComponentToWrap {...props} />
    </ScreenErrorBoundary>
  );
  Wrapped.displayName = `withScreenErrorBoundary(${
    ComponentToWrap.displayName || ComponentToWrap.name || 'Component'
  })`;
  return Wrapped;
}
