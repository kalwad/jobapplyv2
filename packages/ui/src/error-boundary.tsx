import { Component, createRef } from "react";
import type { ReactNode } from "react";
import { ErrorState } from "./status.tsx";

interface RenderErrorBoundaryProps {
  readonly children: ReactNode;
}
interface RenderErrorBoundaryState {
  readonly failed: boolean;
  readonly generation: number;
}

/** Rendering faults are distinct from explicit asynchronous request states. */
export class RenderErrorBoundary extends Component<
  RenderErrorBoundaryProps,
  RenderErrorBoundaryState
> {
  override state: RenderErrorBoundaryState = { failed: false, generation: 0 };

  private readonly content = createRef<HTMLDivElement>();

  override componentDidUpdate(
    _previousProps: RenderErrorBoundaryProps,
    previousState: RenderErrorBoundaryState,
  ) {
    if (previousState.failed && !this.state.failed)
      this.content.current?.focus();
  }

  static getDerivedStateFromError(): Partial<RenderErrorBoundaryState> {
    return { failed: true };
  }

  override render() {
    if (this.state.failed) {
      return (
        <ErrorState
          title="This view could not be displayed."
          onRetry={() => {
            this.setState(({ generation }) => ({
              failed: false,
              generation: generation + 1,
            }));
          }}
          retryLabel="Reload view"
        >
          Try reloading this view.
        </ErrorState>
      );
    }
    return (
      <div
        key={this.state.generation}
        ref={this.content}
        tabIndex={-1}
        className="ui-boundary-content"
      >
        {this.props.children}
      </div>
    );
  }
}
