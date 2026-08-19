SHELL := /bin/bash

CDT_FOUND = $(shell cdt-cpp --version 2>/dev/null | awk '{print $$NF}')

.PHONY: check/cdt

check/cdt:
	@test -n "$(CDT_VERSION)" || { echo "CDT_VERSION is not set in .env"; exit 1; }
	@test "$(CDT_FOUND)" = "$(CDT_VERSION)" || { \
		echo "This repository builds with CDT $(CDT_VERSION)."; \
		echo "Found: $(if $(CDT_FOUND),cdt-cpp $(CDT_FOUND),no cdt-cpp on PATH)"; \
		echo "Install it from https://github.com/AntelopeIO/cdt/releases/tag/v$(CDT_VERSION)"; \
		exit 1; \
	}
