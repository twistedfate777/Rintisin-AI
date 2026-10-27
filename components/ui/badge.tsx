import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// Status pills: a pale tint with dark ink of the same hue, 20px tall, 4px tag radius (app-screens §7.6).
const badgeVariants = cva(
  "inline-flex h-5 w-fit flex-none shrink-0 items-center gap-1 rounded-sm px-1.5 text-xs font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        neutral: "bg-pill-neutral-bg text-pill-neutral-ink",
        positive: "bg-pill-positive-bg text-pill-positive-ink",
        negative: "bg-pill-negative-bg text-pill-negative-ink",
        warning: "border border-pill-warning-border bg-pill-warning-bg text-pill-warning-ink",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
)

function Badge({
  className,
  variant = "neutral",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
