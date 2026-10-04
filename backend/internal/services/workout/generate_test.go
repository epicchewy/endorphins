package workout

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"reflect"
	"testing"

	"github.com/epicchewy/endorphins/backend/internal/domains"
)

type catalogueStub struct {
	data domains.Catalogue
	err  error
}

func (r catalogueStub) ForLevel(ctx context.Context, _ int) (domains.Catalogue, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	return r.data, r.err
}
func sampleCatalogue() domains.Catalogue {
	catalogue := domains.Catalogue{}
	for _, name := range []string{"legs", "upper body", "core"} {
		for i := range 10 {
			catalogue[name] = append(catalogue[name], domains.Exercise{Name: fmt.Sprintf("%s-%d", name, i), Difficulty: []string{"easy", "medium", "hard"}[i%3], Reps: 10})
		}
	}
	return catalogue
}
func TestServiceGenerate(t *testing.T) {
	t.Parallel()
	for _, tt := range []struct {
		name  string
		input GenerateInput
	}{
		{"too short", GenerateInput{29, 1}}, {"too long", GenerateInput{121, 1}},
		{"level zero", GenerateInput{45, 0}}, {"unknown level", GenerateInput{45, 6}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			_, err := New(catalogueStub{data: sampleCatalogue()}).Generate(t.Context(), tt.input)
			if !errors.Is(err, ErrInvalidInput) {
				t.Fatalf("error = %v; want invalid input", err)
			}
		})
	}
	t.Run("cancelled request", func(t *testing.T) {
		ctx, cancel := context.WithCancel(t.Context())
		cancel()
		_, err := New(catalogueStub{data: sampleCatalogue()}).Generate(ctx, GenerateInput{45, 2})
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("error = %v; want cancellation", err)
		}
	})
	t.Run("repository failure", func(t *testing.T) {
		cause := errors.New("storage unavailable")
		_, err := New(catalogueStub{err: cause}).Generate(t.Context(), GenerateInput{45, 2})
		if !errors.Is(err, cause) {
			t.Fatalf("cause lost: %v", err)
		}
	})
}

func TestGenerateBudgetAndVariety(t *testing.T) {
	t.Parallel()
	catalogue := sampleCatalogue()
	original := sampleCatalogue()
	for level := 1; level <= 5; level++ {
		t.Run(fmt.Sprintf("level %d", level), func(t *testing.T) {
			for duration := 30; duration <= 120; duration++ {
				for seed := uint64(0); seed < 20; seed++ {
					rng := rand.New(rand.NewPCG(seed, seed+1))
					result := generate(catalogue, GenerateInput{duration, level}, rng.IntN)
					if result.Minutes() > duration || result.Minutes() < duration-5 {
						t.Fatalf("duration %d seed %d: estimate %d", duration, seed, result.Minutes())
					}
					wantWarmup := 0
					if duration >= 45 {
						wantWarmup = 5
					}
					if result.WarmupMinutes != wantWarmup {
						t.Fatalf("warm-up = %d; want %d", result.WarmupMinutes, wantWarmup)
					}
					if len(result.Blocks) != 3 {
						t.Fatal("missing body area")
					}
					for _, b := range result.Blocks {
						seen := make(map[string]bool)
						if b.Sets < 1 || len(b.Exercises) < 1 {
							t.Fatal("empty block")
						}
						for _, e := range b.Exercises {
							if seen[e.Name] {
								t.Fatal("duplicate exercise")
							}
							seen[e.Name] = true
						}
					}
				}
			}
		})
	}
	if !reflect.DeepEqual(catalogue, original) {
		t.Fatal("generation mutated the shared catalogue")
	}
}
