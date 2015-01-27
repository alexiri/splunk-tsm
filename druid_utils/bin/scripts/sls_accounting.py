#!/opt/splunk/bin/python

import sys, os
from utils import Alert
from datetime import datetime
import logging
import pprint

sys.path.insert(0, '/usr/lib/python2.6/site-packages')
import requests

XML = '/var/www/html/s/sls-accounting.xml'
logfile = "/var/log/druid/sls.log"
XSLS = 'http://xsls.you.com'

log = logging.getLogger('sls-accounting')
log.setLevel(logging.INFO)
fh = logging.FileHandler(logfile)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
fh.setFormatter(formatter)
log.addHandler(fh)

alert = Alert(sys.argv[1:9])

log.debug("Events=%d Search='%s' Trigger='%s' URL='%s' Raw results='%s'\n" % (alert.numevents, alert.fullsearch, alert.trigger_reason, alert.saved_search_url, alert.raw_results))
log.debug('\n%s\n' % pprint.pformat(alert.__dict__))


xml  = '<?xml version="1.0" encoding="utf-8"?>\n'
xml += '<serviceaccountinginfo xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://sls.you.com/SLS/XML/accounting http://sls.you.com/SLS/XML/accounting.xsd" xmlns="http://sls.you.com/SLS/XML/accounting">\n'
xml += '  <id>BackupService</id>\n'
xml += '  <day working="true">%s</day>\n' % datetime.now().strftime('%Y-%m-%d')
xml += '  <kpis>\n'

for t in alert.events:

    def key(hash, value, text):
        if value in hash and hash[value]!='':
            return text % hash[value]
        return ''

    unit = key(t, 'sls_unit', 'unit="%s"')
    publish = key(t, 'sls_publish', 'publish="%s"')

    xml += '    <kpi id="%s" name="%s" type="%s" %s goal="%s" %s>\n' \
            % (t['sls_id'], t['sls_name'], t['sls_type'], unit, t['sls_goal'], publish)
    xml += '      <target>%s</target>\n' % t['sls_target']
    xml += '      <value>%s</value>\n' % t['sls_value']
    xml += '    </kpi>\n'

xml += '  </kpis>\n'
xml += '</serviceaccountinginfo>\n'

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
