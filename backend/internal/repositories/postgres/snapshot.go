package postgres

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/epicchewy/endorphins/backend/internal/domains"
)

// These types are the permanent v1 storage contract. They intentionally do not
// embed API or domain values: renaming either must not rewrite historical plans.
type snapshotV1 struct {
	Level            int       `json:"level"`
	RequestedMinutes int       `json:"requestedMinutes"`
	EstimatedMinutes int       `json:"estimatedMinutes"`
	WarmupMinutes    int       `json:"warmupMinutes"`
	Focus            string    `json:"focus"`
	Blocks           []blockV1 `json:"blocks"`
}
type blockV1 struct {
	Name             string       `json:"name"`
	Sets             int          `json:"sets"`
	EstimatedMinutes int          `json:"estimatedMinutes"`
	Difficulty       string       `json:"difficulty"`
	Exercises        []exerciseV1 `json:"exercises"`
}
type exerciseV1 struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Difficulty  string `json:"difficulty"`
	Reps        int    `json:"reps,omitempty"`
	Duration    int    `json:"duration,omitempty"`
	Rest        int    `json:"rest,omitempty"`
	Rounds      int    `json:"rounds,omitempty"`
}

func encodeSnapshot(w domains.WorkoutPlan) ([]byte, error) {
	result := snapshotV1{
		Level:            w.Level,
		RequestedMinutes: w.RequestedMinutes,
		EstimatedMinutes: w.EstimatedMinutes,
		WarmupMinutes:    w.WarmupMinutes,
		Focus:            w.Focus,
		Blocks:           make([]blockV1, 0, len(w.Blocks)),
	}
	for _, b := range w.Blocks {
		block := blockV1{
			Name:             b.Name,
			Sets:             b.Sets,
			EstimatedMinutes: b.EstimatedMinutes,
			Difficulty:       b.Difficulty,
			Exercises:        make([]exerciseV1, 0, len(b.Exercises)),
		}
		for _, e := range b.Exercises {
			block.Exercises = append(block.Exercises, exerciseV1(e))
		}
		result.Blocks = append(result.Blocks, block)
	}
	return json.Marshal(result)
}
func decodeSnapshot(version int, data []byte) (domains.WorkoutPlan, error) {
	if version != 1 {
		return domains.WorkoutPlan{}, fmt.Errorf("unsupported snapshot version %d", version)
	}
	var stored snapshotV1
	if err := json.Unmarshal(data, &stored); err != nil {
		return domains.WorkoutPlan{}, fmt.Errorf("decode snapshot v1: %w", err)
	}
	result := domains.WorkoutPlan{
		Level:            stored.Level,
		RequestedMinutes: stored.RequestedMinutes,
		EstimatedMinutes: stored.EstimatedMinutes,
		WarmupMinutes:    stored.WarmupMinutes,
		Focus:            stored.Focus,
		Blocks:           make([]domains.SavedBlock, 0, len(stored.Blocks)),
	}
	for _, b := range stored.Blocks {
		block := domains.SavedBlock{
			Name:             b.Name,
			Sets:             b.Sets,
			EstimatedMinutes: b.EstimatedMinutes,
			Difficulty:       b.Difficulty,
			Exercises:        make([]domains.Exercise, 0, len(b.Exercises)),
		}
		for _, e := range b.Exercises {
			block.Exercises = append(block.Exercises, domains.Exercise(e))
		}
		result.Blocks = append(result.Blocks, block)
	}
	return result, nil
}

// Completion metadata reads saved JSON fields independently of snapshot
// version decoding, as the original database projection did.
func decodeCompletionMetadata(data []byte) (int, string, error) {
	var stored struct {
		Level *json.Number `json:"level"`
		Focus *string      `json:"focus"`
	}
	if err := json.Unmarshal(data, &stored); err != nil {
		return 0, "", fmt.Errorf("read completion plan: %w", err)
	}
	if stored.Level == nil || stored.Focus == nil {
		return 0, "", fmt.Errorf("read completion plan: missing level or focus")
	}
	level, err := strconv.ParseInt(strings.TrimSpace(stored.Level.String()), 10, 32)
	if err != nil {
		return 0, "", fmt.Errorf("read completion level: %w", err)
	}
	return int(level), *stored.Focus, nil
}

// Schema upgrades project only the fields used by queries. Numeric strings were
// accepted by the old projection; unrelated snapshot fields stay untouched.
func decodeWorkoutQueryFields(data []byte) (domains.WorkoutPlan, error) {
	var stored struct {
		Level            json.Number `json:"level"`
		EstimatedMinutes json.Number `json:"estimatedMinutes"`
		Focus            string      `json:"focus"`
		Blocks           []struct {
			Name      string `json:"name"`
			Exercises []struct {
				Name string `json:"name"`
			} `json:"exercises"`
		} `json:"blocks"`
	}
	if err := json.Unmarshal(data, &stored); err != nil {
		return domains.WorkoutPlan{}, fmt.Errorf("read workout query fields: %w", err)
	}
	level, err := strconv.ParseInt(strings.TrimSpace(stored.Level.String()), 10, 32)
	if err != nil {
		return domains.WorkoutPlan{}, fmt.Errorf("read workout level: %w", err)
	}
	minutes, err := strconv.ParseInt(strings.TrimSpace(stored.EstimatedMinutes.String()), 10, 32)
	if err != nil {
		return domains.WorkoutPlan{}, fmt.Errorf("read workout minutes: %w", err)
	}
	plan := domains.WorkoutPlan{Level: int(level), EstimatedMinutes: int(minutes), Focus: stored.Focus}
	for _, block := range stored.Blocks {
		saved := domains.SavedBlock{Name: block.Name}
		for _, exercise := range block.Exercises {
			saved.Exercises = append(saved.Exercises, domains.Exercise{Name: exercise.Name})
		}
		plan.Blocks = append(plan.Blocks, saved)
	}
	return plan, nil
}
