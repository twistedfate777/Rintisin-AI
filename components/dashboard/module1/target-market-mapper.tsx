import { EmptyState } from "@/components/dashboard/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { TargetMarketMapper as TargetMarketMapperData } from "@/lib/types";

export function TargetMarketMapper({ data }: { data: TargetMarketMapperData }) {
  const segment = data.primary_segment;
  // Ordered by priority ascending; ties keep the model's order (Array.sort is stable).
  const channels = [...data.effective_channels].sort((a, b) => a.priority - b.priority);

  return (
    <div className="grid grid-cols-1 gap-[var(--gap)] lg:grid-cols-12">
      <Card className="lg:col-span-7">
        <CardHeader>
          <CardTitle>Segmen utama</CardTitle>
          <p className="text-[15px] font-medium text-ink">{segment.persona_label}</p>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-[13px] text-ink-muted">Daya beli</dt>
              <dd className="mt-0.5 text-sm text-ink">{segment.purchasing_power}</dd>
            </div>
            <div className="sm:row-span-2">
              <dt className="text-[13px] text-ink-muted">Pain point utama</dt>
              <dd className="mt-1">
                {segment.core_pain_points.length === 0 ? (
                  <EmptyState>Data tidak tersedia.</EmptyState>
                ) : (
                  <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink marker:text-ink-muted">
                    {segment.core_pain_points.map((point, i) => (
                      <li key={`${point}-${i}`}>{point}</li>
                    ))}
                  </ul>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[13px] text-ink-muted">Perilaku pembelian</dt>
              <dd className="mt-0.5 text-sm text-ink">{segment.buying_behavior}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="lg:col-span-5">
        <CardHeader>
          <CardTitle>Kanal distribusi efektif</CardTitle>
        </CardHeader>
        <CardContent>
          {channels.length === 0 ? (
            <EmptyState>Data tidak tersedia. Belum ada kanal yang direkomendasikan.</EmptyState>
          ) : (
            <>
            {/* Phone: two-line rows, every field kept */}
            <ol className="flex flex-col sm:hidden">
              {channels.map((channel, i) => (
                <li key={`${channel.channel_name}-${i}`} className="flex gap-3 border-b border-rule py-3 first:pt-0 last:border-0 last:pb-0">
                  <span className="num w-5 flex-none text-right text-sm text-ink-muted" aria-label={`Prioritas ${channel.priority}`}>{channel.priority}</span>
                  <div>
                    <p className="text-sm font-medium text-ink">{channel.channel_name}</p>
                    <p className="mt-0.5 text-sm text-ink">{channel.strategy}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 text-right">Prioritas</TableHead>
                  <TableHead className="w-[38%]">Kanal</TableHead>
                  <TableHead>Strategi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.map((channel, i) => (
                  <TableRow key={`${channel.channel_name}-${i}`}>
                    <TableCell className="num text-right">{channel.priority}</TableCell>
                    <TableCell className="font-medium">{channel.channel_name}</TableCell>
                    <TableCell className="min-w-[220px]">{channel.strategy}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
