# Endorphins: A bootleg workout generator

Endorphins is a tool that randomly generates body-weight workouts based on a set list of exercises. The full list of exercises can be viewed in `exercises.json`. Users can customize the duration and intensity of the workouts, and all workouts aim to be within +/- five minutes of the provided duration.

## Installation

Warning: Installation might take a while if you dont already have `brew` installed on your machine.
```
$ make install
```

You may need to run `pip install fpdf` if it says the package is unavailable.

## Usage

You can change the duration and intensity of the workouts. The default duration is 45 minutes with a supported range of 30 to 120 minutes and the default intensity is 2 with a supported range of 1 to 5. All workouts will be available under the `./workouts` folder.

### Generate with defaults
```
$ make workout
```

Sample, 45 min, workout plans of each level are availabe is available under `./samples`.

### Generate with overrides
```
$ make workout DURATION=45 LEVEL=5
```

### Getting updates
```
$ git pull
```

## How To Workout

To fully maximize on the workout and improve the fastest, I recommend exercising with the following tips in mind.

1. Aim to do each rep with perfect technique. Fewer, higher quality reps do you body more good than more, sloppy reps. If you don't recognize an exercise, feel free to look up proper form before proceeding.
2. Don't be afraid of failing. Some workouts can look daunting or be too hard, and tackling them head on is the only way to get stronger.
3. Workout with your friends! Cranking out reps with some buddies and hype music can do wonders.

### Future Improvements

* Different styles of workouts
* Ability to better tailor workouts
* Ability to override current set of exercises
