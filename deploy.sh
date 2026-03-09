#!/bin/bash
PROJECT_DIR="/var/www/igen-app/igenproterties-hosted"
VENV_PATH="$PROJECT_DIR/venv"
BRANCH="master"
set -e
echo "🚀 Starting Deployment..."
cd $PROJECT_DIR
git pull origin $BRANCH
source $VENV_PATH/bin/activate
pip install -r requirements.txt
python manage.py migrate --noinput
python manage.py collectstatic --noinput
chown -R www-data:www-data $PROJECT_DIR
systemctl restart gunicorn
echo "✅ Deployment Successful!"
