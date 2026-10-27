import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-md border border-control bg-surface px-3 py-2 text-[15px] text-ink transition-colors placeholder:text-ink-placeholder hover:border-control-hover disabled:cursor-not-allowed disabled:bg-raised aria-invalid:border-negative md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
