import { generateWorkout } from './src/lib/engine/workout-generator.js';

const answers = {
  primary_goal: 'fat_loss',
  experience_level: 'expert',
  training_frequency: '7',
  session_duration: '45-60',
  equipment_access: 'commercial_gym',
  training_split_preference: 'ulppl',
  cardio_preference: 'integrated',
  program_duration: '3_weeks',
  progression_preference: 'volume'
};

try {
  console.error('Generating workout...');
  const workout = generateWorkout(answers);
  console.error('Success!');
  console.error(`Generated workout with ${Object.keys(workout.days).length} days`);
} catch (error) {
  console.error('Error:', error);
}