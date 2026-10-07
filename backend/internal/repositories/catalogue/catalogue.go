// Package repositories implements storage access behind service-owned ports.
package catalogue

import (
	"context"
	"encoding/json"
	"fmt"
	"io/fs"
	"slices"

	"github.com/epicchewy/endorphins/backend/internal/domains"
)

// Catalogue is loaded and validated once, then read concurrently without mutation.
type Catalogue struct{ levels map[int]domains.Catalogue }

func New(files fs.FS) (*Catalogue, error) {
	levels := make(map[int]domains.Catalogue, 5)
	for level := 1; level <= 5; level++ {
		name := fmt.Sprintf("level-%d.json", level)
		data, err := fs.ReadFile(files, name)
		if err != nil {
			return nil, fmt.Errorf("read catalogue %s: %w", name, err)
		}
		var catalogue domains.Catalogue
		if err := json.Unmarshal(data, &catalogue); err != nil {
			return nil, fmt.Errorf("decode catalogue %s: %w", name, err)
		}
		for _, group := range []string{"legs", "upper body", "core"} {
			if len(catalogue[group]) < 4 {
				return nil, fmt.Errorf("catalogue %s: too few %s exercises", name, group)
			}
			names := make(map[string]bool)
			for _, e := range catalogue[group] {
				if err := e.Validate(); err != nil {
					return nil, fmt.Errorf("catalogue %s: %w", name, err)
				}
				if names[e.Name] {
					return nil, fmt.Errorf("catalogue %s: duplicate exercise %q", name, e.Name)
				}
				names[e.Name] = true
			}
		}
		for group, exercises := range catalogue {
			catalogue[group] = slices.DeleteFunc(exercises, func(e domains.Exercise) bool { return !homeExercise(level, e) })
			if len(catalogue[group]) < 4 {
				return nil, fmt.Errorf("catalogue %s: too few equipment-free %s exercises", name, group)
			}
		}
		levels[level] = catalogue
	}
	return &Catalogue{levels: levels}, nil
}

func (r *Catalogue) ForLevel(ctx context.Context, level int) (domains.Catalogue, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	catalogue, ok := r.levels[level]
	if !ok {
		return nil, fmt.Errorf("catalogue level %d is unavailable", level)
	}
	result := make(domains.Catalogue, len(catalogue))
	for key, exercises := range catalogue {
		result[key] = slices.Clone(exercises)
	}
	return result, nil
}

// The application uses floor/wall movements. Keep the original Python catalogue intact.
func homeExercise(level int, e domains.Exercise) bool {
	switch e.Name {
	case "Slow arm circles", "Elevated arm holds", "Tricep extensions", "Reverse arm circles", "Tricep dips":
		return false
	case "Handstand shoulder taps", "Hand stand holds", "Hand stand pushups":
		return level > 2
	default:
		return true
	}
}
