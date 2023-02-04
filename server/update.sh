
python3 update.py

ret=$?

if [ $ret -ne 0 ]; then
   echo "update.py failed"
   exit $ret
fi

set -x
set -e

git config --global --add safe.directory /repo
git add incidenceData.json
git commit -m "automatic update"
git push
