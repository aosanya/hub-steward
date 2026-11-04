.PHONY: test build dev up down

test:
	cd code/wakala-api && go vet ./... && go test ./...
	cd code/console && npm ci && npm test
	cd code/app && npm ci && npm test

build:
	cd code/console && npm ci && npm run build
	cd code/app && npm ci && npm run build

dev:
	cd code/console && npm ci && npm run dev

up:
	docker compose up --build -d

down:
	docker compose down
