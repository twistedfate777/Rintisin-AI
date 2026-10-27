import { cn } from "cn"

// Loading: a flat grey bar at the value's real size, no shimmer gradient (app-screens §11).
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("rounded-sm bg-active", className)}
      {...props}
    />
  )
}

export { Skeleton }
