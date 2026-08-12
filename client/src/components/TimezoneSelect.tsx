/**
 * TimezoneSelect — searchable combobox for the full IANA timezone list.
 *
 * - Populates from Intl.supportedValuesOf('timeZone') at runtime.
 * - UTC offsets are computed live (DST-accurate).
 * - Options are grouped by region (America, Asia, Europe, …).
 * - Supports free-text search across zone name and offset string.
 * - Existing saved values continue to display correctly.
 */

import { useState, useMemo, useRef, useEffect } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Return the current UTC offset string for a timezone, e.g. "GMT+8" or "GMT-5". */
function getUtcOffset(tz: string): string {
  try {
    // Use a fixed reference date so offsets are consistent within a render.
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(now);
    const offsetPart = parts.find((p) => p.type === "timeZoneName");
    if (offsetPart) {
      // Normalize "GMT+08:00" → "GMT+8", "GMT-05:00" → "GMT-5"
      return offsetPart.value
        .replace(/([+-])0(\d)(:00)?$/, "$1$2")
        .replace(/:00$/, "");
    }
  } catch {
    // fall through
  }
  return "GMT";
}

interface TimezoneOption {
  value: string;   // IANA zone id, e.g. "Asia/Manila"
  label: string;   // display label, e.g. "Asia/Manila (GMT+8)"
  region: string;  // first segment, e.g. "Asia"
  offset: string;  // e.g. "GMT+8"
  offsetMinutes: number; // for sorting within group
}

/** Build the sorted, labelled timezone list once (module-level cache). */
let _cachedOptions: TimezoneOption[] | null = null;

function buildTimezoneOptions(): TimezoneOption[] {
  if (_cachedOptions) return _cachedOptions;

  // Intl.supportedValuesOf is available in all modern browsers and Node ≥ 18.
  const zones: string[] = (Intl as any).supportedValuesOf?.("timeZone") ?? [
    // Minimal fallback for very old environments
    "Africa/Abidjan","America/Anchorage","America/Chicago","America/Denver",
    "America/Los_Angeles","America/New_York","America/Sao_Paulo",
    "Asia/Bangkok","Asia/Dubai","Asia/Hong_Kong","Asia/Kolkata",
    "Asia/Manila","Asia/Seoul","Asia/Shanghai","Asia/Singapore",
    "Asia/Tokyo","Australia/Melbourne","Australia/Sydney",
    "Europe/Amsterdam","Europe/Berlin","Europe/London","Europe/Moscow",
    "Europe/Paris","Pacific/Auckland","Pacific/Honolulu","UTC",
  ];

  _cachedOptions = zones
    .map((tz) => {
      const offset = getUtcOffset(tz);
      // Parse offset minutes for sorting (GMT+8 → 480, GMT-5 → -300, GMT → 0)
      const match = offset.match(/GMT([+-])(\d+)(?::(\d+))?/);
      let minutes = 0;
      if (match) {
        const sign = match[1] === "+" ? 1 : -1;
        minutes = sign * (parseInt(match[2], 10) * 60 + parseInt(match[3] ?? "0", 10));
      }
      const region = tz.includes("/") ? tz.split("/")[0] : "Other";
      return {
        value: tz,
        label: `${tz} (${offset})`,
        region,
        offset,
        offsetMinutes: minutes,
      };
    })
    .sort((a, b) => a.region.localeCompare(b.region) || a.offsetMinutes - b.offsetMinutes || a.value.localeCompare(b.value));

  return _cachedOptions;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface TimezoneSelectProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  triggerStyle?: React.CSSProperties;
  triggerClassName?: string;
  /** data-testid forwarded to the trigger button */
  "data-testid"?: string;
}

export function TimezoneSelect({
  value,
  onChange,
  placeholder = "Select timezone",
  triggerStyle,
  triggerClassName,
  "data-testid": testId,
}: TimezoneSelectProps) {
  const [open, setOpen] = useState(false);
  const options = useMemo(() => buildTimezoneOptions(), []);

  // Group options by region
  const grouped = useMemo(() => {
    const map = new Map<string, TimezoneOption[]>();
    for (const opt of options) {
      if (!map.has(opt.region)) map.set(opt.region, []);
      map.get(opt.region)!.push(opt);
    }
    return map;
  }, [options]);

  const selectedLabel = useMemo(() => {
    if (!value) return null;
    const found = options.find((o) => o.value === value);
    if (found) return found.label;
    // Value exists in DB but not in Intl list — show as-is with live offset
    return `${value} (${getUtcOffset(value)})`;
  }, [value, options]);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const [triggerWidth, setTriggerWidth] = useState<number | undefined>();

  useEffect(() => {
    if (open && triggerRef.current) {
      setTriggerWidth(triggerRef.current.offsetWidth);
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-expanded={open}
          data-testid={testId}
          className={cn(
            "flex w-full items-center justify-between whitespace-nowrap rounded-[10px] border px-[14px] text-left text-[15px]",
            "focus:outline-none focus:border-[#525BC8] focus:ring-2 focus:ring-[rgba(82,91,200,0.12)]",
            !value && "text-muted-foreground",
            triggerClassName,
          )}
          style={{
            height: 46,
            border: "1.5px solid rgba(75,81,184,0.14)",
            background: "#fff",
            cursor: "pointer",
            ...triggerStyle,
          }}
        >
          <span className="truncate">{selectedLabel ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        align="start"
        style={{ width: triggerWidth ? `${triggerWidth}px` : "320px" }}
      >
        <Command>
          <CommandInput placeholder="Search timezone…" />
          <CommandList className="max-h-[280px]">
            <CommandEmpty>No timezone found.</CommandEmpty>
            {Array.from(grouped.entries()).map(([region, tzList]) => (
              <CommandGroup key={region} heading={region}>
                {tzList.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={opt.label}   // cmdk searches against this
                    onSelect={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        value === opt.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {opt.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
