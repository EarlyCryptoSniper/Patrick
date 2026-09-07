import { describe, expect, it } from "vitest";
import type { CommitmentStatus } from "../../lib/types";
import { canDelete, canFinalizeProof, canLock, isOverdue } from "./stateMachine";

const now = new Date("2026-09-07T12:00:00Z");
const future = new Date("2026-09-08T12:00:00Z");
const past = new Date("2026-09-06T12:00:00Z");

const ALL_STATUSES: CommitmentStatus[] = ["draft", "locked", "completed", "failed"];

describe("canLock", () => {
  it("allows locking a draft with a future deadline", () => {
    expect(canLock("draft", future, now)).toBe(true);
  });
  it("refuses a draft whose deadline already passed", () => {
    expect(canLock("draft", past, now)).toBe(false);
  });
  it("refuses a draft whose deadline is exactly now (strict future required)", () => {
    expect(canLock("draft", now, now)).toBe(false);
  });
  it("refuses every non-draft status even with a future deadline", () => {
    for (const status of ALL_STATUSES.filter((s) => s !== "draft")) {
      expect(canLock(status, future, now)).toBe(false);
    }
  });
});

describe("canDelete", () => {
  it("allows deleting only drafts", () => {
    for (const status of ALL_STATUSES) {
      expect(canDelete(status)).toBe(status === "draft");
    }
  });
});

describe("canFinalizeProof", () => {
  it("allows finalizing a locked commitment before its deadline", () => {
    expect(canFinalizeProof("locked", future, now)).toBe(true);
  });
  it("allows finalizing exactly at the deadline (inclusive boundary, matches the RPC's < check)", () => {
    expect(canFinalizeProof("locked", now, now)).toBe(true);
  });
  it("refuses once the deadline has passed", () => {
    expect(canFinalizeProof("locked", past, now)).toBe(false);
  });
  it("refuses every non-locked status even before the deadline", () => {
    for (const status of ALL_STATUSES.filter((s) => s !== "locked")) {
      expect(canFinalizeProof(status, future, now)).toBe(false);
    }
  });
});

describe("isOverdue", () => {
  it("flags a locked commitment past its deadline", () => {
    expect(isOverdue("locked", past, now)).toBe(true);
  });
  it("does not flag a locked commitment exactly at its deadline", () => {
    expect(isOverdue("locked", now, now)).toBe(false);
  });
  it("does not flag a locked commitment still within its deadline", () => {
    expect(isOverdue("locked", future, now)).toBe(false);
  });
  it("never flags a non-locked status, even with a deadline in the past", () => {
    for (const status of ALL_STATUSES.filter((s) => s !== "locked")) {
      expect(isOverdue(status, past, now)).toBe(false);
    }
  });
});
