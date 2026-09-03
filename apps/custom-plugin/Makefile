.DEFAULT_GOAL := verify

build: ## Compile the plugin
	@GOWORK=off go build ./...

test: ## Run the tests
	@GOWORK=off go test ./...

vet: ## Static checks
	@GOWORK=off go vet ./...

verify: build vet test ## Everything a change has to pass

.PHONY: build test vet verify
