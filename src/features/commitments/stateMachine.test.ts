import { describe, expect, it } from "vitest";
import { canDelete, canFinalizeProof, canLock, isOverdue } from "./stateMachine";

const now = new Date("2026-09-07T12:00:00Z");
const future = new Date("2026-09-08T12:00:00Z");
const past = new Date("2026-09-06T12:00:00Z");

describe("canLock", () => {
  it("allows locking a draft with a future deadline", () => {
    expect(canLock("draft", future, now)).toBe(true);
  });
  it("refuses a draft whose deadline already passed", () => {
    expect(canLock("draft", past, now)).toBe(false);
  });
  it("refuses any non-draft status", () => {
    expect(canLock("locked", future, now)).toBe(false);
    expect(canLock("completed", future, now)).toBe(false);
    expect(canLock("failed", future, now)).toBe(false);
  });
});

describe("canDelete", () => {
  it("allows deleting only drafts", () => {
    expect(canDelete("draft")).toBe(true);
    expect(canDelete("locked")).toBe(false);
    expect(canDelete("completed")).toBe(false);
    expect(canDelete("failed")).toBe(false);
  });
});

describe("canFinalizeProof", () => {
  it("allows finalizing a locked commitment before its deadline", () => {
    expect(canFinalizeProof("locked", future, now)).toBe(true);
  });
  it("refuses once the deadline has passed", () => {
    expect(canFinalizeProof("locked", past, now)).toBe(false);
  });
  it("refuses non-locked statuses", () => {
    expect(canFinalizeProof("draft", future, now)).toBe(false);
  });
});

describe("isOverdue", () => {
  it("flags a locked commitment past its deadline", () => {
    expect(isOverdue("locked", past, now)).toBe(true);
  });
  it("does not flag a locked commitment still within its deadline", () => {
    expect(isOverdue("locked", future, now)).toBe(false);
  });
  it("does not flag non-locked statuses", () => {
    expect(isOverdue("failed", past, now)).toBe(false);
  });
});
