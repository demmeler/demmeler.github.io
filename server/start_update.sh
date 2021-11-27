
cd $(git rev-parse --show-toplevel)

docker run -t --rm -v $(pwd):/repo -w /repo/server pythondev bash update.sh
