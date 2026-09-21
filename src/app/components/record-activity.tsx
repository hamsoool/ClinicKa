import { useQuery } from '@tanstack/react-query';
import { Activity, Clock3 } from 'lucide-react';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { getStudentAuditHistory } from '../lib/api';

type RecordActivityProps = {
  studentId?: string | null;
};

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function formatDate(value?: string | null) {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown time' : dateTimeFormatter.format(date);
}

function actionLabel(action: string) {
  return action.replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

export default function RecordActivity({ studentId }: RecordActivityProps) {
  const query = useQuery({
    queryKey: ['studentAuditHistory', studentId],
    queryFn: () => getStudentAuditHistory(String(studentId)),
    enabled: Boolean(studentId),
    staleTime: 30_000,
  });
  const events = query.data?.data || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4 text-primary" />Record Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {query.isLoading ? <p className="text-sm text-muted-foreground">Loading record activity...</p> : null}
        {query.isError ? <p className="text-sm text-destructive">Record activity could not be loaded.</p> : null}
        {!query.isLoading && !query.isError && events.length === 0 ? <p className="text-sm text-muted-foreground">No activity has been recorded for this student yet.</p> : null}
        {events.length > 0 ? (
          <div className="space-y-4">
            {events.map((event) => (
              <div key={event.id} className="flex gap-3 border-b border-border/60 pb-4 last:border-0 last:pb-0">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{actionLabel(event.action)}</p>
                    <Badge variant="outline" className="text-[11px]">{event.result}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">by {event.actor}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(event.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}