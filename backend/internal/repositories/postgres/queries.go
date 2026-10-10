package postgres

import _ "embed"

// GORM handles query structure. Embedded SQL holds Postgres-specific expressions.

//go:embed queries/lock_account.sql
var lockAccountSQL string

//go:embed queries/workout_level.sql
var workoutLevelSQL string

//go:embed queries/workout_minutes.sql
var workoutMinutesSQL string

//go:embed queries/workout_search.sql
var workoutSearchSQL string

//go:embed queries/workout_summary_fields.sql
var workoutSummaryFieldsSQL string

//go:embed queries/onboarding_timestamp.sql
var onboardingTimestampSQL string

//go:embed queries/undo_timestamp.sql
var undoTimestampSQL string

//go:embed queries/completion_id.sql
var completionIDSQL string

//go:embed queries/activity_counts.sql
var activityCountsSQL string

//go:embed queries/activity_weeks.sql
var activityWeeksSQL string
