#!/opt/splunk/bin/python

import sys, os
from utils import Alert, Email, Template
import pprint
import logging
import itertools

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import config
CFG = config.getConfig()


alert_logfile = "/var/log/druid/user_alert.log"
ESCALATION_DATE = 7

log = logging.getLogger('user_alert')
log.setLevel(logging.INFO)
fh = logging.FileHandler(alert_logfile)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
fh.setFormatter(formatter)
log.addHandler(fh)

alert = Alert(sys.argv[1:9])

log.debug("Events=%d Name='%s' Trigger='%s' URL='%s' Raw results='%s'" % (alert.numevents, alert.search_name, alert.trigger_reason, alert.saved_search_url, alert.raw_results))
#log.debug('%s' % pprint.pformat(alert.__dict__))

# First, sort the events by contact:
events = sorted(alert.events, key=lambda item: item.get('contact', item.get('CONTACT', '')).lower())

# Now group them by (lowercased) contact
events = itertools.groupby(events, lambda item: item.get('contact', item.get('CONTACT', '')).lower())

tpl = Template(alert.search_name)

for c, ev in events:
    if not c:
        # Ignore events we don't have a contact for
        continue
    log.debug("Contact: %s", c)

    data = { 'contact': c,
             'data': [x for x in ev],
           }

    log.debug("=== data ===")
    log.debug(pprint.pformat(data))
    log.debug("=== template ===")
    log.debug(tpl.render(data))
    log.debug("===  end  ===")

    if CFG['email_users']:
        to = c
        if '@' not in c:
            to += '@you.com'

        email = Email('[TSM] Unauthorized access for contact %s' % c, tpl, [to], bcc=CFG['bcc_address'], replyto=CFG['support_address'])
        email.send()

        log.info("email sent to %s" % to)

