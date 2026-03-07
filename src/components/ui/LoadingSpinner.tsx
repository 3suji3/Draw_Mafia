type LoadingSpinnerProps = {
  label?: string;
  size?: "sm" | "md";
};

export function LoadingSpinner({ label = "로딩 중...", size = "md" }: LoadingSpinnerProps) {
  const spinnerSize = size === "sm" ? "h-4 w-4" : "h-6 w-6";

  return (
    <div className="inline-flex items-center gap-2 text-dm-text-secondary">
      <span
        className={`${spinnerSize} animate-spin rounded-full border-2 border-dm-text-secondary/30 border-t-dm-accent`}
      />
      <span className="text-sm">{label}</span>
    </div>
  );
}
