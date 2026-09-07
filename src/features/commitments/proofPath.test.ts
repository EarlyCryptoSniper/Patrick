import { describe, expect, it } from "vitest";
import { buildProofPath } from "./proofPath";

const UUID = "b6a1f7c0-0000-4000-8000-000000000000";

describe("buildProofPath", () => {
  it("uses the file's own extension when it has one", () => {
    const file = new File(["x"], "bewijs.png", { type: "image/png" });
    expect(buildProofPath("user-1", "commit-1", file, UUID)).toBe(
      `user-1/commit-1/${UUID}.png`,
    );
  });

  it("falls back to the mime type when the filename has no extension", () => {
    const file = new File(["x"], "IMG_1234", { type: "image/jpeg" });
    expect(buildProofPath("user-1", "commit-1", file, UUID)).toBe(
      `user-1/commit-1/${UUID}.jpeg`,
    );
  });

  it("falls back to jpg when neither the filename nor the mime type gives an extension", () => {
    const file = new File(["x"], "blob", { type: "" });
    expect(buildProofPath("user-1", "commit-1", file, UUID)).toBe(
      `user-1/commit-1/${UUID}.jpg`,
    );
  });

  it("scopes the path under the owner's own folder, matching the storage RLS policy", () => {
    const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });
    const path = buildProofPath("user-42", "commit-7", file, UUID);
    expect(path.startsWith("user-42/")).toBe(true);
  });
});
