# GUI

- 3 main views - profile/schedule/live
  - profile view 
    - are your detials age/weight/height. answers to the questionnare (worded as preferences e.g. prefers 3 week workouts)
    - used to auto-generate additional workout templates
    - place to record 1 rep maxes (used as training max) 
    - as user uses app manual entries for 1rm are replaced by PRs from workout history. any exercise from the exercise db is a candidate
    - achievements are presented here. total workouts this week. PRs. standard exersion levels (do research here)
    - can see all past workout history here table and graph views (to develop at a later time)
  - schedule view
    - can cycle through past schedules. shows current schedule. can edit schedules. can re-fill questionnare to generate new schedule
    - questionnaire and edit capabilities should be drafted from CLI version (tools, capabilities, structure, etc.) but mobile version will make use of long press/drag and desktop click/drag
      - need to develop game plan for mobile tooling to make edit easy
      - click answer for questionnaire responses
    - "current" schedule shows current day using system date. start date can be retroactively applied
4. [INTERVAL] INTERVAL: Wall Sits + Donkey Kicks
   Sets: Week 1: 8 sets | Week 2: 8 sets | Week 3: 8 sets
  - Wall Sits:
     Work Time: Week 1: 0.3333333333333333 seconds | Week 2: 0.4166666666666667 seconds | Week 3: 0.5 seconds
     Rest Time: Week 1: 0.16666666666666666 seconds | Week 2: 0.08333333333333333 seconds | Week 3: 0.08333333333333333 seconds
  - Donkey Kicks:
     Work Time: Week 1: 0.3333333333333333 seconds | Week 2: 0.4166666666666667 seconds | Week 3: 0.5 seconds
     Rest Time: Week 1: 0.16666666666666666 seconds | Week 2: 0.08333333333333333 seconds | Week 3: 0.08333333333333333 seconds
    - other difference from CLI version is days can be reordered. and days are assigned to days of the week e.g. M/W/F. we will need a GUI specific config for autoassigning standard days of week to numerical ids in the schedule
    - schedule shows completed workouts for the loaded schedule but not past schedules
  - live view
    - live view is like watching a peloton class. it guides you through your workout
    - standard on the live view is a timer. takes up top half of screen on mobile
    - underneath is the current exercise details. 
      - compound exercises
        - displays work/rest time auto progresses to next set in the compound
        - user fills in completed reps/RPE/time (whichever is applicable, dont let claude assume what this is)
      - strength exercises
        - displays set/rep and buttons to track rest time (timer)
        - user fills in completed weight/reps/RPE
    - results are immediately tracked in workout history

# Database Improvements

# Dev Exp Improvements

# CLI Improvements

- 'i' pulls up information but we also have a/c/e that pull up amrap/circuit/emom blocks respectively when a compound block is highlighted. add 'n' to cover 'interval'
- 'i' needs to pull up information for compound blocks when they are selected - search in workout generation rules where we define these exercise types with descriptions and display them the same way we display information for exercises when 'i' is tapped
- when only compound blocks are present it is impossible to add a regular exercise because of the action 'r'/'s'/'e' have on the add exercise field (it attributes it to the parent block). I need you to review the hotkeys and make a clean edit suggetsion for how to set this up. im thinking we might have a new hotkey 'd' for 'detatch' that will pop any highlighted exercise from a compound block and pop it out into a separate exercise directly beneath the block
- add push/pull/legs as category filters in the exercise databse modal along side the type categories like strength/cardio
 
# Under Review


round robin technique is convluted and buggy. workout lengths will instead follow a prescriptive format
we might have a simpler taxonomy build muscle/tone/lose weight. time- 20/30/60. experience (filter on exercise attb). 
eqp access. training split - depends on answer to strength/no-strength and # of days. in the following splits
are standard 2 strength exercises followed by 2-4 blocks depending on time. alternates show -hiit and signify these
are entirely compound based but have the same split orientation. -volume indicates a 2 strength 2-4 compound setup but 
now the strength portion is all higher rep schemes. compound blocks can be any of: volume/amrap/emom/circuit
- strength <tone/fat-loss> {lose-weight}
  - 2 days - upper/lower  (OR) upper/lower hiit {lose-weight}
  - 3 days - PPL  (OR) PPL hiit {lose-weight}
  - 4 days - PPL/FB-mobility
  - 5 days - PPL/upper-hiit/lower-hiit <fat-loss> (OR) PPL/upper-volume/lower-volume (OR) PPL-hiit/upper-volume/lower-volume {lose-weight}
  - 6 days - PPL/FB-mobility/upper-hiit/lower-hiit <fat-loss> (OR) PPL/FB-mobility/upper-voume/lower-volume (strength)  (OR) PPL-hiit/FB-mobility/upper-volume/lower-volume {lose-weight{
  - 7 days - PPL(strength)-PPL(volume)-flexibility (OR) PPL-hiit/PPL-volume-flexibility {lose-weight} 
all workouts utilize barbell for strength volume-strength along with dumbbells at 80/20 ratio if it is available
all workouts utilize dumbbells if they are available 
if only basic equipment available above schedule formula holds but 2 strength exercise portions are converted into a single interval block with 3 exercises.
program duration options are only 3,4,6 weeks
- for progressions: linnear/volume. above schedule holds. 
  - strength 
    - volume: increase sets and reps same weight. 
    - linear: decrease reps increase weight.
  - blocks
    - amrap
      - volume: increase time
      - linear: increase reps
    - emom
      - volume: increase time
      - linear: increase reps
    - interval
      - volume: increase time
      - linear: increase work/rest ratio
    - circuit
      - volume/linear increase sets
