#!/usr/bin/env bash
set -euo pipefail

case "${1:-up}" in
  up)
    docker compose up --build
    ;;
  down)
    docker compose down
    ;;
  logs)
    docker compose logs -f app db
    ;;
  test)
    docker compose run --rm --entrypoint npm app run test:coverage
    ;;
  migrate)
    docker compose run --rm --entrypoint npm app run db:migrate
    ;;
  seed)
    docker compose run --rm --entrypoint npm app run db:seed
    ;;
  *)
    echo "Uso: $0 {up|down|logs|test|migrate|seed}" >&2
    exit 2
    ;;
esac
