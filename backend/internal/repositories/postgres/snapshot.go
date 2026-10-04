package postgres

import (
	"encoding/json"
	"fmt"

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
			block.Exercises = append(block.Exercises, exerciseV1{
				Name:        e.Name,
				Description: e.Description,
				Difficulty:  e.Difficulty,
				Reps:        e.Reps,
				Duration:    e.Duration,
				Rest:        e.Rest,
				Rounds:      e.Rounds,
			})
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
			block.Exercises = append(block.Exercises, domains.Exercise{
				Name:        e.Name,
				Description: e.Description,
				Difficulty:  e.Difficulty,
				Reps:        e.Reps,
				Duration:    e.Duration,
				Rest:        e.Rest,
				Rounds:      e.Rounds,
			})
		}
		result.Blocks = append(result.Blocks, block)
	}
	return result, nil
}
