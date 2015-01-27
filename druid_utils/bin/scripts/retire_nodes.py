#!/opt/splunk/bin/python

import sys, os
from utils import Alert, Email, Template
import pprint
import logging

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import config
CFG = config.getConfig()


alert_logfile = "/var/log/druid/admin_alerts.log"
WARNING_DAYS = [0, 1, 3, 5, 7, 14, 30]

log = logging.getLogger('retire_nodes')
log.setLevel(logging.INFO)
fh = logging.FileHandler(alert_logfile)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
fh.setFormatter(formatter)
log.addHandler(fh)

alert = Alert(sys.argv[1:9])

log.debug("Events=%d Name='%s' Trigger='%s' URL='%s' Raw results='%s'" % (alert.numevents, alert.search_name, alert.trigger_reason, alert.saved_search_url, alert.raw_results))

retire = [x for x in alert.events if x['retire'] == 1]
expire = [x for x in alert.events if x['retire'] == 0]

# First, lets send warnings for the users about node expirations
contacts = list(set( [x['CONTACT'].lower() for x in expire if int(x['days_to_expire']) in WARNING_DAYS] ))

tpl = Template(alert.search_name)

for c in contacts:
    log.debug("Contact: %s", c)

    cnodes = [x for x in expire if x['CONTACT'].lower() == c]

    data = { 'contact': c,
             'warning_days': WARNING_DAYS,
             'nodes': {}
           }
    for d in WARNING_DAYS:
        data['nodes'][d] = [x for x in cnodes if int(x['days_to_expire']) <= d]
        cnodes = [x for x in cnodes if int(x['days_to_expire']) > d]

    log.debug("=== data ===")
    log.debug(data)
    log.debug("=== template ===")
    log.debug(tpl.render(data))
    log.debug("===  end  ===")

    if CFG['email_users']:
        to = c
        if '@' not in c:
            to += '@you.com'

        email = Email('[TSM] Expiration warning for contact %s' % c, tpl, [to], bcc=CFG['bcc_address'], replyto=CFG['support_address'])
        email.send()

        log.info("email sent to %s" % to)


# Now send a summary email to the admins
expire = [x for x in alert.events if x['retire'] == 0 and x['days_to_expire']]
data = { 'retire': retire,
         'expire': [x for x in expire if int(x['days_to_expire']) < 1],
         'expire_soon': [x for x in expire if int(x['days_to_expire']) >= 1],
       }

tpl = Template('%s_escalation' % alert.search_name)

log.debug("=== data ===")
log.debug(data)
log.debug("=== template ===")
log.debug(tpl.render(data))
log.debug("===  end  ===")

if CFG['email_admins']:
    email = Email('[DRUID] Retirement and Expirations', tpl, CFG['admin_address'])
    email.send()

    log.info("escalation email sent to the admins")
