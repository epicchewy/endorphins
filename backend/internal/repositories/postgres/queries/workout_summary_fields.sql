(plan->>'level')::int AS level,
count(*) AS count,
COALESCE(sum((plan->>'estimatedMinutes')::int), 0) AS minutes
