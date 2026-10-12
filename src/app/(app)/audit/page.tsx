"use client";
import { useEffect, useState } from "react";

type Log = { id: number; action: string; recordType: string | null; recordId: number | null; userName: string; createdAt: string; newValue: string | null };

export default function AuditPage() {
  const [rows, setRows] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/audit").then((r) => r.json()).then((d) => setRows(d.logs || [])).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">Audit Log</h1>
        <p className="text-sm text-slate-500">Every important change is recorded here — who did what, and when. Posted records are voided, never deleted.</p>
      </div>
      <div className="card p-2 sm:p-4">
        {loading ? <p className="p-4 text-slate-500">Loading...</p> : rows.length === 0 ? (
          <div className="p-6 text-center text-slate-500">No audit records yet.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>When</th><th>User</th><th>Action</th><th>Record</th><th>Details</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap text-xs">{new Date(r.createdAt).toLocaleString()}</td>
                    <td>{r.userName}</td>
                    <td className="font-semibold">{r.action}</td>
                    <td className="text-xs">{r.recordType || "—"}{r.recordId ? ` #${r.recordId}` : ""}</td>
                    <td className="text-xs text-slate-500 max-w-[280px] truncate">{r.newValue || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
