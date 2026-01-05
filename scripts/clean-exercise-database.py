#!/usr/bin/env python3
"""
Clean exercise database by removing generic compound exercise categories.

Circuits, EMOMs, AMRAPs, and Intervals should be constructed dynamically
from individual exercises, not stored as standalone exercises.
"""

import json
import sys

def clean_exercise_database(input_file, output_file):
    """Remove circuit, emom, amrap, and interval categories from exercise database."""

    with open(input_file, 'r') as f:
        data = json.load(f)

    # Categories to keep (individual exercises only)
    keep_categories = ['strength', 'mobility', 'flexibility', 'cardio']

    # Remove compound exercise categories
    categories_to_remove = ['interval', 'emom', 'amrap', 'circuit']

    original_categories = list(data['exercise_database']['categories'].keys())

    for category in categories_to_remove:
        if category in data['exercise_database']['categories']:
            exercises_count = len(data['exercise_database']['categories'][category]['exercises'])
            print(f"Removing {category} category ({exercises_count} generic exercises)")
            del data['exercise_database']['categories'][category]

    # Update total_exercises count
    total = 0
    for cat_name, cat_data in data['exercise_database']['categories'].items():
        total += len(cat_data['exercises'])

    data['exercise_database']['total_exercises'] = total

    # Write cleaned data
    with open(output_file, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"\nCleaned database:")
    print(f"  Original categories: {', '.join(original_categories)}")
    print(f"  Remaining categories: {', '.join(data['exercise_database']['categories'].keys())}")
    print(f"  Total exercises: {total}")

    return data

if __name__ == '__main__':
    input_path = 'src/data/exercise_database.json'
    output_path = 'src/data/exercise_database.json'

    clean_exercise_database(input_path, output_path)
    print("\n✓ Exercise database cleaned successfully!")
