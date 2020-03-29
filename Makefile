DURATION ?= 60
LEVEL ?= 3

.PHONY: workout
workout:
	$(eval ID = $(shell ls -l ./workouts | wc -l ))
	@echo "Creating workout #$(ID)"
	@python main.py $(DURATION) $(LEVEL) $(ID)
	@echo "Opening today's workout pdf"
	@bash build/open.sh

.PHONY: install
install:
	@bash build/install.sh
