// Pure — no Supabase import here on purpose, so this stays unit-testable
// without a live project. api.ts is the only place that touches the
// storage client itself.

function extensionFor(file: File): string {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName.length <= 5 && fromName !== file.name) {
    return fromName.toLowerCase();
  }
  const fromType = file.type.split("/").pop();
  return fromType ? fromType.toLowerCase() : "jpg";
}

// Matches the bucket layout the Phase 1 migration's storage policies
// enforce: only the owner's own `{user_id}/...` prefix is writable.
export function buildProofPath(userId: string, commitmentId: string, file: File, uuid: string): string {
  return `${userId}/${commitmentId}/${uuid}.${extensionFor(file)}`;
}
