
# Database Improvements

- add weighted pull-ups to exercise db. remove optional weight designation from regular pull-ups.
change dead bugs from mobility to body weight core


# Dev Exp Improvements

organize repo. organize tests.


# CLI Improvements

- deleting an exercise in a block deletes the whole block. make it only delete the exercise. delete the whole block by deleting the top e.g. where it says [INTERVAL] [INTERVAL: ...]

- tapping 'a' doesn't work. it says to tap a on another exercise to swap but navigating with t/T or numbers and then pressing a again doesn't seem to do anything

- double tapping enter after adding reps doesnt work when trying to broadcast an entry
  - Lateral Walks with Resistance Band:
     Reps: Week 1: <16 reps> | Week 2: 8 reps | Week 3: 8 reps
     Weight: Week 1: 70% TM | Week 2: 70% TM | Week 3: 70% TM

- pressing a number to go to exercise now requries pressing enter too, instead of autmoatically jumping after the 500 ms

-------------------------------------------------------------
Cannot broadcast work_time_minutes - not a week-specific field
[VIEW] [DAY 1/5] [+] [Undo: 3] | Press ? for help

BUT THIS IS WEEK SPECIFIC. it is the minutes of work per week:

1. [MOBILITY] Band Pull-Aparts
    Week 1: <3 minutes work>
    Week 2: 1 minutes work
    Week 3: 1 minutes work





# Under Review

- cannot edit work time or define rest time for renegade rows here under interval blocks
5. [INTERVAL] [INTERVAL] INTERVAL: Renegade Rows
   Work Time: Week 1: 6 minutes | Week 2: 6 minutes | Week 3: 6 minutes
  - Renegade Rows:
     Weight: Week 1: 70% TM | Week 2: 70% TM | Week 3: <70% TM>
     Work Time: Week 1: 8 seconds | Week 2: 8 seconds | Week 3: 8 seconds

emom/amrap/circuit rest time is not necessary (emom built in, amrap as little as poss, circuit is like amrap with sets defining end state not time) but interval needs displayed/defined rest times


- introduce swap keys. tap 'a' twice? show highlights around blocks to indicate you are in swap mode. ask user if sure before executing the swap

- tap i to pull up information from exercise description database about a selected exercise in the schedule or exercise database. should work in both edit view and exercise db view.

- allow typing double digits to jump to exercise greater than 9 in edit mode

- stop putting flexibility/mobility exercises in the middle - update to data rules

- tap enter twice to broadcast last entry to the same fields for that particular exercise to all weeks

- change r to auto delete whatever is being replaced, more similar to vim

