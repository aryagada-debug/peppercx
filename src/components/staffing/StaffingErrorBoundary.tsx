import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props { children: React.ReactNode }
interface State { error: Error | null }

export class StaffingErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface the real error in the console for debugging.
    // eslint-disable-next-line no-console
    console.error("[StaffingErrorBoundary]", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 my-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-medium text-foreground">Something went wrong loading this view</h2>
            <p className="text-sm text-muted-foreground mt-1 break-words">
              {error.message || "Unknown error"}
            </p>
            {error.stack && (
              <pre className="mt-3 max-h-48 overflow-auto rounded bg-background/60 p-2 text-[11px] text-muted-foreground border border-border whitespace-pre-wrap">
                {error.stack}
              </pre>
            )}
            <button
              type="button"
              onClick={this.reset}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        </div>
      </div>
    );
  }
}