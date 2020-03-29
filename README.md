# Endorphins: A bootleg workout generator

Endorphins is a tool that randomly generates body-weight workouts based on a set list of exercises. The full list of exercises can be viewed in `exercises.json`. Users can customize the duration and intensity of the workouts, and all workouts aim to be within +/- five minutes of the provided duration.

## Installation

```
$ make install
```

## Usage

You can change the duration and intensity of the workouts. The default duration is 60 minutes with a supported range of 30 to 120 minutes and the default intensity is 3 with a supported range of 1 to 5. All workouts will be available under the ./workouts folder.

### Generate with defaults
```
$ make workout
```

A sample workout plan is availabe with the defaults is available under `./samples`.

### Generate with overrides
```
$ make workout DURATION=45 LEVEL=5
```

### Future Improvements

* More complex and extensive exercise list
* Different styles of workouts
* Ability to better tailor workouts
* Ability to override current set of exercises
