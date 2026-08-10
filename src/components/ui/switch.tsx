import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
        // The track is a flex container, so the thumb rests against the start
        // edge — the left in LTR, the RIGHT in RTL. `translate-x` is physical
        // and never flips, so each direction needs its own sign; sharing one
        // positive offset pushes the thumb clean out of the track in RTL.
        //
        // The direction has to be read from the DOM (`ltr:` / `rtl:` match any
        // `[dir]` ancestor — here `<html dir="rtl">`). The previous version
        // tested `props.dir`, which no caller passes, so the RTL branch never
        // ran and the knob sat outside the pill.
        "ltr:data-[state=unchecked]:translate-x-0 ltr:data-[state=checked]:translate-x-5",
        "rtl:data-[state=unchecked]:translate-x-0 rtl:data-[state=checked]:-translate-x-5"
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
