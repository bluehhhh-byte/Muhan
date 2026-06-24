.PHONY: check test run build logs down clean doctor fetch-upstream

check:
	npm run check

test:
	npm test

fetch-upstream:
	./scripts/fetch-upstream.sh

build:
	docker compose build

run:
	docker compose up --build

logs:
	docker compose logs -f

doctor:
	./scripts/doctor.sh

down:
	docker compose down

clean:
	docker compose down --remove-orphans
	docker image rm muhan-web-runner:local 2>/dev/null || true
