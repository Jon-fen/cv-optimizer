import * as React from "react"
import { cn } from "@/lib/utils"

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive"
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(({ 
  className, 
  variant = "default", 
  ...props 
}, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(
      "rounded-lg border p-4",
      {
        "bg-background text-foreground": variant === "default",
        "border-destructive bg-destructive/10 text-destructive": variant === "destructive",
      },
      className
    )}
    {...props}
  />
))

Alert.displayName = "Alert"

interface AlertDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

const AlertDescription = React.forwardRef<HTMLParagraphElement, AlertDescriptionProps>(({ 
  className, 
  ...props 
}, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
))

AlertDescription.displayName = "AlertDescription"

export { Alert, AlertDescription }