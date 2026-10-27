import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

// Form field: 40px, 6px radius, white with a 1px control border; invalid state is a red border.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-md border border-control bg-surface px-3 text-[15px] text-ink transition-colors placeholder:text-ink-placeholder hover:border-control-hover disabled:cursor-not-allowed disabled:bg-raised aria-invalid:border-negative md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
