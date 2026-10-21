import { Toaster as Sonner } from "sonner"
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"

/** Notices land on the paper like a slip clipped to the sheet. */
const Toaster = ({ ...props }) => {
  return (
    <Sonner
      theme="light"
      position="bottom-right"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={{
        "--normal-bg": "var(--color-plane)",
        "--normal-text": "var(--color-ink)",
        "--normal-border": "var(--color-rule)",
        "--success-text": "var(--color-pass-ink)",
        "--error-text": "var(--color-stamp)",
        "--border-radius": "3px",
      }}
      toastOptions={{
        classNames: {
          toast:
            "!font-sans !text-[13px] !shadow-none !border !border-rule !rounded-[3px]",
          title: "!font-medium",
          description: "!text-ink-soft !text-[12.5px]",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
