/**
 * Calendar Working Hours — Unit Tests
 *
 * Verifies that buildSlotsFromScheduleData correctly:
 * - Excludes slots that fall outside the interviewer's configured working hours
 * - Excludes slots that fall on non-work days (e.g. Sunday when only Mon-Fri configured)
 * - Excludes slots that overlap a busy calendar block (e.g. a lunch break)
 * - Respects a non-UTC working-hours timezone (e.g. "America/Los_Angeles")
 * - Maps Windows timezone names to IANA equivalents
 *
 * These tests are pure unit tests — no network calls, no database, no HTTP server.
 *
 * Run with: npm test
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildSlotsFromScheduleData,
  windowsToIana,
  type ParsedWorkingHours,
  type BusyInterval,
  type AvailableSlot,
} from "../services/microsoftGraphCalendarService.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a UTC epoch ms from a date string + hour + minute in UTC. */
function utcMs(dateStr: string, hour: number, minute = 0): number {
  return new Date(
    `${dateStr}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`,
  ).getTime();
}

/** Working hours: Mon–Fri, 09:00–18:00, UTC. */
const MON_FRI_9_18_UTC: ParsedWorkingHours = {
  workDays:    new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]),
  startHour:   9,
  startMinute: 0,
  endHour:     18,
  endMinute:   0,
  timezone:    "UTC",
};

/** Working hours: Mon–Thu, 08:00–17:00, America/Los_Angeles. */
const MON_THU_8_17_LA: ParsedWorkingHours = {
  workDays:    new Set(["Mon", "Tue", "Wed", "Thu"]),
  startHour:   8,
  startMinute: 0,
  endHour:     17,
  endMinute:   0,
  timezone:    "America/Los_Angeles",
};

// ── windowsToIana ─────────────────────────────────────────────────────────────

describe("windowsToIana", () => {
  it("maps 'Pacific Standard Time' to 'America/Los_Angeles'", () => {
    assert.equal(windowsToIana("Pacific Standard Time"), "America/Los_Angeles");
  });

  it("maps 'Eastern Standard Time' to 'America/New_York'", () => {
    assert.equal(windowsToIana("Eastern Standard Time"), "America/New_York");
  });

  it("maps 'GMT Standard Time' to 'Europe/London'", () => {
    assert.equal(windowsToIana("GMT Standard Time"), "Europe/London");
  });

  it("maps 'Tokyo Standard Time' to 'Asia/Tokyo'", () => {
    assert.equal(windowsToIana("Tokyo Standard Time"), "Asia/Tokyo");
  });

  it("maps 'India Standard Time' to 'Asia/Kolkata'", () => {
    assert.equal(windowsToIana("India Standard Time"), "Asia/Kolkata");
  });

  it("passes an unknown name through unchanged (graceful fallback)", () => {
    assert.equal(windowsToIana("Imaginary Standard Time"), "Imaginary Standard Time");
  });

  it("maps 'UTC' to 'UTC'", () => {
    assert.equal(windowsToIana("UTC"), "UTC");
  });
});

// ── Slots outside working hours are excluded ──────────────────────────────────

describe("buildSlotsFromScheduleData — working-hours boundary", () => {
  it("does not return any slot that starts before the work-start hour", () => {
    // Mon–Fri 09:00–18:00 UTC; 2030-01-07 is a Monday
    const slots = buildSlotsFromScheduleData(
      MON_FRI_9_18_UTC,
      [],                 // no busy items
      "2030-01-07",
      "2030-01-07",
      30,
      "UTC",
    );
    for (const slot of slots) {
      const startHour = new Date(slot.start).getUTCHours();
      assert.ok(startHour >= 9, `Slot at ${slot.start} starts before 09:00`);
    }
  });

  it("does not return any slot that ends after the work-end hour", () => {
    const slots = buildSlotsFromScheduleData(
      MON_FRI_9_18_UTC,
      [],
      "2030-01-07",
      "2030-01-07",
      30,
      "UTC",
    );
    for (const slot of slots) {
      const endHour = new Date(slot.end).getUTCHours();
      const endMin  = new Date(slot.end).getUTCMinutes();
      const endTotalMins = endHour * 60 + endMin;
      assert.ok(
        endTotalMins <= 18 * 60,
        `Slot ends at ${slot.end} which is after 18:00`,
      );
    }
  });

  it("returns the expected number of 30-min slots in a 9-to-18 window", () => {
    // 9 hrs × 2 slots/hr = 18 slots
    const slots = buildSlotsFromScheduleData(
      MON_FRI_9_18_UTC,
      [],
      "2030-01-07",
      "2030-01-07",
      30,
      "UTC",
    );
    assert.equal(slots.length, 18);
  });

  it("generates no slots when start == end for working hours (zero-width window)", () => {
    const zeroWindow: ParsedWorkingHours = {
      ...MON_FRI_9_18_UTC,
      startHour: 9,
      startMinute: 0,
      endHour: 9,
      endMinute: 0,
    };
    const slots = buildSlotsFromScheduleData(zeroWindow, [], "2030-01-07", "2030-01-07", 30, "UTC");
    assert.equal(slots.length, 0);
  });
});

// ── Non-work days are excluded ────────────────────────────────────────────────

describe("buildSlotsFromScheduleData — non-work days", () => {
  it("returns no slots on Saturday when only Mon–Fri are configured", () => {
    // 2030-01-12 is a Saturday
    const slots = buildSlotsFromScheduleData(
      MON_FRI_9_18_UTC,
      [],
      "2030-01-12",
      "2030-01-12",
      30,
      "UTC",
    );
    assert.equal(slots.length, 0);
  });

  it("returns no slots on Sunday when only Mon–Fri are configured", () => {
    // 2030-01-13 is a Sunday
    const slots = buildSlotsFromScheduleData(
      MON_FRI_9_18_UTC,
      [],
      "2030-01-13",
      "2030-01-13",
      30,
      "UTC",
    );
    assert.equal(slots.length, 0);
  });

  it("returns no slots on Friday when workDays is Mon–Thu only", () => {
    // 2030-01-11 is a Friday
    const slots = buildSlotsFromScheduleData(
      MON_THU_8_17_LA,
      [],
      "2030-01-11",
      "2030-01-11",
      30,
      "America/Los_Angeles",
    );
    assert.equal(slots.length, 0, "Friday should produce no slots for a Mon–Thu schedule");
  });

  it("returns slots on Thursday when workDays is Mon–Thu", () => {
    // 2030-01-10 is a Thursday
    const slots = buildSlotsFromScheduleData(
      MON_THU_8_17_LA,
      [],
      "2030-01-10",
      "2030-01-10",
      30,
      "America/Los_Angeles",
    );
    assert.ok(slots.length > 0, "Thursday should have available slots");
  });

  it("counts correct slots across a Mon–Fri week with a weekend in the range", () => {
    // 2030-01-07 Mon → 2030-01-13 Sun = 5 weekdays × 18 slots = 90
    const slots = buildSlotsFromScheduleData(
      MON_FRI_9_18_UTC,
      [],
      "2030-01-07",
      "2030-01-13",
      30,
      "UTC",
    );
    assert.equal(slots.length, 5 * 18);
  });
});

// ── Busy calendar blocks (e.g. lunch break) are excluded ─────────────────────

describe("buildSlotsFromScheduleData — busy interval exclusion", () => {
  it("excludes a 30-min slot that exactly matches a busy block", () => {
    // Block 12:00–12:30 UTC on Monday
    const busy: BusyInterval[] = [
      { startMs: utcMs("2030-01-07", 12, 0), endMs: utcMs("2030-01-07", 12, 30) },
    ];
    const slots = buildSlotsFromScheduleData(
      MON_FRI_9_18_UTC,
      busy,
      "2030-01-07",
      "2030-01-07",
      30,
      "UTC",
    );
    const blocked = slots.some(
      (s) => new Date(s.start).getTime() === utcMs("2030-01-07", 12, 0),
    );
    assert.equal(blocked, false, "12:00 slot must be excluded (blocked by busy item)");
    // 18 total - 1 blocked = 17
    assert.equal(slots.length, 17);
  });

  it("excludes all slots that overlap a 1-hour lunch break (12:00–13:00)", () => {
    // A 1-hour lunch blocks the 12:00 and 12:30 slots.
    const busy: BusyInterval[] = [
      { startMs: utcMs("2030-01-07", 12, 0), endMs: utcMs("2030-01-07", 13, 0) },
    ];
    const slots = buildSlotsFromScheduleData(
      MON_FRI_9_18_UTC,
      busy,
      "2030-01-07",
      "2030-01-07",
      30,
      "UTC",
    );

    const blockedStart12 = slots.some((s) => new Date(s.start).getTime() === utcMs("2030-01-07", 12, 0));
    const blockedStart1230 = slots.some((s) => new Date(s.start).getTime() === utcMs("2030-01-07", 12, 30));
    assert.equal(blockedStart12,   false, "12:00 slot overlaps lunch and must be excluded");
    assert.equal(blockedStart1230, false, "12:30 slot overlaps lunch and must be excluded");
    // 18 - 2 = 16 remaining
    assert.equal(slots.length, 16);
  });

  it("does not exclude a slot immediately after the busy block ends", () => {
    // Block 12:00–12:30; the 12:30 slot should still be available.
    const busy: BusyInterval[] = [
      { startMs: utcMs("2030-01-07", 12, 0), endMs: utcMs("2030-01-07", 12, 30) },
    ];
    const slots = buildSlotsFromScheduleData(
      MON_FRI_9_18_UTC,
      busy,
      "2030-01-07",
      "2030-01-07",
      30,
      "UTC",
    );
    const has1230 = slots.some((s) => new Date(s.start).getTime() === utcMs("2030-01-07", 12, 30));
    assert.equal(has1230, true, "12:30 slot should be available after a 12:00–12:30 block");
  });

  it("excludes slots that partially overlap a busy block", () => {
    // Block 11:45–12:15 blocks both the 11:30 slot (11:30–12:00) and the 12:00 slot (12:00–12:30)
    const busy: BusyInterval[] = [
      { startMs: utcMs("2030-01-07", 11, 45), endMs: utcMs("2030-01-07", 12, 15) },
    ];
    const slots = buildSlotsFromScheduleData(
      MON_FRI_9_18_UTC,
      busy,
      "2030-01-07",
      "2030-01-07",
      30,
      "UTC",
    );
    const has1130 = slots.some((s) => new Date(s.start).getTime() === utcMs("2030-01-07", 11, 30));
    const has1200 = slots.some((s) => new Date(s.start).getTime() === utcMs("2030-01-07", 12, 0));
    assert.equal(has1130, false, "11:30 slot partially overlaps the block and must be excluded");
    assert.equal(has1200, false, "12:00 slot partially overlaps the block and must be excluded");
  });

  it("does not exclude a slot on a different day from the busy block", () => {
    // Block on Monday 12:00–12:30
    const busy: BusyInterval[] = [
      { startMs: utcMs("2030-01-07", 12, 0), endMs: utcMs("2030-01-07", 12, 30) },
    ];
    // Check slots on Tuesday
    const slots = buildSlotsFromScheduleData(
      MON_FRI_9_18_UTC,
      busy,
      "2030-01-08",
      "2030-01-08",
      30,
      "UTC",
    );
    assert.equal(slots.length, 18, "Busy block on Monday must not affect Tuesday's slots");
  });
});

// ── Non-UTC working-hours timezone ────────────────────────────────────────────

describe("buildSlotsFromScheduleData — non-UTC working-hours timezone", () => {
  it("generates slots within PST working hours when workingHours.timezone is America/Los_Angeles", () => {
    // Mon–Fri 08:00–17:00 America/Los_Angeles (UTC-8 in standard time)
    // On 2030-01-07 (Monday), 08:00 PST = 16:00 UTC, 17:00 PST = 01:00 UTC next day
    const slots = buildSlotsFromScheduleData(
      MON_THU_8_17_LA,
      [],
      "2030-01-07",
      "2030-01-07",
      60,
      "America/Los_Angeles",
    );
    // 8 AM – 5 PM is 9 hours → 9 × 1 slot/hr = 9 slots
    assert.equal(slots.length, 9, `Expected 9 one-hour slots in an 8–17 window, got ${slots.length}`);
  });

  it("slot start/end displays are expressed in the display timezone, not working-hours timezone", () => {
    // Display timezone = UTC; working-hours timezone = Asia/Kolkata (UTC+5:30).
    // Working hours: Mon–Fri 09:00–10:00 IST
    //   09:00 IST = 03:30 UTC
    //   10:00 IST = 04:30 UTC
    // Requesting display date "2030-01-07" (Monday in UTC and IST).
    // The fixed algorithm iterates IST calendar dates and generates slots
    // for IST Monday, then filters to the UTC display range — should yield 2 slots.
    const wh: ParsedWorkingHours = {
      workDays:    new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]),
      startHour:   9,
      startMinute: 0,
      endHour:     10,
      endMinute:   0,
      timezone:    "Asia/Kolkata",
    };
    const slots = buildSlotsFromScheduleData(wh, [], "2030-01-07", "2030-01-07", 30, "UTC");
    assert.equal(slots.length, 2, "Should produce 2 thirty-min slots in a 9–10 IST window");
    // Displays should be in UTC: 03:30 AM and 04:00 AM
    assert.ok(
      slots[0].startDisplay.includes("03:30 AM"),
      `First slot startDisplay should be 03:30 AM UTC (= 09:00 IST), got: ${slots[0].startDisplay}`,
    );
    assert.ok(
      slots[1].startDisplay.includes("04:00 AM"),
      `Second slot startDisplay should be 04:00 AM UTC (= 09:30 IST), got: ${slots[1].startDisplay}`,
    );
  });
});

// ── Cross-timezone boundary regression tests ──────────────────────────────────
//
// These guard the specific failure the original algorithm had:
//   - display timezone BEHIND wh timezone → working days were skipped because
//     UTC midnight was still the prior day in the wh timezone
//   - display timezone AHEAD of wh timezone → slots could fall outside the
//     requested display-date range

describe("buildSlotsFromScheduleData — cross-timezone boundary regressions", () => {
  // ── UTC display, LA working hours (display behind wh) ────────────────────

  it("UTC display / LA working hours: Monday slots appear when requesting 2030-01-07 in UTC", () => {
    // 2030-01-07 is a Monday.  UTC midnight (00:00Z) is still Sunday in LA (16:00 PST
    // on 2030-01-06).  The old algorithm iterated UTC midnights and checked the LA
    // weekday of each midnight — it saw Sunday and produced zero slots.
    // The fixed algorithm iterates LA calendar dates, so LA Monday is found correctly.
    //
    // LA working hours Mon–Fri 09:00–18:00 (UTC-8):
    //   09:00 PST = 17:00 UTC on 2030-01-07
    //   18:00 PST = 02:00 UTC on 2030-01-08
    // Display range = "2030-01-07" in UTC = 00:00Z → 24:00Z on 2030-01-07.
    // Slots with start < 24:00Z on 2030-01-07: 17:00–17:30, 17:30–18:00 ... up to 23:30 start.
    // From 17:00 to 24:00 = 7 hours → 14 thirty-min slots within the display day.
    const wh: ParsedWorkingHours = {
      workDays:    new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]),
      startHour:   9,
      startMinute: 0,
      endHour:     18,
      endMinute:   0,
      timezone:    "America/Los_Angeles",
    };
    const slots = buildSlotsFromScheduleData(wh, [], "2030-01-07", "2030-01-07", 30, "UTC");
    assert.ok(slots.length > 0, "Monday slots must appear for a UTC display / LA working-hours combination");
    // All returned slots must have a display date of "2030-01-07"
    for (const slot of slots) {
      assert.equal(slot.date, "2030-01-07", `Slot date should be 2030-01-07, got ${slot.date}`);
    }
  });

  it("UTC display / LA working hours: no slots appear on Saturday (2030-01-12) in UTC", () => {
    const wh: ParsedWorkingHours = {
      workDays:    new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]),
      startHour:   9,
      startMinute: 0,
      endHour:     18,
      endMinute:   0,
      timezone:    "America/Los_Angeles",
    };
    // 2030-01-12 is Saturday in UTC.  LA is UTC-8 so midnight UTC is still Friday in LA,
    // but the work window for LA Friday falls on 2030-01-11 UTC — outside this display range.
    const slots = buildSlotsFromScheduleData(wh, [], "2030-01-12", "2030-01-12", 30, "UTC");
    // Saturday UTC display day may contain the tail of Friday's LA window; verify none
    // of the returned slots report a display date outside the requested range.
    for (const slot of slots) {
      assert.equal(slot.date, "2030-01-12", `Slot date should be 2030-01-12, got ${slot.date}`);
    }
  });

  // ── LA display, Tokyo working hours (display ahead of wh) ───────────────

  it("LA display / Tokyo working hours: no out-of-range slots returned for 2030-01-07", () => {
    // Tokyo (UTC+9) is 17 hours ahead of LA (UTC-8).
    // Requesting 2030-01-07 in LA display timezone.
    // We must not receive slots whose display date is outside 2030-01-07.
    const wh: ParsedWorkingHours = {
      workDays:    new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]),
      startHour:   9,
      startMinute: 0,
      endHour:     18,
      endMinute:   0,
      timezone:    "Asia/Tokyo",
    };
    const slots = buildSlotsFromScheduleData(
      wh,
      [],
      "2030-01-07",
      "2030-01-07",
      30,
      "America/Los_Angeles",
    );
    for (const slot of slots) {
      assert.equal(
        slot.date,
        "2030-01-07",
        `Slot date must be within the requested display range; got ${slot.date}`,
      );
    }
  });

  it("LA display / Tokyo working hours: correct weekday filtering across the 17-hour offset", () => {
    // 2030-01-07 in LA is Monday.  Tokyo is 17 hours ahead, so when LA Monday starts
    // (2030-01-07 00:00 PST = 2030-01-07 08:00 UTC), it is already Monday in Tokyo too.
    // Tokyo work window Mon 09:00–18:00 JST = 00:00 UTC–09:00 UTC on 2030-01-07.
    // These UTC times correspond to LA Sunday (2030-01-06) so they fall before the
    // LA display range.  The only Tokyo-Monday work-window UTC that falls on LA Monday
    // are the hours from LA midnight (2030-01-07 08:00 UTC = 17:00 JST) to end of
    // LA Monday (2030-01-08 08:00 UTC).  No Tokyo Mon work-window hours (09–18 JST =
    // 00–09 UTC) survive this filter.
    // Therefore, zero slots should appear for LA Monday display when the Tokyo
    // Mon window has already passed (Tokyo Tuesday's window starts at 2030-01-07 09:00
    // JST = 2030-01-07 00:00 UTC; the work-window 09:00–18:00 JST on Tokyo Tue =
    // 00:00–09:00 UTC on 2030-01-08, which is outside LA Monday).
    // Key assertion: whatever count comes back, every slot's date must equal "2030-01-07".
    const wh: ParsedWorkingHours = {
      workDays:    new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]),
      startHour:   9,
      startMinute: 0,
      endHour:     18,
      endMinute:   0,
      timezone:    "Asia/Tokyo",
    };
    const slots = buildSlotsFromScheduleData(
      wh,
      [],
      "2030-01-07",
      "2030-01-07",
      30,
      "America/Los_Angeles",
    );
    for (const slot of slots) {
      assert.equal(slot.date, "2030-01-07", `Out-of-range slot date: ${slot.date}`);
    }
  });

  it("multi-day range: all slots fall within the requested display date range", () => {
    // A 5-day range with LA display / Tokyo working hours.
    // Regardless of offset direction every slot's date must be within [startDate, endDate].
    const wh: ParsedWorkingHours = {
      workDays:    new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]),
      startHour:   9,
      startMinute: 0,
      endHour:     18,
      endMinute:   0,
      timezone:    "Asia/Tokyo",
    };
    const startDate = "2030-01-07";
    const endDate   = "2030-01-11";
    const slots = buildSlotsFromScheduleData(wh, [], startDate, endDate, 30, "America/Los_Angeles");
    for (const slot of slots) {
      assert.ok(
        slot.date >= startDate && slot.date <= endDate,
        `Slot date ${slot.date} outside requested range [${startDate}, ${endDate}]`,
      );
    }
  });
});
