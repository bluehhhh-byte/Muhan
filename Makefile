.PHONY: check test build run logs doctor down clean fetch-upstream agent-install agent-shell

check:
	npm run check

test:
	npm test

build:
	docker compose build

run:
	docker compose up --build

logs:
	docker compose logs -f --tail=240

doctor:
	./scripts/doctor.sh

down:
	docker compose down --remove-orphans

clean:
	docker compose down --remove-orphans
	-docker image rm muhan-web-runner:local

fetch-upstream:
	./scripts/fetch-upstream.sh

agent-install:
	docker compose exec muhan-web sh -lc 'curl -fsSL https://antigravity.google/cli/install.sh | bash && agy --version'

agent-shell:
	docker compose exec muhan-web sh -lc 'export PATH="/root/.local/bin:$$PATH"; exec sh'
