.PHONY: check run build logs down clean

check:
	npm run check

build:
	docker compose build

run:
	docker compose up --build

logs:
	docker compose logs -f

down:
	docker compose down

clean:
	docker compose down --remove-orphans
	docker image rm muhan-web-runner:local 2>/dev/null || true
