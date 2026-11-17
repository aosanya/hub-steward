.PHONY: test test-api-race build dev up down deploy-local deploy-local-api deploy-local-down deploy-local-backup

N ?= 6
FILTER ?= .

test:
	sh scripts/split-test-names.test.sh
	sh scripts/commit-own-paths.test.sh
	cd code/wakala-api && go vet ./... && go test ./...
	cd code/console && npm ci && npm test
	cd code/app && npm ci && npm test

test-api-race:
	cd code/wakala-api && sh ../../scripts/test-api-race.sh $(N) '$(FILTER)'

build:
	cd code/console && npm ci && npm run build
	cd code/app && npm ci && npm run build

dev:
	cd code/console && npm ci && npm run dev

up:
	docker compose up --build -d

down:
	docker compose down

deploy-local:
	$(MAKE) -C deployment/local up

deploy-local-api:
	$(MAKE) -C deployment/local api

deploy-local-down:
	$(MAKE) -C deployment/local down

deploy-local-backup:
	$(MAKE) -C deployment/local backup
