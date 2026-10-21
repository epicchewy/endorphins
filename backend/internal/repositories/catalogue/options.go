package catalogue

type Options struct {
	Directory string `long:"exercise-dir" env:"EXERCISE_DIR" default:"../exercises" description:"Directory containing the exercise catalogues"`
}
