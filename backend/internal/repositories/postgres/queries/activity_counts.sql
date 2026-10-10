count(*) AS completed_count,
count(DISTINCT (completed_at AT TIME ZONE ?)::date)
    FILTER (WHERE completed_at >= ? AND completed_at < ?) AS active_days_this_week
