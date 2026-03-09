import * as React from "react";
import {
  DayPicker,
  getDefaultClassNames,
  type DayButton,
} from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const defaults = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        root: cn("w-fit", defaults.root),
        months: cn("relative flex flex-col gap-4", defaults.months),
        month: cn("flex w-full flex-col gap-4", defaults.month),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
          defaults.nav,
        ),
        button_previous: cn(
          "h-8 w-8 p-0 inline-flex items-center justify-center rounded-brand-sm text-charcoal-light hover:text-charcoal hover:bg-teal/10 transition-colors select-none aria-disabled:opacity-50",
          defaults.button_previous,
        ),
        button_next: cn(
          "h-8 w-8 p-0 inline-flex items-center justify-center rounded-brand-sm text-charcoal-light hover:text-charcoal hover:bg-teal/10 transition-colors select-none aria-disabled:opacity-50",
          defaults.button_next,
        ),
        month_caption: cn(
          "flex h-8 w-full items-center justify-center px-8",
          defaults.month_caption,
        ),
        caption_label: cn(
          "font-heading text-sm font-bold text-charcoal select-none",
          defaults.caption_label,
        ),
        weekdays: cn("flex", defaults.weekdays),
        weekday: cn(
          "flex-1 rounded-md text-[0.8rem] font-semibold text-charcoal-light select-none",
          defaults.weekday,
        ),
        week: cn("mt-1 flex w-full", defaults.week),
        day: cn(
          "group/day relative aspect-square h-full w-full p-0 text-center select-none",
          defaults.day,
        ),
        range_start: cn("rounded-l-brand-sm bg-teal/15", defaults.range_start),
        range_middle: cn("rounded-none bg-teal/15", defaults.range_middle),
        range_end: cn("rounded-r-brand-sm bg-teal/15", defaults.range_end),
        today: cn(
          "rounded-brand-sm bg-coral/10 data-[selected=true]:rounded-none",
          defaults.today,
        ),
        outside: cn("text-charcoal-light/30", defaults.outside),
        disabled: cn("text-charcoal-light/30 opacity-50", defaults.disabled),
        hidden: cn("invisible", defaults.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
        DayButton: CalendarDayButton,
        ...components,
      }}
      {...props}
    />
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaults = getDefaultClassNames();
  const ref = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  const isRangeEnd = modifiers.range_start || modifiers.range_end;
  const isRangeMiddle = modifiers.range_middle;
  const isSelected =
    modifiers.selected && !isRangeEnd && !isRangeMiddle;

  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "inline-flex aspect-square w-full min-w-[32px] items-center justify-center rounded-brand-sm text-sm font-semibold text-charcoal transition-colors",
        "hover:bg-teal/10",
        isRangeEnd && "rounded-brand-sm bg-teal text-white font-bold hover:bg-teal-dark",
        isRangeMiddle && "rounded-none bg-transparent text-charcoal font-semibold",
        isSelected && "bg-teal text-white font-bold hover:bg-teal-dark",
        modifiers.today && !isRangeEnd && !isSelected && "text-coral font-bold",
        modifiers.disabled && "text-charcoal-light/30 opacity-50 pointer-events-none hover:bg-transparent",
        modifiers.outside && "text-charcoal-light/30",
        defaults.day_button,
        className,
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
