import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
};

const variantClassMap: Record<ButtonVariant, string> = {
  primary: "dm-btn-primary",
  secondary: "dm-btn-secondary",
  ghost: "dm-btn-ghost",
};

export function Button({ children, variant = "primary", className = "", ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={`${variantClassMap[variant]} ${className}`.trim()}
    >
      {children}
    </button>
  );
}
