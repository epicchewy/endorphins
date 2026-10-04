package postgres

import (
	"reflect"
	"testing"
)

func TestHistoricalV1Snapshot(t *testing.T) {
	t.Parallel()
	// A literal historical format guards against accidentally changing storage
	// through a transport/domain rename. It was not produced by today's encoder.
	data := []byte(`{"level":2,"requestedMinutes":45,"estimatedMinutes":39,"warmupMinutes":5,"focus":"legs","blocks":[{"name":"legs","sets":2,"estimatedMinutes":10,"difficulty":"easy","exercises":[{"name":"Squat","description":"Stand tall","difficulty":"easy","reps":12},{"name":"Sprint","difficulty":"hard","duration":30,"rest":10,"rounds":3}]}]}`)
	plan, err := decodeSnapshot(1, data)
	if err != nil {
		t.Fatal(err)
	}
	if plan.Level != 2 || plan.RequestedMinutes != 45 || plan.EstimatedMinutes != 39 || plan.Blocks[0].Exercises[1].Rounds != 3 {
		t.Fatalf("lost historical values: %+v", plan)
	}
	encoded, err := encodeSnapshot(plan)
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := decodeSnapshot(1, encoded)
	if err != nil || !reflect.DeepEqual(decoded, plan) {
		t.Fatalf("roundtrip lost values: %+v %v", decoded, err)
	}
	if _, err := decodeSnapshot(2, data); err == nil {
		t.Fatal("unknown version silently decoded")
	}
	if _, err := decodeSnapshot(1, []byte(`{`)); err == nil {
		t.Fatal("malformed snapshot silently decoded")
	}
}
