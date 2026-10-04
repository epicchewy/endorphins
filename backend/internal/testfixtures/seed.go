//go:build e2e

package testfixtures

import (
	"crypto/rand"
	"encoding/json"
	"net/http"

	"github.com/epicchewy/endorphins/backend/internal/domains"
)

func (f *Fixture) seed(w http.ResponseWriter, r *http.Request) {
	subject := r.URL.Query().Get("subject")
	if !validSubject.MatchString(subject) {
		http.Error(w, "invalid fixture subject", http.StatusBadRequest)
		return
	}
	user, err := f.users.Ensure(r.Context(), subject)
	if err != nil {
		http.Error(w, "fixture user unavailable", http.StatusInternalServerError)
		return
	}
	ids := make([]string, 0, 26)
	for i := range 26 {
		level, minutes, name := 2, 45, "Everyday movement"
		if i == 0 {
			level, minutes, name = 5, 30, "Archive-only movement"
		}
		blocks := make([]domains.SavedBlock, 0, 3)
		for _, area := range []string{"legs", "upper body", "core"} {
			blocks = append(blocks, domains.SavedBlock{
				Name: area, Sets: 1, EstimatedMinutes: minutes / 3, Difficulty: "easy",
				Exercises: []domains.Exercise{{Name: name, Description: "A seeded movement for library verification.", Difficulty: "easy", Reps: 10}},
			})
		}
		if i == 0 {
			blocks[0].Sets = 2
			blocks[0].Exercises[0].Reps = 0
			blocks[0].Exercises[0].Duration = 40
			blocks[0].Exercises[0].Rest = 20
			blocks[0].Exercises[0].Rounds = 3
		}
		saved, err := f.workouts.Create(r.Context(), user.ID, domains.SavedWorkout{
			ID: rand.Text(),
			WorkoutPlan: domains.WorkoutPlan{
				Level: level, RequestedMinutes: minutes, EstimatedMinutes: minutes, Focus: "legs", Blocks: blocks,
			},
		}, "", "")
		if err != nil {
			http.Error(w, "fixture plan unavailable", http.StatusInternalServerError)
			return
		}
		ids = append(ids, saved.ID)
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	if err := json.NewEncoder(w).Encode(map[string]any{"ids": ids}); err != nil {
		f.logger.Error("fixture seed response failed", "error", err)
	}
}
