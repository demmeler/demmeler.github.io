

cd $(git rev-parse --show-toplevel)

docker run -t -v $(pwd):/repo -w /repo nodedev bash /repo/server/update.sh

