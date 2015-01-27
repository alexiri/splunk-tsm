#!/opt/splunk/bin/python

import sys, os
from utils import Alert, Email, Template
import pprint
import logging

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import config
CFG = config.getConfig()


alert_logfile = "/var/log/druid/failed_backup.log"
ESCALATION_DATE = 7

log = logging.getLogger('failed_backup')
log.setLevel(logging.INFO)
fh = logging.FileHandler(alert_logfile)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
fh.setFormatter(formatter)
log.addHandler(fh)

alert = Alert(sys.argv[1:9])

log.debug("Events=%d Name='%s' Trigger='%s' URL='%s' Raw results='%s'" % (alert.numevents, alert.search_name, alert.trigger_reason, alert.saved_search_url, alert.raw_results))
#log.debug('%s' % pprint.pformat(alert.__dict__))

def filterByAge(items, age):
    newitems = []
    for i in items:
        before = len(i['days_since'])
        # Iterate the loop backwards, cause we'll be removing stuff and we don't want them to move around
        for d in range(len(i['days_since'])-1, -1, -1):
            if float(i['days_since'][d]) < age:
                for t in ['FILESPACES', 'client_schedule', 'status', 'days_since', 'last_completed']:
                    if i[t]:
                        i[t].pop(d)
        if before == 0 or len(i['days_since']) > 0:
            # If we filtered all the details, get rid of the full entry
            # if not, we add it to the result array
            newitems.append(i)
    return newitems

for i in alert.events:
    for k in i.keys():
        if k in ['FILESPACES', 'client_schedule', 'status',
                 'days_since', 'last_completed', 'fs_list'] and not isinstance(i[k], list):
            if i[k]:
                i[k] = [ i[k] ]
            else:
                i[k] = []
    if i['fs_list']:
        i['fs_last_completed'] = [x.split(':')[1] for x in i['fs_list']]
        i['fs_days_since']     = [x.split(':')[2] for x in i['fs_list']]
        i['fs_list']           = [x.split(':')[0] for x in i['fs_list']]

nodes = [x for x in alert.events if not x['FILESPACES']]
filespaces = [x for x in alert.events if x['FILESPACES']]

contacts = list(set( [x['CONTACT'].lower() for x in alert.events] ))

tpl = Template(alert.search_name)

for c in contacts:
    log.debug("Contact: %s", c)

    cnodes = [x for x in nodes if x['CONTACT'].lower() == c]
    cfiles = [x for x in filespaces if x['CONTACT'].lower() == c]

    data = { 'contact': c,
             'nodes': cnodes,
             'filespaces': cfiles,
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

        email = Email('[TSM] Failed backups for contact %s' % c, tpl, [to], bcc=CFG['bcc_address'], replyto=CFG['support_address'])
        email.send()

        log.info("email sent to %s" % to)


# Now send a summary email to the admins, but only for stuff older than ESCALATION_DATE

data = { 'escalation_date': ESCALATION_DATE,
         'nodes': filterByAge(nodes, ESCALATION_DATE),
         'filespaces': filterByAge(filespaces, ESCALATION_DATE),
       }

tpl = Template('%s_escalation' % alert.search_name)

log.debug("=== data ===")
log.debug(data)
log.debug("=== template ===")
log.debug(tpl.render(data))
log.debug("===  end  ===")

if CFG['email_admins']:
    email = Email('[DRUID] Escalation of failed backups', tpl, CFG['admin_address'])
    email.send()

    log.info("escalation email sent to the admins")
