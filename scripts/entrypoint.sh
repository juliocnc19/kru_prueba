#!/bin/sh
set -eu
npm run db:migrate
npm run db:seed
exec npm run dev
