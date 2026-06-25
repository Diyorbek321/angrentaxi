#!/bin/sh
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -h postgres -U angren angren_taxi | gzip > /backups/angren_taxi_${DATE}.sql.gz
# Keep only last 7 days
find /backups -name "*.sql.gz" -mtime +7 -delete
echo "Backup completed: angren_taxi_${DATE}.sql.gz"
