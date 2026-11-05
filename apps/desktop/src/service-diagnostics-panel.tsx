import { useEffect, useRef, useState } from "react";
import { ErrorState, LoadingState, UnavailableState } from "@japp/ui";
import {
  createDiagnosticsRequest,
  serviceDiagnosticsAvailable,
  ServiceDiagnosticsError,
} from "./service-diagnostics.ts";
import type {
  DiagnosticsRequest,
  DiagnosticsRequestFactory,
  ServiceDiagnostics,
} from "./service-diagnostics.ts";

type ViewState =
  | { readonly kind: "unavailable" }
  | { readonly kind: "loading" }
  | { readonly kind: "result"; readonly value: ServiceDiagnostics }
  | { readonly kind: "error"; readonly error: ServiceDiagnosticsError };
export function ServiceDiagnosticsPanel({
  createRequest,
}: {
  readonly createRequest?: DiagnosticsRequestFactory;
}) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ViewState>({ kind: "unavailable" });
  const heading = useRef<HTMLHeadingElement>(null);
  const current = useRef<DiagnosticsRequest | null>(null);
  useEffect(() => {
    let active = true;
    if (createRequest === undefined && !serviceDiagnosticsAvailable()) {
      setState({ kind: "unavailable" });
      return;
    }
    let request: DiagnosticsRequest;
    try {
      request = (createRequest ?? createDiagnosticsRequest)();
    } catch {
      setState({
        kind: "error",
        error: new ServiceDiagnosticsError("UNAVAILABLE"),
      });
      return;
    }
    current.current = request;
    setState({ kind: "loading" });
    void request
      .read()
      .then((value) => {
        if (active) setState({ kind: "result", value });
      })
      .catch((error: unknown) => {
        if (active)
          setState({
            kind: "error",
            error:
              error instanceof ServiceDiagnosticsError
                ? error
                : new ServiceDiagnosticsError("UNAVAILABLE"),
          });
      });
    return () => {
      active = false;
      if (current.current === request) current.current = null;
      void request.cancel();
    };
  }, [attempt, createRequest]);
  function retry() {
    heading.current?.focus();
    setAttempt((value) => value + 1);
  }
  const cancelled =
    (state.kind === "error" && state.error.code === "CANCELLED") ||
    (state.kind === "result" && state.value.state === "CANCELLED");
  return (
    <section
      className="desktop-panel"
      aria-labelledby="service-diagnostics-heading"
    >
      <div className="desktop-panel__heading">
        <h2 id="service-diagnostics-heading" ref={heading} tabIndex={-1}>
          Local service
        </h2>
        <span className="desktop-detail">Last check</span>
      </div>
      {state.kind === "unavailable" ? (
        <UnavailableState title="Local service diagnostics are unavailable.">
          Open this view in the desktop app to check the local service.
        </UnavailableState>
      ) : null}
      {state.kind === "loading" ? (
        <>
          <LoadingState>Checking the local service…</LoadingState>
          <button
            className="ui-button ui-button--secondary"
            type="button"
            onClick={() => {
              heading.current?.focus();
              void current.current?.cancel();
            }}
          >
            Cancel check
          </button>
        </>
      ) : null}
      {cancelled ? (
        <div aria-live="polite">
          <UnavailableState title="Service check cancelled." />
          <button
            className="ui-button ui-button--secondary"
            type="button"
            onClick={retry}
          >
            Check again
          </button>
        </div>
      ) : null}
      {state.kind === "error" && !cancelled ? (
        <ErrorState
          title="The local service could not be checked."
          retryLabel="Check again"
          onRetry={retry}
        >
          {state.error.message}
        </ErrorState>
      ) : null}
      {state.kind === "result" && !cancelled ? (
        <>
          <dl className="desktop-details" aria-live="polite">
            <div>
              <dt>Service status</dt>
              <dd>
                {state.value.state === "READY"
                  ? "Ready"
                  : state.value.state === "STARTING"
                    ? "Starting"
                    : state.value.state === "STOPPING"
                      ? "Stopping"
                      : state.value.state === "STOPPED"
                        ? "Stopped"
                        : state.value.state === "FAILED"
                          ? "Unavailable after a service failure"
                          : state.value.state === "CLEANUP_FAILED"
                            ? "Service shutdown needs attention"
                            : "Unavailable"}
              </dd>
            </div>
            {state.value.state === "READY" ? (
              <>
                <div>
                  <dt>Service version</dt>
                  <dd className="desktop-version">
                    {state.value.serviceVersion}
                  </dd>
                </div>
                <div>
                  <dt>API version</dt>
                  <dd className="desktop-version">{state.value.apiVersion}</dd>
                </div>
              </>
            ) : null}
            <div>
              <dt>Checked at</dt>
              <dd>
                <time dateTime={state.value.checkedAt}>
                  {state.value.checkedAt}
                </time>
              </dd>
            </div>
          </dl>
          <button
            className="ui-button ui-button--secondary"
            type="button"
            onClick={retry}
          >
            Check again
          </button>
        </>
      ) : null}
    </section>
  );
}
