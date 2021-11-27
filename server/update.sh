
python3 update.py

ret=$?

if [ $ret -ne 0 ]; then
   exit $ret
fi

git add incidenceData.json
git commit -m "automatic update"
git push
