import { useState, useEffect } from "react";
import {
  startOfDay,
  endOfDay,
  subDays,
  format,
} from "date-fns";
import * as Popover from "@radix-ui/react-popover";
import { Calendar as CalendarIcon, ChevronDown, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";

type DateField = "publishedAt" | "createdAt";
type Preset = "today" | "yesterday" | "last7" | "custom";

export interface DateRangeValue {
  from: Date | undefined;
  to: Date | undefined;
  dateField: DateField;
}

interface DateRangeFilterProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  onClear: () => void;
}

const FIELD_LABELS: Record<DateField, string> = {
  publishedAt: "Posted Date",
  createdAt: "Scraped Date",
};

const getPresetRange = (preset: Exclude<Preset, "custom">) => {
  const now = new Date();
  if (preset === "today") return { from: startOfDay(now), to: endOfDay(now) };
  if (preset === "yesterday") {
    const y = subDays(now, 1);
    return { from: startOfDay(y), to: endOfDay(y) };
  }
  return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
};

const detectPreset = (from: Date | undefined, to: Date | undefined): Preset | null => {
  if (!from || !to) return null;
  const presets: Exclude<Preset, "custom">[] = ["today", "yesterday", "last7"];
  for (const p of presets) {
    const r = getPresetRange(p);
    if (from.getTime() === r.from.getTime() && to.getTime() === r.to.getTime()) return p;
  }
  return "custom";
};

const formatRange = (from: Date | undefined, to: Date | undefined): string => {
  if (!from && !to) return "Date Range";
  if (from && !to) return format(from, "MMM d");
  if (from && to) {
    if (from.toDateString() === to.toDateString()) return format(from, "MMM d, yyyy");
    if (from.getFullYear() === to.getFullYear())
      return `${format(from, "MMM d")} – ${format(to, "MMM d")}`;
    return `${format(from, "MMM d, yyyy")} – ${format(to, "MMM d, yyyy")}`;
  }
  return "Date Range";
};

export default function DateRangeFilter({ value, onChange, onClear }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<Preset | null>(
    () => detectPreset(value.from, value.to),
  );
  const [calendarMonth, setCalendarMonth] = useState<Date>(value.from ?? new Date());
  const [selectingFrom, setSelectingFrom] = useState(true);
  const [pendingFrom, setPendingFrom] = useState<Date | undefined>(value.from);
  const [pendingTo, setPendingTo] = useState<Date | undefined>(value.to);

  useEffect(() => {
    if (open) {
      setPendingFrom(value.from);
      setPendingTo(value.to);
      setActivePreset(detectPreset(value.from, value.to));
      setSelectingFrom(true);
    }
  }, [open, value.from, value.to]);

  const hasValue = value.from || value.to;

  const applyPreset = (preset: Exclude<Preset, "custom">) => {
    const range = getPresetRange(preset);
    setActivePreset(preset);
    setPendingFrom(range.from);
    setPendingTo(range.to);
    onChange({ from: range.from, to: range.to, dateField: value.dateField });
    setOpen(false);
  };

  const handleDayClick = (day: Date) => {
    if (selectingFrom) {
      setPendingFrom(startOfDay(day));
      setPendingTo(undefined);
      setSelectingFrom(false);
      setActivePreset("custom");
    } else {
      let from = pendingFrom!;
      let to = endOfDay(day);
      if (day < from) {
        to = endOfDay(from);
        from = startOfDay(day);
      }
      setPendingFrom(from);
      setPendingTo(to);
      setSelectingFrom(true);
      setActivePreset("custom");
      onChange({ from, to, dateField: value.dateField });
      setOpen(false);
    }
  };

  const selectedRange =
    pendingFrom && pendingTo
      ? { from: pendingFrom, to: pendingTo }
      : pendingFrom
        ? { from: pendingFrom, to: pendingFrom }
        : undefined;

  return (
    <div className="flex items-center gap-1.5">
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            className={`inline-flex items-center gap-1.5 h-8 rounded-full px-3 text-xs font-bold transition-all ${
              hasValue
                ? "bg-teal/10 text-teal border border-teal/30 hover:bg-teal/15"
                : "border border-charcoal/[0.12] text-charcoal-light hover:border-charcoal/[0.2] hover:text-charcoal"
            }`}
          >
            <CalendarIcon size={12} />
            <span className="whitespace-nowrap">{hasValue ? formatRange(value.from, value.to) : "Date Range"}</span>
            <ChevronDown size={10} className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={8}
            className="z-50 bg-white rounded-brand shadow-brand-lg border border-charcoal/[0.08] overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150"
          >
            {/* Header: date field toggle */}
            <div className="px-4 pt-4 pb-3 border-b border-charcoal/[0.06]">
              <p className="text-[11px] font-bold text-charcoal-light uppercase tracking-wider mb-2">Filter by</p>
              <div className="flex gap-1.5">
                {(["publishedAt", "createdAt"] as const).map((field) => (
                  <button
                    key={field}
                    onClick={() => onChange({ ...value, dateField: field })}
                    className={`h-7 rounded-full px-3 text-xs font-bold transition-all ${
                      value.dateField === field
                        ? "bg-teal text-white shadow-sm"
                        : "bg-teal/[0.06] text-charcoal-light hover:bg-teal/[0.12] hover:text-charcoal"
                    }`}
                  >
                    {FIELD_LABELS[field]}
                  </button>
                ))}
              </div>
            </div>

            {/* Presets row */}
            <div className="px-4 pt-3 pb-2">
              <div className="flex gap-1.5 flex-wrap">
                {([
                  ["today", "Today"],
                  ["yesterday", "Yesterday"],
                  ["last7", "Last 7 days"],
                  ["custom", "Custom"],
                ] as const).map(([preset, label]) => (
                  <button
                    key={preset}
                    onClick={() => {
                      if (preset === "custom") {
                        setActivePreset("custom");
                        setSelectingFrom(true);
                        setPendingFrom(undefined);
                        setPendingTo(undefined);
                      } else {
                        applyPreset(preset);
                      }
                    }}
                    className={`h-7 rounded-full px-3 text-xs font-bold transition-all ${
                      activePreset === preset
                        ? "bg-charcoal text-white shadow-sm"
                        : "bg-charcoal/[0.04] text-charcoal-light hover:bg-charcoal/[0.08] hover:text-charcoal"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Calendar */}
            <div className="px-1 pb-3">
              {activePreset === "custom" && (
                <p className="text-[11px] font-semibold text-charcoal-light mb-1 px-3">
                  {selectingFrom ? "Pick a start date" : "Now pick an end date"}
                </p>
              )}
              <Calendar
                mode="range"
                selected={selectedRange}
                onDayClick={handleDayClick}
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                disabled={{ after: new Date() }}
                numberOfMonths={1}
              />
            </div>

            <Popover.Arrow className="fill-white" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {hasValue && (
        <button
          onClick={onClear}
          className="h-6 w-6 rounded-full flex items-center justify-center text-charcoal-light hover:text-coral hover:bg-coral/10 transition-all"
          title="Clear date filter"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
