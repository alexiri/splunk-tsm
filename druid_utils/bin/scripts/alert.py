#!/opt/splunk/bin/python

import sys, os
from utils import Alert, Email, Template
import pprint
import logging
import feedparser
from feedformatter import Feed
import time
from datetime import datetime, timedelta
import fcntl
import re

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import config
CFG = config.getConfig()

sys.path.insert(0, '/usr/lib/python2.6/site-packages')
import requests, json

alert_logfile = "/var/log/druid/alerts.log"
FEED_RSS      = "/var/www/html/s/alert_rss.xml"
RSS_MAX_AGE   = timedelta(hours=24)

log = logging.getLogger('alerts')
log.setLevel(logging.INFO)
fh = logging.FileHandler(alert_logfile)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
fh.setFormatter(formatter)
log.addHandler(fh)

alert = Alert(sys.argv[1:9])

log.debug("Events=%d Search='%s' Trigger='%s' URL='%s' Raw results='%s'" % (alert.numevents, alert.fullsearch, alert.trigger_reason, alert.saved_search_url, alert.raw_results))
log.debug('%s' % pprint.pformat(alert.__dict__))

if os.path.isfile(FEED_RSS):
    # Read the current RSS feed
    feed_rss = open(FEED_RSS, "r+")
    fcntl.flock(feed_rss, fcntl.LOCK_EX)
    f = feedparser.parse(feed_rss.read())
    feed = Feed()

    feed.feed['title']       = f['feed']['title']
    feed.feed['link']        = f['feed']['link']
    feed.feed['description'] = f['feed']['description']

    # filter feed
    cut = datetime.now() - RSS_MAX_AGE
    for e in f['entries']:
        date = time.strptime(e['published'], '%a, %d %b %Y %H:%M:%S %Z')
        if datetime(*date[:6]) > cut:
            item = {}
            item['title'] = e['title']
            item['link'] = e['link']
            item['description'] = e['summary']
            item['pubDate'] = date
            feed.items.append(item)
else:
    # Feed doesn't exist, create it
    feed_rss = open(FEED_RSS, "w")
    fcntl.flock(feed_rss, fcntl.LOCK_EX)
    feed = Feed()
    feed.feed['title']       = 'Druid alerts'
    feed.feed['link']        = 'https://druid'
    feed.feed['description'] = 'Feed of Druid alerts'


tpl = Template(alert.search_name)

data = { 'numevents': alert.numEventsStr(),
         'search_name': alert.search_name,
         'description': alert.description,
         'severity': alert.getSeverityTag(),
         'events': alert.getEventsAsText(),
         'edit_alert_url': alert.edit_alert_url,
         'error_help': alert.getTsmHelp(),
         'context_url': alert.context_url,
       }

log.debug("=== begin ===")
log.debug(tpl.render(data))
log.debug("===  end  ===")

# Add new item to RSS feed
item = {}
item['title'] = alert.getSeverityTag()
item['link'] = 'https://druid'
item['description'] = alert.numEventsStr()
item['pubDate'] = time.localtime()
log.debug("Adding new RSS feed item: " + pprint.pformat(item))
feed.items.append(item)

feed.format_rss2_file(FEED_RSS)
if feed_rss:
    fcntl.flock(feed_rss, fcntl.LOCK_UN)
    feed_rss.close()

# Push through Pushbullet
API_KEY = ''

if alert.getSeverityTag() in ['CRITICAL', 'HIGH']:
    import pushybullet as pb
    api = pb.PushBullet(API_KEY)

    title = '%s: %s' % (alert.getSeverityTag(), alert.numEventsStr())

    link = pb.LinkPush('https://druid', title)

    # Send it off!
    for c in api.contacts():
        c.push(link)


# Post to Slack
SLACK_URL  = 'https://you.slack.com/services/hooks/incoming-webhook?token=yiJdX2TmXWed27Snp8ZhG4AI'
SLACK_CHAN = '#backup'
SLACK_BOT  = 'Druid'
SLACK_ICON = ':druid:'

# Disable posting to Slack, nobody uses it :(
if False and alert.getSeverityTag() in ['CRITICAL', 'HIGH']:
    try:
        if alert.events[0]['_raw']:
            payload = { 'channel': SLACK_CHAN,
                        'username': SLACK_BOT,
                        'icon_emoji': SLACK_ICON,
                      }

            headers = {}
            payload['text'] = '*%s* %s:\n' % (alert.getSeverityTag(), alert.numEventsStr())

            payload['attachments'] = []
            text = alert.getEventsAsText()
            text = re.sub('</p>See event <a href="(.*)">(.*)</a> and .*</a><br/>', r'See event <\1|\2>.', text)
            text = text.replace('&nbsp;', '')
            text = text.replace('<br/>', '')

            text = re.split('<p>', text)

            for t in text:
                if t != '\n':
                    payload['attachments'].append({ 'fallback': '',
                                                    'color': 'danger',
                                                    'fields': [{ 'title': '',
                                                                 'value': t,
                                                                 'short': False,
                                                    }],
                                                  })

            r = requests.post(SLACK_URL, data=json.dumps(payload), verify=False)
    except KeyError:
        pass


if CFG['email_admins']:
    if alert.search_name.startswith('Generic Alert'):
        subject = '[%s] %s' % (alert.getSeverityTag(), alert.numEventsStr())
    else:
        subject = '[%s] %s' % (alert.getSeverityTag(), alert.search_name)

    email = Email('[DRUID] %s' % subject, tpl, CFG['admin_address'])
    email.send()

    log.info("email sent - %s" % subject)
