// Package postgres implements persistence with GORM and versioned SQL migrations.
package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"
	gormPostgres "gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Open(ctx context.Context, url string) (*gorm.DB, error) {
	cfg, err := pgx.ParseConfig(url)
	if err != nil {
		return nil, fmt.Errorf("invalid database configuration")
	}
	cfg.ConnectTimeout = 5 * time.Second
	cfg.RuntimeParams["statement_timeout"] = "5000"
	pool := stdlib.OpenDB(*cfg)
	pool.SetMaxOpenConns(10)
	pool.SetMaxIdleConns(10)
	pool.SetConnMaxLifetime(time.Hour)
	pool.SetConnMaxIdleTime(5 * time.Minute)
	if err := pool.PingContext(ctx); err != nil {
		_ = pool.Close()
		return nil, fmt.Errorf("connect to database: %w", err)
	}
	db, err := gorm.Open(gormPostgres.New(gormPostgres.Config{Conn: pool}), &gorm.Config{
		DisableAutomaticPing:   true,
		SkipDefaultTransaction: true,
		Logger:                 logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		_ = pool.Close()
		return nil, fmt.Errorf("initialize database: %w", err)
	}
	return db, nil
}
