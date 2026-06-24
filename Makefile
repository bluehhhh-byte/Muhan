.PHONY: check test run build logs down clean doctor

check:
	npm run check

test:
	npm test

build:
	docker compose build

run:
	docker compose up --build

logs:
	docker compose logs -f

doctor:
	docker compose ps
	docker compose logs --tail=200

down:
	docker compose down

clean:
	docker compose down --remove-orphans
	docker image rm muhan-web-runner:local 2>/dev/null || true
