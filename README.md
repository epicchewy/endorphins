# Endorphins: A bootleg workout generator

Endorphins is a tool that randomly generates body-weight workouts based on a set list of exercises. Users can customize the duration and intensity of the workouts, and all workouts aim to be within +/- five minutes of the provided duration.

## Installation

In Terminal, run the following commands:
```
$ git clone https://github.com/epicchewy/endorphins.git
$ make install
```

**Warning**: Installation will take a while if you dont already have `brew` installed on your machine.

You may need to run `pip install fpdf` if the output says that the package is unavailable.

## Usage

You can change the duration and intensity of the workouts. The default duration is 45 minutes with a supported range of 30 to 120 minutes and the default intensity is 2 with a supported range of 1 to 5. All workouts will be available under the `./workouts` folder, and lists of exercises can be viewed in the `./exercises` folder.

### Generate with defaults
```
$ make workout
```

Sample, 45 min, workout plans of each level are available under `./samples`.

### Generate with overrides
```
$ make workout DURATION=45 LEVEL=5
```

## How To Workout

The workout is broken down into three sections -- legs, upper body, and core. Try to complete each section within the alloted time and the entire workout within the estimated time. To fully maximize on the workout and improve the fastest, I recommend exercising with the following tips in mind.

1. Try your best to do **3/4 workouts** a week. Consistency is key.
2. Aim to do each rep with **perfect technique**. Fewer, higher quality reps do you body more good than more, sloppy reps. If you don't recognize an exercise, feel free to look up proper form before proceeding.
3. **Don't be afraid of failing**. Some workouts can look daunting or be too hard, and tackling them head on is the only way to get stronger.
4. Workout with your friends! Cranking out reps with some buddies and hype music can do wonders.

## Choosing the right level

Endorphins supports five difficulty levels that attempt to challenge people of all athletic backgrounds. If you have no idea which level to start at, follow the guide below:

* **Level 1:** Great for beginners. This level is perfect for people who want to start building their cardiovascular base and foundational upper body strength.
* **Level 2:** The Default level. Workouts at this level should be challenging for the average person with average physical capabilities.
* **Level 3:** A slightly more intense version of level 2 that introduces different mobility and anaerobic exercises.
* **Level 4:** A good starting point for people with sports/crossfit backgrounds. This level builds off of the previous one with harder, dynamic exercises.
* **Level 5:** This level can get really hard, really fast. Lots of reps across a wide spread of muscle groups.

### Updating the project

This project will update every time a new workout is generated!

### Future Improvements

* Different styles of workouts
* Ability to better tailor workouts
* Ability to override current set of exercises
