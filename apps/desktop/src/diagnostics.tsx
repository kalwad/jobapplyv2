import { useEffect, useRef, useState } from "react";
import { ErrorState, LoadingState } from "@japp/ui";
import { ServiceDiagnosticsPanel } from "./service-diagnostics-panel.tsx";
import type { DiagnosticsRequestFactory } from "./service-diagnostics.ts";
import {
  NativeMetadataError,
  readShellMetadata,
  validateShellMetadata,
} from "./native-metadata.ts";
import type { MetadataLoader, ShellMetadata } from "./native-metadata.ts";

type MetadataState =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly metadata: ShellMetadata }
  | { readonly kind: "error"; readonly invalid: boolean };

export interface DiagnosticsProps {
  readonly loadMetadata?: MetadataLoader;
  readonly createServiceRequest?: DiagnosticsRequestFactory;
}

export function Diagnostics({
  loadMetadata = readShellMetadata,
  createServiceRequest,
}: DiagnosticsProps) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<MetadataState>({ kind: "loading" });
  const versionHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let active = true;
    // Changing routes or retrying invalidates the result, not the underlying IPC.
    void Promise.resolve()
      .then(loadMetadata)
      .then(validateShellMetadata)
      .then((metadata) => {
        if (active) setState({ kind: "ready", metadata });
      })
      .catch((error: unknown) => {
        if (active)
          setState({
            kind: "error",
            invalid:
              error instanceof NativeMetadataError &&
              error.code === "INVALID_NATIVE_METADATA",
          });
      });
    return () => {
      active = false;
    };
  }, [loadMetadata, attempt]);

  return (
    <div className="desktop-page-stack">
      <section
        className="desktop-panel"
        aria-labelledby="desktop-versions-heading"
      >
        <div className="desktop-panel__heading">
          <h2 id="desktop-versions-heading" ref={versionHeading} tabIndex={-1}>
            Desktop versions
          </h2>
          <span className="desktop-detail">Native app</span>
        </div>
        {state.kind === "loading" ? (
          <LoadingState>Reading desktop version information…</LoadingState>
        ) : null}
        {state.kind === "error" ? (
          <ErrorState
            title="Version information is unavailable."
            onRetry={() => {
              versionHeading.current?.focus();
              setState({ kind: "loading" });
              setAttempt((previous) => previous + 1);
            }}
          >
            {state.invalid
              ? "The desktop app returned an unexpected response. Try reading it again."
              : "Open this view in the desktop app, or try reading it again."}
          </ErrorState>
        ) : null}
        {state.kind === "ready" ? (
          <dl className="desktop-details" aria-live="polite">
            <div>
              <dt>App version</dt>
              <dd className="desktop-version">{state.metadata.appVersion}</dd>
            </div>
            <div>
              <dt>Tauri version</dt>
              <dd className="desktop-version">{state.metadata.tauriVersion}</dd>
            </div>
          </dl>
        ) : null}
      </section>
      <ServiceDiagnosticsPanel
        {...(createServiceRequest === undefined
          ? {}
          : { createRequest: createServiceRequest })}
      />
      <section
        className="desktop-panel"
        aria-labelledby="local-capabilities-heading"
      >
        <div className="desktop-panel__heading">
          <h2 id="local-capabilities-heading">Local capabilities</h2>
        </div>
        <dl className="desktop-details">
          <div>
            <dt>AI provider</dt>
            <dd>Unavailable in this build</dd>
          </div>
          <div>
            <dt>Platform certification</dt>
            <dd>Not evaluated</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
