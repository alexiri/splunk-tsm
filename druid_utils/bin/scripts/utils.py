import csv, gzip, urllib, re, os, sys, ast
import smtplib
from email.mime.text import MIMEText
from mako import template
from mako.lookup import TemplateLookup

# Ordered dictionary
class odict(dict):
    def __init__(self, dict = None):
        self._keys = []
        #dict.__init__(self, dict)
        super(odict, self).__init__()

    def __delitem__(self, key):
        dict.__delitem__(self, key)
        self._keys.remove(key)

    def __setitem__(self, key, item):
        dict.__setitem__(self, key, item)
        if key not in self._keys: self._keys.append(key)

    def clear(self):
        dict.clear(self)
        self._keys = []

    def copy(self):
        dict = dict.copy(self)
        dict._keys = self._keys[:]
        return dict

    def items(self):
        return zip(self._keys, self.values())

    def keys(self):
        return self._keys

    def popitem(self):
        try:
            key = self._keys[-1]
        except IndexError:
            raise KeyError('dictionary is empty')

        val = self[key]
        del self[key]

        return (key, val)

    def setdefault(self, key, failobj = None):
        dict.setdefault(self, key, failobj)
        if key not in self._keys: self._keys.append(key)

    def update(self, dict):
        dict.update(self, dict)
        for key in dict.keys():
            if key not in self._keys: self._keys.append(key)

    def values(self):
        return map(self.get, self._keys)


class Alert(object):

    SEVERITY_INFO     = 1
    SEVERITY_LOW      = 2
    SEVERITY_MEDIUM   = 3
    SEVERITY_HIGH     = 4
    SEVERITY_CRITICAL = 5

    def __init__(self, *argv):
        self.numevents, self.search, self.fullsearch, self.search_name, self.trigger_reason, self.saved_search_url, extra, self.raw_results = argv[0][0:8]

        (self.severity, self.description) = extra.split('::', 1)

        self.numevents = int(self.numevents)
        self.severity  = int(self.severity)

        try:
            self.events = self._parseFile(self.raw_results)
        except IOError:
            self.events = []


        self.saved_search_url = re.sub(r'(http[s]?://[\w.]+):\d+/', r'\1/', self.saved_search_url)
        self.splunk_base_url = self.saved_search_url.split('@')[0]
        # Hardcode some cleanups so it works with SSO
        self.splunk_base_url = self.splunk_base_url.replace('bla.you.com', 'druid.you.com')
        self.edit_alert_url = self.splunk_base_url.replace('/app/', '/manager/') + 'saved/searches/%s?action=edit' % urllib.quote(self.search_name)
        self.splunk_base_url = self.splunk_base_url.replace('/druid_utils/', '/druid_admin/')

        self.context_url = None
        if self._getFields('_raw') and self._getFields('tsmserver'):
            query = ' OR '.join(map(lambda x: 'tsmserver="%s"' % x, self._getFields('tsmserver')))
            query = '%s | highlight %s' % (query, ','.join(map(lambda x: '"%s"' % x, self._getFields('_raw'))))

            if len(query) >= 2000:
                query = ' OR '.join(map(lambda x: 'tsmserver="%s"' % x, self._getFields('tsmserver')))
                query = '%s | highlight %s' % (query, ','.join(map(lambda x: '"%s"' % x, self._getFields('_raw'))))

            first, last = self._getTime()
            self.context_url = '%sflashtimeline?q=search%%20%s&earliest=%d&latest=%d' % (self.splunk_base_url, urllib.quote(query), first-300, last+60)


    def _parseFile(self, filename):
        raw_data = csv.DictReader(gzip.open(filename))

        events = []

        cols = []
        for line in raw_data:
            if not cols:
                cols = raw_data.fieldnames

            data = odict()

            # First, lets clean up the fields
            for k in cols:
                # if its one of the multi-value fields and it has a value ...
                if k.startswith('__mv_') and line[k]:
                    # ... split the value and make an array out of it
                    nk = k.replace('__mv_', '')
                    v  = [x.replace('$$', '$') for x in line[k].strip('$').split('$;$')]
                    data[nk] = v
                # if it isn't, and you haven't already created a multi-value field ...
                elif not k.startswith('__mv_') and k not in data:
                    try:
                        # ... maybe it's a date. if so, skip the eval because you'll just substract stuff
                        if re.match('\d+-\d+-\d+', line[k]):
                            data[k] = str(line[k])
                        else:
                            # ... try to eval it in case its a valid python data type
                            data[k] = ast.literal_eval(line[k])
                    except:
                        # and if you fail ...
                        if k.startswith('tag::'):
                            # and its a tag, make it a list
                            data[k] = [line[k]]
                        else:
                            # if its something else, just add it as a string
                            data[k] = line[k]

            # Now lets try to split _raw if it makes sense to do so (ie. it's a transaction)
            try:
                if type(data['_cd']) == list:
                    zipped = zip(data['_cd'], data['_raw'].split('\n'))
                    zipped.sort()
                    data['_raw'] = [x[1] for x in zipped]
            except:
                pass

            # If any of the events have a severity field that is higher than the default alert severity,
            # use that one instead
            try:
                self.severity = max(data['severity'], self.severity)
            except KeyError:
                pass

            events.append(data)

        return events


    def _getFields(self, field):

        values = []

        for event in self.events:
            for k in event:
                if k == field:
                    values.append(event[k])

        return values

    def _getTime(self):

        first = sys.maxint
        last  = 0

        for t in self._getFields('_time'):
            first = min(first, t)
            last  = max(last,  t)

        return (first, last)

    def numEventsStr(self, singular='event', plural='events'):
        if self.numevents == 1:
            str = singular
        else:
            str = plural

        return '%d %s' % (self.numevents, str)

    def getEvents(self):
        return self.events

    def getEventsAsText(self):

        def rawToDict(str):
            (tstamp, others) = str.split(',', 1)

            str = '_time="%s", %s' % (tstamp, others)

            items = re.compile('([^\W]+)=("[^"]+"|[^",]+),?')

            d = dict(items.findall(str))
            for k in d:
                try:
                    d[k] = ast.literal_eval(d[k])
                except:
                    pass

            return d

        events_raw   = ''
        events_table = ''
        keys = None

        for e in self.events:
            try:
                if type(e['_raw']) != list:
                    e['_raw'] = [ e['_raw'] ]

                # It's a transaction
                mintime = None
                sources = []
                errors  = []
                for x in e['_raw']:
                    if x.find('info_search_name=alerts') != -1:
                        # It's an alert, so let's grab all the extra data
                        d = rawToDict(x)
                        text = d['raw']
                        errors.append(text)
                        if not mintime:
                            mintime = d['info_min_time']
                        for s in d['orig_source'].split():
                            if not s in sources:
                                sources.append(s)

                    else:
                        # It's not an alert, just grab it all
                        text = x

                    events_raw += '&nbsp;&nbsp;%s<br/>\n' % text

                events_raw += '\n</p>'
                if e.get('event_id'):
                    # If there's no event_id, it's not an alert
                    url = '%ssearch?q=search%%20index=alerts%%20event_id=%s' % (self.splunk_base_url, e['event_id'])
                    events_raw += 'See event <a href="%s">%s</a> ' % (url, e['event_id'])

                    query = ' OR '.join(map(lambda x: 'source="%s"' % x, sources))
                    query = '%s | highlight %s' % (query, ','.join(map(lambda x: '"%s"' % x, errors)))

                    context_url = '%ssearch?q=search%%20index=tsmlogs%%20sourcetype=tsmlogs%%20%s&earliest=%d&latest=%d' % (self.splunk_base_url, urllib.quote(query), mintime-120, mintime+130)
                    events_raw += 'and <a href="%s">context</a><br/>' % context_url

                events_raw += '<p>\n'


            except KeyError: # no _raw field, so lets assume its a table
                if not keys:
                    events_table = '<table><tr>\n'
                    keys = e.keys()
                    for k in keys:
                        events_table += '<th>%s</th>' % k
                    events_table += '</tr>\n'

                events_table += '<tr>'
                for k in keys:
                    if type(e[k]) is list:
                        events_table += '<td>%s</td>' % '</br>'.join(e[k])
                    else:
                        events_table += '<td>%s</td>' % e[k]
                events_table += '</tr>\n'

            except TypeError: # not an array :S
                pass

        if events_table:
            events_table += '</table>\n'

        if events_raw and not events_table:
            return events_raw
        elif events_raw and events_table:
            return '%s<br />\n%s' % (events_raw, events_table)
        else:
            return events_table

    def getTsmHelp(self):
        # Grab the first TSM Help text and hope its representative
        try:
            return '<br/>\n'.join(self._getFields('tsmhelp')[0])
        except TypeError:
            # It wasn't an array, so just return it as is
            return self._getFields('tsmhelp')[0]
        except IndexError:
            # There was nothing, so return None
            return None

    def getSeverityTag(self):
        severity = { Alert.SEVERITY_INFO:     'INFO',
                     Alert.SEVERITY_LOW:      'LOW',
                     Alert.SEVERITY_MEDIUM:   'MEDIUM',
                     Alert.SEVERITY_HIGH:     'HIGH',
                     Alert.SEVERITY_CRITICAL: 'CRITICAL',
                   }

        return severity.get(self.severity, 'UNKNOWN')


class Email(object):

    __FROM    = 'TSM Monitor <tsmms@you.com>'
    __SERVER  = 'smtp.you.com'

    def __init__(self, subject, message, to, bcc=[], replyto=None):
        self.msg_from = Email.__FROM
        self.msg_to   = to
        self.msg_bcc  = bcc
        self.msg_rpt  = replyto
        self.subject  = subject
        self.message  = str(message)

    def send(self):
        msg = MIMEText(self.message, 'html')
        msg['Subject'] = self.subject
        msg['From']    = self.msg_from
        msg['To']      = ','.join(self.msg_to)
        if self.msg_bcc:
            msg['Bcc'] = ','.join(self.msg_bcc)
        if self.msg_rpt:
            msg['Reply-to'] = self.msg_rpt


        s = smtplib.SMTP()
        s.connect(Email.__SERVER)
        s.sendmail(self.msg_from, self.msg_to + self.msg_bcc, msg.as_string())
        s.close()


class Template(object):
    __DEFAULT      = 'default'
    __TEMPLATE_DIR = os.path.dirname(os.path.realpath(__file__)) + '/templates'

    def __init__(self, name):
        tpldir = TemplateLookup(directories=[Template.__TEMPLATE_DIR])
        try:
            name = name.replace(' ', '_')
            self.tpl = template.Template(filename='%s/%s.tpl' % (Template.__TEMPLATE_DIR, name), lookup=tpldir)
        except IOError, e:
            self.tpl = template.Template(filename='%s/%s.tpl' % (Template.__TEMPLATE_DIR, Template.__DEFAULT), lookup=tpldir)

    def setData(self, data):
        self.data = data

    def render(self, data):
        self.setData(data)
        return self.tpl.render(**self.data)

    def __str__(self):
        return self.tpl.render(**self.data)
