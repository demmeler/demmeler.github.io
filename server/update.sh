
set -e

python3 update.py

git add incidenceData.json
git commit -m "automatic update"
git push
