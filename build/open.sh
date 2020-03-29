#!/bin/bash

set -uex

ls -t1 workouts/ | head -n 1 | xargs find "$(pwd)" -name | xargs open
