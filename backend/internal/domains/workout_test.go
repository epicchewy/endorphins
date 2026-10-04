package domains

import "testing"

func TestExerciseMinutes(t *testing.T) {
	t.Parallel()
	for _, tt := range []struct {
		name     string
		exercise Exercise
		want     int
	}{
		{"easy repetitions", Exercise{Difficulty: "easy", Reps: 10}, 1},
		{"medium repetitions", Exercise{Difficulty: "medium", Reps: 10}, 2},
		{"hard repetitions", Exercise{Difficulty: "hard", Reps: 10}, 5},
		{"intervals include rest and transition", Exercise{Duration: 40, Rest: 20, Rounds: 3}, 4},
		{"partial minutes round up", Exercise{Duration: 35, Rest: 10, Rounds: 3}, 4},
	} {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.exercise.Minutes(); got != tt.want {
				t.Fatalf("got %d; want %d", got, tt.want)
			}
		})
	}
}

func TestBlockDifficulty(t *testing.T) {
	b := Block{Sets: 2, Exercises: []Exercise{{Difficulty: "hard", Reps: 10}, {Difficulty: "easy", Reps: 10}, {Difficulty: "medium", Reps: 10}}}
	if b.Difficulty() != "hard" {
		t.Fatal("difficulty should reflect the hardest exercise")
	}
	if b.Minutes() != 16 {
		t.Fatal("sets must multiply the full block")
	}
}
