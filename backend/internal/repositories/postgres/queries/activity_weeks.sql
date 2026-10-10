to_char(date_trunc('week', completed_at AT TIME ZONE ?), 'YYYY-MM-DD') AS start,
count(*) AS count
