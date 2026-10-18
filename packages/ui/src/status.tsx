import type { ReactNode } from "react";

export interface LoadingStateProps {
  readonly children: ReactNode;
}

export function LoadingState({ children }: LoadingStateProps) {
  return (
    <div className="ui-status" role="status">
      <span className="ui-status__indicator" aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}

export interface ErrorStateProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly onRetry: () => void;
  readonly retryLabel?: string;
}

export function ErrorState({
  title,
  children,
  onRetry,
  retryLabel = "Try again",
}: ErrorStateProps) {
  return (
    <div className="ui-status ui-status--error" role="alert">
      <div className="ui-status__copy">
        <p className="ui-status__title">{title}</p>
        <p>{children}</p>
      </div>
      <button
        className="ui-button ui-button--secondary"
        type="button"
        onClick={onRetry}
      >
        {retryLabel}
      </button>
    </div>
  );
}

export interface UnavailableStateProps {
  readonly title: string;
  readonly children?: ReactNode;
}

export function UnavailableState({ title, children }: UnavailableStateProps) {
  return (
    <div className="ui-empty-state">
      <p className="ui-empty-state__title">{title}</p>
      {children === undefined ? null : <p>{children}</p>}
    </div>
  );
}
