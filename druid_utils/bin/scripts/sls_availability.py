#!/opt/splunk/bin/python

import sys, os
from utils import Alert
from datetime import datetime
import logging
import pprint

sys.path.insert(0, '/usr/lib/python2.6/site-packages')
import requests

XML = '/var/www/html/s/sls-status.xml'
logfile = "/var/log/druid/sls.log"
XSLS = 'http://xsls.you.com'

log = logging.getLogger('sls-status')
log.setLevel(logging.INFO)
fh = logging.FileHandler(logfile)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
fh.setFormatter(formatter)
log.addHandler(fh)

alert = Alert(sys.argv[1:9])

log.debug("Events=%d Search='%s' Trigger='%s' URL='%s' Raw results='%s'\n" % (alert.numevents, alert.fullsearch, alert.trigger_reason, alert.saved_search_url, alert.raw_results))
log.debug('\n%s\n' % pprint.pformat(alert.__dict__))


xml  = '<?xml version="1.0" encoding="utf-8"?>\n'
xml += '<serviceupdate xmlns="http://sls.you.com/SLS/XML/update">\n'
xml += '  <id>BackupService</id>\n'
xml += '  <timestamp>%s</timestamp>\n' % datetime.now().replace(microsecond=0).isoformat()
xml += '  <lemon><cluster>lxtsm</cluster></lemon>\n'
xml += '  <data>\n'

avail = 0
total = 0
total_ok = 0
for t in alert.events:
    avail += t['sls_value']
    total += 1
    if t['sls_value'] == 100:
        total_ok += 1
    xml += '    <numericvalue name="%s">%s</numericvalue>\n' % (t['tsmserver'].upper(), t['sls_value'])
avail = avail / total

xml += '    <textvalue>The percentage of TSM servers available.</textvalue>\n'
xml += '  </data>\n'
xml += '  <availability>%d</availability>\n' % avail
xml += '  <availabilityinfo>Out of %d TSM servers, there are %d fully functional.</availabilityinfo>\n' % (total, total_ok)
xml += '</serviceupdate>\n'

log.debug("=== begin ===\n")
log.debug(xml)
log.debug("===  end  ===\n")

if not os.path.exists(os.path.dirname(XML)):
    os.makedirs(os.path.dirname(XML))

try:
    out = open(XML, 'w')
    out.write(xml)
    out.close()
    os.chmod(XML, 0644)

    log.info('file %s written successfully' % XML)
except:
    log.error('unable to write file %s' % XML)

# Push file
try:
    r = requests.post(XSLS, files={'file': xml})
    log.info('file pushed to %s with status: %s' % (XSLS, r.json()['status']))
except:
    log.error('unable to push file to %s' % XSLS)
