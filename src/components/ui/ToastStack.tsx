type ToastItem = {
  id: string;
  message: string;
};

type ToastStackProps = {
  items: ToastItem[];
};

export function ToastStack({ items }: ToastStackProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="animate-slide-up rounded-lg border border-dm-accent/40 bg-dm-card/95 px-3 py-2 text-sm text-dm-text-primary shadow-dm-glow"
        >
          {item.message}
        </div>
      ))}
    </div>
  );
}
