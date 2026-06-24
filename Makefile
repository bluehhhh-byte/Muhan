.PHONY: check test build build-no-cache run run-force logs doctor down clean reset fresh fetch-upstream agent-install agent-shell version-check publish-patch

check:
	npm run check

test:
	npm test

build:
	docker compose build

build-no-cache:
	docker compose build --no-cache

run:
	docker compose up --build

run-force:
	docker compose up --force-recreate --renew-anon-volumes

fresh: reset build-no-cache run-force

logs:
	docker compose logs -f --tail=240

doctor:
	./scripts/doctor.sh

version-check:
	./scripts/check-version.sh

down:
	docker compose down --remove-orphans

reset:
	./scripts/reset-local.sh

clean:
	docker compose down --remove-orphans --volumes
	-docker image rm muhan-web-runner:local muhan-web-runner-v07:local muhan-web-runner-v06:local

fetch-upstream:
	./scripts/fetch-upstream.sh

agent-install:
	docker compose exec muhan-web sh -lc 'curl -fsSL https://antigravity.google/cli/install.sh | bash && agy --version'

agent-shell:
	docker compose exec muhan-web sh -lc 'export PATH="/root/.local/bin:$$PATH"; exec sh'
