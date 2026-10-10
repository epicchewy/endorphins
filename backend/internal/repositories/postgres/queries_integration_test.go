//go:build integration

package postgres_test

import "embed"

// Complete statements are embedded at build time. Bind values at each call site.

//go:embed testdata/queries/allow_account_erasure.sql
var testAllowAccountErasureSQL string

//go:embed testdata/queries/create_database.sql
var testCreateDatabaseSQL string

//go:embed testdata/queries/drop_database.sql
var testDropDatabaseSQL string

//go:embed testdata/queries/legacy_version_three.sql
var testLegacyVersionThreeSQL string

//go:embed testdata/queries/legacy_version_two.sql
var testLegacyVersionTwoSQL string

//go:embed testdata/queries/reject_account_erasure.sql
var testRejectAccountErasureSQL string

//go:embed testdata/queries/reject_workout_write.sql
var testRejectWorkoutWriteSQL string

//go:embed testdata/queries/reset_tables.sql
var testResetTablesSQL string

//go:embed testdata/queries/unsupported_snapshot.sql
var testUnsupportedSnapshotSQL string

//go:embed migrations/*.sql
var testMigrationFiles embed.FS
