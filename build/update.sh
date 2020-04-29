#!/bin/bash

set -ue

echo "Pulling updates if any"
git checkout master && git pull
