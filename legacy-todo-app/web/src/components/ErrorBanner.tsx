interface ErrorBannerProps {
  message: string | null;
  onDismiss: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  if (!message) return null;

  return (
    <p className="alert" role="alert">
      <span className="alert__message">{message}</span>
      <button
        type="button"
        className="alert__dismiss"
        onClick={onDismiss}
        aria-label="Dismiss this error"
      >
        <span aria-hidden="true">&times;</span>
      </button>
    </p>
  );
}
