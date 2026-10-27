import { EmptyState } from "@/components/dashboard/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Step2Result } from "@/lib/types";

export function CompetitorMatrix({ data }: { data: Step2Result["competitor_matrix"] }) {
  return (
    <div className="flex flex-col gap-[var(--gap)]">
      {/* The UVP sits above the table, full width, in a larger size than the table text (Req 8.1). */}
      <Card>
        <CardHeader>
          <CardTitle>Rekomendasi nilai jual unik (UVP)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="max-w-[70ch] text-[19px] leading-7 text-ink">{data.recommended_uvp}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Konsep Anda vs pemain lokal</CardTitle>
        </CardHeader>
        <CardContent>
          {data.comparison_table.length === 0 ? (
            <EmptyState>Belum ada atribut pembanding untuk ditampilkan.</EmptyState>
          ) : (
            // Scrolls inside its own frame below 768px; the page never scrolls sideways (Req 8.3).
            <div className="overflow-x-auto" role="region" aria-label="Tabel perbandingan, dapat digulir" tabIndex={0}>
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-rule-strong">
                    <th scope="col" className="h-9 w-[18%] pr-3 text-left text-xs font-normal text-ink-muted">Atribut</th>
                    <th scope="col" className="h-9 w-[24%] px-3 text-left text-xs font-normal text-ink-muted">Konsep Anda</th>
                    <th scope="col" className="h-9 w-[24%] px-3 text-left text-xs font-normal text-ink-muted">Pemain lokal</th>
                    <th scope="col" className="h-9 pl-3 text-left text-xs font-normal text-ink-muted">Keunggulan kompetitif</th>
                  </tr>
                </thead>
                <tbody>
                  {data.comparison_table.map((row, i) => (
                    <tr key={`${row.attribute}-${i}`} className="border-b border-rule last:border-0">
                      <th scope="row" className="py-3 pr-3 text-left align-top font-medium text-ink">{row.attribute}</th>
                      <td className="px-3 py-3 align-top text-ink">{row.user_concept}</td>
                      <td className="px-3 py-3 align-top text-ink-muted">{row.local_incumbents}</td>
                      <td className="py-3 pl-3 align-top text-ink">{row.competitive_advantage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
