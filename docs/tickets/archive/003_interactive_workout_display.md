we want an interactive session with hotkeys enabled. 
it will operate similarly to the questionnaire interactive session.
first it displays the overal summary ex:

```bash
============================================================
WORKOUT PROGRAM GENERATED
============================================================
Program: Fat Loss Intermediate Program
Description: 5 days per week workout program focused on fat loss. Each session is 45-60 minutes.
Version: 2.0.0
Weeks: 3
Days per Week: 5
Difficulty: Intermediate
Equipment: commercial_gym
Estimated Duration: 45-60 minutes
============================================================
```

tap d (day) for day by day or w (week) for weeklong summary where it displays all the days at once. after tapping day display would look like ex:

```bash
DAY 1: Push (gym)
--------------------------------------------------
1. [MOBILITY] Dead Bugs
2. [CIRCUIT] CIRCUIT: Mountain Climbers + Plank Hold + Side Plank + Single-Leg Stands
  - Mountain Climbers: Week 1: 5 reps | Week 2: 6 reps | Week 3: 7 reps
  - Plank Hold: Week 1: 5 reps | Week 2: 6 reps | Week 3: 7 reps
  - Side Plank: Week 1: 5 reps | Week 2: 6 reps | Week 3: 7 reps
  - Single-Leg Stands: Week 1: 5 reps | Week 2: 6 reps | Week 3: 7 reps
3. [EMOM] EMOM: Push-ups + Tricep Dips
  - Push-ups: Week 1: 8 reps | Week 2: 9 reps | Week 3: 10 reps
  - Tricep Dips: Week 1: 8 reps | Week 2: 9 reps | Week 3: 10 reps
4. [FLEXIBILITY] Warrior Sequence
5. [MOBILITY] Leg Raises
```
at this point hotkeys are very important
fields that can be changed shouold be highlighted/indicated with syntax (some kind of bracket?) you should be able to jump to each position that is editable with "t" from <workout>.json ex:

```json
 "exercises": [
        {
          "name": "Dead Bugs",
          "week1": {
            "work_time_minutes": 1
          },
          "week2": {
            "work_time_minutes": 1
          },
          "week3": {
            "work_time_minutes": 1
          }
        },

```
so in this case we should be able to jump to the name "Dead Bugs" as well as the work time (not displayed in example but should be) ex:
```json
  "name": "CIRCUIT: Mountain Climbers + Plank Hold + Side Plank + Single-Leg Stands",
          "week1": {
            "sets": 5
          },
          "week2": {
            "sets": 5
          },
          "week3": {
            "sets": 5
          },
          "category": "circuit",
          "sub_exercises": [
            {
              "name": "Mountain Climbers",
              "week1": {
                "reps": 5
              },
              "week2": {
                "reps": 6
              },
              "week3": {
                "reps": 7
              }
            },
```
[CIRCUIT] should display sets for each week under its header and pressing 't' should jump to those editable fields. to edit press 'r' (similar to replace in vim) and type your change. pressing 'r' on an exercise field will map user string input to the closest string match to the exercise database. typing 'db' while an exercise field is selected (before/instead of pressing r) will open the exercise db and interactively a user can toggle the different categorical fields to select from a filtered list of exercises. selecting an exercise will then go back to the original view with the new exercise name in place. if a new category of exercise was selected then the underlying workout will update its appropriate fields to match. for example if push up (reps fields) is replaced by bench press (reps and weights) then a weights field will now be included inthe workout schedule and will show up inthe display



NOTE: all CLI hotkeys are configurable these are defined in cli_hotkeys.json in cli/
NOTE: what lives in cli/ vs lib/ vs other places? please define explictly and update file locations if need be