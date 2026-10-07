//go:build integration

package workout

import (
	"fmt"
	"os"
	"strings"
	"sync"
	"testing"

	"github.com/epicchewy/endorphins/backend/internal/repositories/catalogue"
)

func TestOriginalCatalogueGeneration(t *testing.T) {
	repository, err := catalogue.New(os.DirFS("../../../../exercises"))
	if err != nil {
		t.Fatal(err)
	}
	service := New(repository)
	for level := 1; level <= 5; level++ {
		for _, duration := range []int{30, 31, 44, 45, 46, 60, 90, 119, 120} {
			t.Run(fmt.Sprintf("level%d_duration%d", level, duration), func(t *testing.T) {
				t.Parallel()
				var wg sync.WaitGroup
				for range 20 {
					wg.Go(func() {
						result, err := service.Generate(t.Context(), GenerateInput{duration, level})
						if err != nil {
							t.Error(err)
							return
						}
						if result.ID == "" || len(result.Blocks) != 3 {
							t.Error("incomplete workout")
						}
						if result.Minutes() > duration || result.Minutes() < duration-5 {
							t.Errorf("estimate %d exceeds budget tolerance %d", result.Minutes(), duration)
						}
						expected := result.WarmupMinutes
						for _, b := range result.Blocks {
							for _, exercise := range b.Exercises {
								if strings.Contains(strings.ToLower(exercise.Description), "weight") || exercise.Name == "Tricep dips" {
									t.Errorf("equipment exercise generated: %s", exercise.Name)
								}
								if level <= 2 && strings.Contains(strings.ReplaceAll(strings.ToLower(exercise.Name), " ", ""), "handstand") {
									t.Errorf("handstand generated at level %d", level)
								}
							}
							expected += b.Minutes()
						}
						if expected != result.Minutes() {
							t.Error("incorrect time accounting")
						}
					})
				}
				wg.Wait()
			})
		}
	}
}
