import type { EmptyProps } from "./props";

export function Empty({ text, failed, action }: EmptyProps) {
  const classes = failed ? "empty error" : "empty";
  const role = failed ? "alert" : undefined;
  if (!action)
    return (
      <div className={classes} role={role}>
        {text}
      </div>
    );
  return (
    <div className={classes} role={role}>
      <span>{text}</span>
      {action}
    </div>
  );
}
