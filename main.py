#!/usr/bin/env python

import datetime
import json
import logging
import os
import random
import sys

from fpdf import FPDF

handle = 'endorphins'

FORMAT = '%(levelname)s: %(message)s'
logging.basicConfig(format=FORMAT)
logger = logging.getLogger(handle)
logger.setLevel(logging.DEBUG)

focus_area_mapping = {
    0: 'legs',
    1: 'upper body',
    2: 'core',
}

# temp constants
CORE_SAMPLES = 4
LEG_SAMPLES = 3
UPPER_BODY_SAMPLES = 2

# exercise difficulty enums
EASY = 'easy'
MEDIUM = 'medium'
HARD = 'hard'

def validate_input(duration, level):
    logger.info('Validating input ...')

    if duration < 30:
        logger.error('Workout cannot be shorter than 30 minutes')
        sys.exit(1)
    if duration > 120:
        logger.error('Workout cannot be longer than 120 minutes')
        sys.exit(1)
    if level < 0 or level > 10:
        logger.error('Please specify an intensity level between 1-5')
        sys.exit(1)

def generate_workout(duration, level):
    logger.info('Choosing exercises ...')
    curr_dir = os.path.dirname(__file__)
    rel_path = 'exercises.json'
    abs_file_path = os.path.join(curr_dir, rel_path)

    with open(abs_file_path) as ef:
       exercises = json.load(ef)

    # no need to warm up for workouts <= 45 min
    im, ib, fi = get_initial_exercises(exercises)

    blocks = ib
    minutes = im
    focus = focus_area_mapping[fi]

    # account for warmup time
    if duration >= 45:
        minutes += 5

    while minutes < duration - 2:
        # flip a coin between adding sets or adding exercises
        if random.random() < .5:
            rand_idx = random.randint(0, 2)
            blocks[rand_idx]['sets'] += 1
        else:
            focus_exercises = exercises[focus]
            blocks[fi]['exercises'] += random.sample(focus_exercises, 1)

        minutes = 0

        for b in blocks:
            minutes += (b['sets'] * compute_exercise_minutes(b['exercises']))

        if minutes > duration:
            break

    return blocks, minutes, focus

def compute_exercise_minutes(exercises):
    total_minutes = 0
    for e in exercises:
        if 'duration' in e.keys():
            seconds = e['rounds'] * (e['duration'] + e['rest'])
            minutes = seconds / 60
            total_minutes += minutes + 1 # account for rest after each set
        else:
            difficulty = e['difficulty']
            if difficulty == EASY:
                total_minutes += 1
            elif difficulty == MEDIUM:
                total_minutes += 2
            elif difficulty == HARD:
                total_minutes += 5
    return total_minutes

# returns total minutes of inital set of exercises, exercises [{}...], and index of focus area
def get_initial_exercises(exercises):
    blocks = []

    leg_samples = random.sample(exercises['legs'], LEG_SAMPLES)
    upper_body_samples = random.sample(exercises['upper body'], UPPER_BODY_SAMPLES)
    core_samples = random.sample(exercises['core'], CORE_SAMPLES)

    blocks.append({'title': 'Legs', 'sets': 1, 'exercises': leg_samples})
    blocks.append({'title': 'Upper Body', 'sets': 1, 'exercises': upper_body_samples})
    blocks.append({'title': 'Core', 'sets': 1, 'exercises': core_samples})

    minutes_tuple = (compute_exercise_minutes(leg_samples), compute_exercise_minutes(upper_body_samples), compute_exercise_minutes(core_samples))
    total_minutes = sum(minutes_tuple)
    focus_idx = minutes_tuple.index(max(minutes_tuple)) # return key to use in generate_workout()

    return total_minutes, blocks, focus_idx

def write_pdf(id, blocks, estimated_duration, focus):
    today = datetime.date.today()
    file_name = './workouts/{}.pdf'.format(today.strftime('workout-%m-%d-%Y'))
    title = today.strftime('Workout #{}, Date: %m-%d-%Y'.format(id))

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font('Arial', 'B', 18)
    pdf.cell(60, 8, title, ln=1)
    pdf.ln()

    pdf.set_font('Arial', '', 12)
    subtitle = 'Focus Area: {}, Estimated Time: {} minutes'.format(focus, estimated_duration)
    pdf.cell(60, 8, subtitle)
    pdf.ln()
    pdf.ln()

    if estimated_duration >= 45:
        pdf.set_font('Arial', 'B', 15)
        pdf.cell(40, 8, 'Warm Up!')
        pdf.ln()
        pdf.set_font('Arial', '', 12)
        pdf.cell(40, 8, 'Take 5-10 minutes to stretch out and get the blood flowing!', ln=1)
        pdf.ln()

    for b in blocks:
        pdf.set_font('Arial', 'B', 15)
        pdf.cell(40, 8, b['title'])
        pdf.ln()
        pdf.set_font('Arial', 'B', 12)
        if b['sets'] == 1:
            set_msg = '1 set of the following:'
            pdf.cell(40, 8, set_msg)
        else:
            set_msg = '{} sets of the following:'.format(b['sets'])
            pdf.cell(40, 8, set_msg)
        pdf.ln()
        for e in b['exercises']:
            pdf.set_font('Arial', '', 12)
            details = ''
            if 'duration' in e.keys():
                details = '{} {} rounds of {} on, {} off'.format(e['name'], e['rounds'], e['duration'], e['rest'])
            else:
                details = '{} x{} reps'.format(e['name'], e['reps'])

            if 'description' in e:
                details += '. '
                details += e['description']
            pdf.cell(40, 8, details)
            pdf.ln()
        pdf.ln()

    pdf.output(file_name, 'F')

    logger.info('Successfully wrote new workout plan: "{}"'.format(file_name))

def main():
    duration, level, id = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3])

    validate_input(duration, level)
    blocks, estimated_duration, focus = generate_workout(duration, level)
    write_pdf(id, blocks, estimated_duration, focus)

if __name__ == '__main__':
    main()
