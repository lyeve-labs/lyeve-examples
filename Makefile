# Everything here drives the local stack in .stack/ and the apps in apps/.
# `make help` lists the targets.

SHELL := /bin/bash
APPS := $(notdir $(wildcard apps/*))

.DEFAULT_GOAL := help

help: ## List the targets
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

up: ## Boot postgres and the engine, and create the first admin
	@bash platform/scripts/up.sh

fresh: ## Boot with an empty database
	@bash platform/scripts/up.sh --fresh

down: ## Stop the engine and the database
	@bash platform/scripts/down.sh

logs: ## Follow the engine log
	@tail -f .stack/logs/engine.log

print-env: ## Show the environment the engine runs with
	@bash platform/scripts/env.sh

install: ## Install workspace dependencies
	@pnpm install

smoke: ## Check the shared client against the running engine
	@set -a; . ./.env; set +a; node --experimental-strip-types platform/scripts/smoke.ts

# One app that fails to provision does not stop the others: each app is its
# own package, and a stop at the first failure left every app after it
# unprovisioned. The failures are listed at the end and fail the target.
setup: ## Provision and seed every example, one at a time
	@set -a; . ./.env; set +a; failed=""; for app in $(APPS); do \
	  if [ -f "apps/$$app/setup/provision.ts" ]; then \
	    printf '\033[36m==\033[0m %s\n' "$$app"; \
	    ( cd "apps/$$app" && node --experimental-strip-types setup/provision.ts ) || failed="$$failed $$app"; \
	  fi; \
	done; \
	if [ -n "$$failed" ]; then printf '\033[31mfailed:\033[0m%s\n' "$$failed"; exit 1; fi

build: ## Build every app
	@pnpm -r --if-present build

check: ## Type-check every app
	@pnpm -r --if-present check

verify: install check-vendor build check smoke ## Everything a change has to pass

dev-%: ## Run one app, for example `make dev-blog`
	@cd apps/$* && pnpm dev

preview: ## Serve every built app on ports from 4700 up
	@bash platform/scripts/preview-all.sh

preview-stop: ## Stop the preview servers
	@bash platform/scripts/preview-all.sh --stop

check-pages: ## Fetch every served app's home and first inner page
	@bash platform/scripts/check-pages.sh

vendor: ## Copy the shared client into every app
	@bash platform/scripts/vendor-client.sh

check-vendor: ## Fail if any app's copy of the client has drifted
	@bash platform/scripts/vendor-client.sh --check

bench-list: ## What can be measured, and what each one means
	@bash perf/bench.sh list

bench: ## Measure one thing: make bench APP=blog | ENGINE=blog | PROFILE=courses
	@if [ -n "$(APP)" ]; then bash perf/bench.sh app "$(APP)"; \
	elif [ -n "$(ENGINE)" ]; then bash perf/bench.sh engine "$(ENGINE)"; \
	elif [ -n "$(PROFILE)" ]; then bash perf/bench.sh profile "$(PROFILE)"; \
	else echo "pick one: make bench APP=<name> | ENGINE=<name> | PROFILE=<id>"; \
	     echo "see them all with: make bench-list"; exit 2; fi

bench-all: ## Measure every app at both layers
	@bash perf/run.sh all

bench-apps-json: ## Regenerate perf/apps.json from the apps and the engine
	@node perf/discover-apps.mjs

export-profiles: ## Write the benchmark repo's profiles from the running engine
	@node perf/export-profiles.mjs

.PHONY: help up fresh down logs print-env install smoke setup build check verify preview preview-stop check-pages bench-apps-json bench-all bench bench-list export-profiles vendor check-vendor
