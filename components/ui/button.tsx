import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// Restyled to the "Framed sheet" app style: flat fills, 6px radius, no rings or shadows;
// focus is the global 2px brand outline. One filled (lime, near-black ink) primary per screen.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md border text-sm font-medium whitespace-nowrap transition-colors duration-100 select-none disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // cva concatenates without merging, so each variant sets its own border colour.
        default: "border-transparent bg-primary text-primary-foreground hover:bg-brand-fill-hover active:bg-brand-fill-press",
        outline:
          "border-control bg-surface text-ink hover:bg-raised active:bg-active aria-expanded:bg-raised",
        secondary: "border-transparent bg-active text-ink hover:bg-active-hover active:bg-active-press",
        ghost: "border-transparent text-ink hover:bg-raised active:bg-active aria-expanded:bg-raised",
        destructive:
          "border-negative-edge bg-surface text-negative hover:bg-pill-negative-bg active:bg-negative-press",
        link: "border-transparent h-auto px-0 text-brand underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 gap-1.5 px-3",
        xs: "h-6 gap-1 px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 px-2.5 text-[13px] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-2 px-4",
        icon: "size-8",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
