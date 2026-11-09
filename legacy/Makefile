DURATION ?= 45
LEVEL ?= 2

.PHONY: workout
workout:
	@bash build/update.sh
	$(eval ID = $(shell ls -1 ./workouts | wc -l ))
	@python3 main.py $(DURATION) $(LEVEL) $(ID)
	@echo "Opening today's workout pdf"
	@bash build/open.sh

.PHONY: install
install:
	@bash build/install.sh
