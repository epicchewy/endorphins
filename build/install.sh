#!/bin/bash

set -ue

echo "Installing dependencies ... "

function command_exists() {
    type "$1" 2>/dev/null;
}

function install_dependencies () {
    if ! command_exists brew; then
        echo "lets install brew"
        echo | bash <(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)
    else
        echo "very nice you have brew"
    fi

    if ! command_exists python || ! command_exists pip3; then
        echo "lets install python"
        brew update && brew install python
        echo "alias python=/usr/local/bin/python3" >> $HOME/.bash_profile
        echo "alias pip=/usr/local/bin/pip3" >> $HOME/.bash_profile
        source $HOME/.bash_profile
    else
        echo "very nice. you have python"
    fi

    echo "installing python packages ... "
    sudo pip3 install -r requirements.txt
}

install_dependencies

echo "creating workout output directory"
mkdir -p workouts
chmod 777 workouts # hack
