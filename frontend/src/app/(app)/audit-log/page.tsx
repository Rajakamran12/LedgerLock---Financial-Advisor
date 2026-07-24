import { AuditLogView } from "@/components/audit/audit-log-view";

export default function AuditLogPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          Every answer and refusal across all your documents, in one place.
        </p>
      </div>
      <AuditLogView />
    </div>
  );
}
