-- Literal substring search over the same fields displayed in the library.
(
strpos(lower(plan->>'focus'), ?) > 0
OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(plan->'blocks') b
    WHERE strpos(lower(b->>'name'), ?) > 0
       OR EXISTS (
           SELECT 1 FROM jsonb_array_elements(b->'exercises') e
           WHERE strpos(lower(e->>'name'), ?) > 0
       )
)
)
