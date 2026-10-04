package catalogue

const defaultDirectory = "../exercises"

type Options struct {
	Directory string `long:"exercise-dir" env:"EXERCISE_DIR" default:"../exercises" description:"Directory containing the exercise catalogues"`
}

// Resolve keeps the existing empty-environment behavior while defaults remain
// declared in the option tags and visible in generated help.
func (o *Options) Resolve() {
	if o.Directory == "" {
		o.Directory = defaultDirectory
	}
}
