import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  discussionId?: string;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class DiscussionErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorMessage: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error?.message || "Unknown error" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const payload = {
      message: error?.message,
      stack: error?.stack,
      componentStack: info.componentStack,
      discussionId: this.props.discussionId,
      href: window.location.href,
    };
    try {
      fetch("/api/client-errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      }).catch(() => {});
    } catch (_) {}
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="px-4 py-3 text-xs text-white/30 border-b border-white/8"
          data-testid="discussion-card-error"
        >
          This post could not be displayed.
        </div>
      );
    }
    return this.props.children;
  }
}
