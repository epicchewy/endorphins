package workout

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	mathrand "math/rand/v2"
	"slices"

	"github.com/epicchewy/endorphins/backend/internal/domains"
)

var ErrInvalidInput = errors.New("choose a duration from 30 to 120 minutes and a level from 1 to 5")

type GenerateInput struct{ DurationMinutes, Level int }

func (s *Service) Generate(ctx context.Context, input GenerateInput) (domains.Workout, error) {
	if input.DurationMinutes < 30 || input.DurationMinutes > 120 || input.Level < 1 || input.Level > 5 {
		return domains.Workout{}, ErrInvalidInput
	}
	catalogue, err := s.catalogue.ForLevel(ctx, input.Level)
	if err != nil {
		return domains.Workout{}, fmt.Errorf("load workout exercises: %w", err)
	}
	result := generate(catalogue, input, mathrand.IntN)
	result.ID = rand.Text()
	return result, nil
}

// generate keeps the original three blocks and 3/3/4 starting samples. Every
// addition must fit the remaining budget, so warm-up time can never disappear.
func generate(catalogue domains.Catalogue, input GenerateInput, intN func(int) int) domains.Workout {
	result := domains.Workout{Level: input.Level, RequestedMinutes: input.DurationMinutes}
	if input.DurationMinutes >= 45 {
		result.WarmupMinutes = 5
	}
	for i, name := range []string{"legs", "upper body", "core"} {
		pool := slices.Clone(catalogue[name])
		for j := len(pool) - 1; j > 0; j-- {
			k := intN(j + 1)
			pool[j], pool[k] = pool[k], pool[j]
		}
		count := 3
		if i == 2 {
			count = 4
		}
		result.Blocks = append(result.Blocks, domains.Block{Name: name, Sets: 1, Exercises: slices.Clone(pool[:count])})
	}
	// A difficult initial sample can exceed a short session. Remove its costliest
	// movement until it fits, retaining at least one exercise in every block.
	for result.Minutes() > input.DurationMinutes {
		blockIndex, exerciseIndex, cost := -1, -1, 0
		for i, b := range result.Blocks {
			if len(b.Exercises) <= 1 {
				continue
			}
			for j, e := range b.Exercises {
				if e.Minutes() > cost {
					blockIndex, exerciseIndex, cost = i, j, e.Minutes()
				}
			}
		}
		if blockIndex < 0 {
			break
		}
		b := &result.Blocks[blockIndex]
		b.Exercises = slices.Delete(b.Exercises, exerciseIndex, exerciseIndex+1)
	}
	type addition struct {
		block    int
		exercise *domains.Exercise
	}
	for {
		remaining := input.DurationMinutes - result.Minutes()
		if remaining <= 2 {
			break
		}
		var sets, exercises []addition
		for i, b := range result.Blocks {
			if b.Minutes()/b.Sets <= remaining {
				sets = append(sets, addition{block: i})
			}
			for _, e := range catalogue[b.Name] {
				present := slices.ContainsFunc(b.Exercises, func(existing domains.Exercise) bool { return existing.Name == e.Name })
				if !present && e.Minutes()*b.Sets <= remaining {
					exercises = append(exercises, addition{block: i, exercise: &e})
				}
			}
		}
		choices := exercises
		if len(sets) > 0 && (len(exercises) == 0 || intN(10) < 7) {
			choices = sets
		}
		if len(choices) == 0 {
			break
		}
		choice := choices[intN(len(choices))]
		b := &result.Blocks[choice.block]
		if choice.exercise == nil {
			b.Sets++
		} else {
			b.Exercises = append(b.Exercises, *choice.exercise)
		}
	}
	return result
}
