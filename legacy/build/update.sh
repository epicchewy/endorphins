#!/bin/bash

set -ue

array_contains () {
    local array="$1[@]"
    local seeking=$2
    local in=1
    for element in "${!array}"; do
        if [[ $element == "$seeking" ]]; then
            in=0
            break
        fi
    done
    return $in
}

echo "Checkout to master"
git checkout master

echo "Pulling updates if any"

# searches for remote upstream exists
# git pull if normal clone
remotes=($( git remote ))
array_contains remotes "upstream" &&  \
    git fetch upstream && git merge upstream/master || \
    git pull
