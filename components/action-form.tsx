"use client";
import { useActionState } from "react";
export type ActionState = { error?: string; success?: string };
export function ActionForm({
  action,
  children,
  label = "저장하기",
  className = "",
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  label?: string;
  className?: string;
}) {
  const [state, submit, pending] = useActionState(action, {});
  return (
    <form action={submit} className={`form ${className}`}>
      {children}
      <div aria-live="polite">
        {state.error && (
          <p className="notice error" role="alert">
            {state.error}
          </p>
        )}
        {state.success && <p className="notice success">{state.success}</p>}
      </div>
      <button className="button" disabled={pending}>
        {pending ? "처리 중…" : label}
      </button>
    </form>
  );
}
