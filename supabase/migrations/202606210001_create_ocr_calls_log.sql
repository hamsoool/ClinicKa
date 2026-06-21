-- Create OCR calls log table
create table if not exists public.ocr_calls_log (
    id uuid default gen_random_uuid() primary key,
    timestamp bigint not null,
    provider text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.ocr_calls_log enable row level security;

-- Create policies
create policy "Allow service role full access" on public.ocr_calls_log
    for all to service_role using (true) with check (true);

create policy "Allow authenticated read access" on public.ocr_calls_log
    for select to authenticated using (true);
