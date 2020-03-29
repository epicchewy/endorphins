DURATION ?= 60
LEVEL ?= 3

.PHONY: workout
workout:
	$(eval ID = $(shell ls -l workouts | wc -l ))
	@echo "Creating workout #$(ID)"
	@python main.py $(DURATION) $(LEVEL) $(ID)

.PHONY: install
install:
	@bash build/install.sh
