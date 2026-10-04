// Package domains contains workout values and pure business rules.
package domains

import "fmt"

type Exercise struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Difficulty  string `json:"difficulty"`
	Reps        int    `json:"reps,omitempty"`
	Duration    int    `json:"duration,omitempty"`
	Rest        int    `json:"rest,omitempty"`
	Rounds      int    `json:"rounds,omitempty"`
}

// Minutes retains the catalogue's original estimate, including transitions.
// Repetition-based times are estimates, not prescribed movement speeds.
func (e Exercise) Minutes() int {
	if e.Duration > 0 {
		return (e.Rounds*(e.Duration+e.Rest)+59)/60 + 1
	}
	switch e.Difficulty {
	case "easy":
		return 1
	case "medium":
		return 2
	default:
		return 5
	}
}

func (e Exercise) Validate() error {
	if e.Name == "" {
		return fmt.Errorf("exercise name is required")
	}
	if e.Difficulty != "easy" && e.Difficulty != "medium" && e.Difficulty != "hard" {
		return fmt.Errorf("invalid difficulty for %q", e.Name)
	}
	if e.Duration > 0 {
		if e.Rounds < 1 || e.Rest < 0 || e.Reps != 0 {
			return fmt.Errorf("invalid interval prescription for %q", e.Name)
		}
	} else if e.Reps < 1 || e.Rounds != 0 || e.Rest != 0 || e.Duration < 0 {
		return fmt.Errorf("invalid repetition prescription for %q", e.Name)
	}
	return nil
}

type Catalogue map[string][]Exercise

type Block struct {
	Name      string
	Sets      int
	Exercises []Exercise
}

func (b Block) Minutes() int {
	minutes := 0
	for _, e := range b.Exercises {
		minutes += e.Minutes()
	}
	return minutes * b.Sets
}

func (b Block) Difficulty() string {
	result := "easy"
	for _, e := range b.Exercises {
		if e.Difficulty == "hard" {
			return "hard"
		}
		if e.Difficulty == "medium" {
			result = "medium"
		}
	}
	return result
}

type Workout struct {
	ID               string
	Level            int
	RequestedMinutes int
	WarmupMinutes    int
	Blocks           []Block
}

func (w Workout) Minutes() int {
	minutes := w.WarmupMinutes
	for _, b := range w.Blocks {
		minutes += b.Minutes()
	}
	return minutes
}

func (w Workout) Focus() string {
	focus := w.Blocks[0]
	for _, b := range w.Blocks[1:] {
		if b.Minutes() > focus.Minutes() {
			focus = b
		}
	}
	return focus.Name
}
